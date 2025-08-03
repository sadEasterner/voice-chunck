import React, { useState, useRef, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";

export type ChunkingMode = "time" | "silence";

interface VoiceRecorderProps {
  chunkBy: ChunkingMode;
  chunkDurationMs?: number; // default 5000 for time-based
  silenceDurationMs?: number; // default 500 for silence-based
  silenceThreshold?: number; // default 3
  serverUrl?: string;
}

const DEFAULT_CHUNK_MS = 5000;
const DEFAULT_SILENCE_MS = 1000;
const DEFAULT_SILENCE_THRESHOLD = 3;
const INITIAL_SILENCE_DELAY = 2000;

const VoiceRecorder: React.FC<VoiceRecorderProps> = ({
  chunkBy,
  chunkDurationMs = DEFAULT_CHUNK_MS,
  silenceDurationMs = DEFAULT_SILENCE_MS,
  silenceThreshold = DEFAULT_SILENCE_THRESHOLD,
  serverUrl = import.meta.env.SERVER_BASE_URL || "http://localhost:3001",
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [status, setStatus] = useState("Idle");
  const [error, setError] = useState("");

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const chunkTimerRef = useRef<NodeJS.Timeout | null>(null);
  const timeCounterRef = useRef<NodeJS.Timeout | null>(null);

  const drawHistogram = useCallback(() => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      analyser.getByteFrequencyData(dataArray);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const barWidth = canvas.width / bufferLength;
      let x = 0;
      for (let i = 0; i < bufferLength; i++) {
        const barHeight = dataArray[i] * 1.5;
        const gradient = ctx.createLinearGradient(0, canvas.height, 0, 0);
        gradient.addColorStop(0, "#80a3f1");
        gradient.addColorStop(0.5, "#155dfc");
        ctx.fillStyle = gradient;
        ctx.fillRect(x, canvas.height - barHeight / 2, barWidth, barHeight / 2);
        x += barWidth + 1;
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();
  }, []);

  const uploadChunk = async (blob: Blob) => {
    const chunkId = `chunk-${Date.now()}.webm`;
    try {
      await fetch(`${serverUrl}/api/upload-audio`, {
        method: "POST",
        headers: {
          "Content-Type": "audio/webm",
          "X-Chunk-Id": chunkId,
        },
        body: blob,
      });
      setStatus(`Uploaded chunk: ${chunkId}`);
    } catch (err) {
      if (err instanceof Error) {
        setError("Upload failed: " + err.message);
        setStatus("Error uploading");
        stopRecording();
      }
    }
  };

  const startNewRecorder = () => {
    const stream = streamRef.current;
    if (!stream) return;

    const recorder = new MediaRecorder(stream, {
      mimeType: "audio/webm;codecs=opus",
    });

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        uploadChunk(e.data);
      }
    };

    recorder.onstop = () => {
      startNewRecorder();
      recorderRef.current?.start();

      if (chunkBy === "silence") {
        monitorSilence();
      }
    };

    recorderRef.current = recorder;
    recorder.start();

    if (chunkBy === "silence") {
      monitorSilence();
    }
  };

  const monitorSilence = () => {
    const analyser = analyserRef.current;
    if (!analyser) return;

    const bufferLength = analyser.fftSize;
    const dataArray = new Uint8Array(bufferLength);

    let silenceStart = 0;
    let isSilent = false;
    const startTime = performance.now();

    const check = () => {
      const now = performance.now();
      if (now - startTime < INITIAL_SILENCE_DELAY) {
        requestAnimationFrame(check);
        return;
      }

      analyser.getByteTimeDomainData(dataArray);

      const avg =
        dataArray.reduce((sum, val) => sum + Math.abs(val - 128), 0) /
        bufferLength;

      if (avg < silenceThreshold) {
        if (!isSilent) {
          isSilent = true;
          silenceStart = now;
        } else if (now - silenceStart >= silenceDurationMs) {
          if (recorderRef.current?.state === "recording") {
            recorderRef.current.requestData();
            recorderRef.current.stop();
          }
          return;
        }
      } else {
        isSilent = false;
      }

      requestAnimationFrame(check);
    };

    check();
  };

  const startRecording = async () => {
    try {
      setError("");
      setStatus("Starting...");
      setIsRecording(true);
      setElapsedTime(0);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const AudioContextClass =
        "AudioContext" in window
          ? window.AudioContext
          : "webkitAudioContext" in window
          ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (window as any).webkitAudioContext
          : null;

      if (!AudioContextClass) throw new Error("AudioContext not supported");

      const audioCtx = new AudioContextClass();
      audioCtxRef.current = audioCtx;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      drawHistogram();
      startNewRecorder();

      timeCounterRef.current = setInterval(() => {
        setElapsedTime((prev) => prev + 1);
      }, 1000);

      if (chunkBy === "time") {
        chunkTimerRef.current = setInterval(() => {
          recorderRef.current?.requestData();
          recorderRef.current?.stop(); // triggers onstop → new recorder
        }, chunkDurationMs);
      }

      setStatus("Recording...");
    } catch (err) {
      if (err instanceof Error) {
        setError("Error: " + err.message);
      }
      setStatus("Idle");
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    setIsRecording(false);
    setStatus("Stopping...");
    setElapsedTime(0);

    recorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    audioCtxRef.current?.close();

    if (chunkTimerRef.current) clearInterval(chunkTimerRef.current);
    if (timeCounterRef.current) clearInterval(timeCounterRef.current);
    if (animationRef.current) cancelAnimationFrame(animationRef.current);

    recorderRef.current = null;
    analyserRef.current = null;
    streamRef.current = null;
    audioCtxRef.current = null;

    setStatus("Stopped");
  };

  useEffect(() => {
    return () => stopRecording();
  }, []);

  return (
    <Card className="w-1/2 max-w-lg mx-auto ">
      <CardHeader className="text-2xl mb-2">
        <CardTitle className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-800 to-blue-400">
          Chunked Voice Recorder
        </CardTitle>
        <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-800 to-blue-400">
          Chunk By: <span className="text-purple-700">{chunkBy}</span>
          {chunkBy === "silence" ? (
            <span className="text-purple-700"> {chunkDurationMs} ms</span>
          ) : (
            ""
          )}
        </h2>
      </CardHeader>
      <CardContent>
        <canvas
          ref={canvasRef}
          className="rounded-lg w-full h-10 border shadow-inner mb-4"
        />

        <div className="flex gap-4 mb-4">
          <Button
            onClick={startRecording}
            disabled={isRecording}
            variant={"default"}
            className="bg-blue-600 hover:bg-blue-500 text-white "
          >
            Start
          </Button>
          <Button
            onClick={stopRecording}
            disabled={!isRecording}
            className="bg-red-500 hover:bg-red-400 text-white"
          >
            Stop
          </Button>
        </div>
        {isRecording && (
          <div className="mb-2">
            <strong>Elapsed:</strong>
            {String(Math.floor(elapsedTime / 60)).padStart(2, "0")}:
            {String(elapsedTime % 60).padStart(2, "0")}
          </div>
        )}
        <div className="text-sm ">
          <strong>Status:</strong> {status}
        </div>
        {error && (
          <div className="mt-2 text-red-600 font-semibold">{error}</div>
        )}
      </CardContent>
    </Card>
  );
};

export default VoiceRecorder;
