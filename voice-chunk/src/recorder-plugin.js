export class ChunkedVoiceRecorder {
  constructor(containerSelector, options = {}) {
    this.container = document.querySelector(containerSelector);
    if (!this.container) throw new Error("Container element not found.");

    this.chunkBy = options.chunkBy || "time";
    this.chunkDurationMs = options.chunkDurationMs || 5000;
    this.silenceDurationMs = options.silenceDurationMs || 1000;
    this.silenceThreshold = options.silenceThreshold || 3;
    this.serverUrl = options.serverUrl || "http://localhost:3001/api/upload-audio";

    this.mediaRecorder = null;
    this.stream = null;
    this.audioCtx = null;
    this.analyser = null;
    this.source = null;

    this.animationId = null;
    this.chunkTimer = null;
    this.timerInterval = null;
    this.elapsed = 0;

    this.isSilent = false;
    this.silenceStart = 0;

    this._render();
  }

  _render() {
    this.container.innerHTML = `
      <div class="recorder">
        <h2>Voice Recorder</h2>
        <canvas width="400" height="80"></canvas>
        <div>
          <button class="start-btn">Start</button>
          <button class="stop-btn" disabled>Stop</button>
        </div>
        <p>Status: <span class="status">Idle</span></p>
        <p>Elapsed: <span class="timer">00:00</span></p>
        <p class="error" style="color:red;"></p>
      </div>
    `;

    this.canvas = this.container.querySelector("canvas");
    this.startBtn = this.container.querySelector(".start-btn");
    this.stopBtn = this.container.querySelector(".stop-btn");
    this.statusEl = this.container.querySelector(".status");
    this.timerEl = this.container.querySelector(".timer");
    this.errorEl = this.container.querySelector(".error");

    this.startBtn.addEventListener("click", () => this.start());
    this.stopBtn.addEventListener("click", () => this.stop());
  }

  async start() {
    this._reset();
    this.statusEl.textContent = "Starting...";
    this.startBtn.disabled = true;
    this.stopBtn.disabled = false;

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 256;

      this.source = this.audioCtx.createMediaStreamSource(this.stream);
      this.source.connect(this.analyser);

      this._drawHistogram();
      this._startRecorder();

      this.timerInterval = setInterval(() => {
        this.elapsed++;
        const mins = String(Math.floor(this.elapsed / 60)).padStart(2, "0");
        const secs = String(this.elapsed % 60).padStart(2, "0");
        this.timerEl.textContent = `${mins}:${secs}`;
      }, 1000);

      if (this.chunkBy === "time") {
        this.chunkTimer = setInterval(() => {
          this.mediaRecorder.requestData();
          this.mediaRecorder.stop();
        }, this.chunkDurationMs);
      }

      this.statusEl.textContent = "Recording...";
    } catch (err) {
      this._error(err.message);
    }
  }

  stop() {
    this.statusEl.textContent = "Stopping...";
    this.startBtn.disabled = false;
    this.stopBtn.disabled = true;

    clearInterval(this.chunkTimer);
    clearInterval(this.timerInterval);
    cancelAnimationFrame(this.animationId);

    if (this.mediaRecorder?.state !== "inactive") this.mediaRecorder.stop();
    this.stream?.getTracks().forEach((t) => t.stop());
    this.audioCtx?.close();

    this.mediaRecorder = null;
    this.stream = null;
    this.audioCtx = null;
    this.source = null;
    this.analyser = null;

    this.statusEl.textContent = "Stopped";
    this.timerEl.textContent = "00:00";
  }

  _startRecorder() {
    this.mediaRecorder = new MediaRecorder(this.stream, {
      mimeType: "audio/webm;codecs=opus",
    });

    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) this._uploadChunk(e.data);
    };

    this.mediaRecorder.onstop = () => {
      if (this.mediaRecorder && this.mediaRecorder.state === "inactive" && this.stream?.active) {
        this._startRecorder();
        this.mediaRecorder.start();
        if (this.chunkBy === "silence") this._monitorSilence();
      }
    };

    this.mediaRecorder.start();
    if (this.chunkBy === "silence") this._monitorSilence();
  }

  _uploadChunk(blob) {
    const chunkId = `chunk-${Date.now()}.webm`;

    fetch(this.serverUrl, {
      method: "POST",
      headers: {
        "Content-Type": "audio/webm",
        "X-Chunk-Id": chunkId,
      },
      body: blob,
    })
      .then(() => {
        this.statusEl.textContent = `Uploaded: ${chunkId}`;
      })
      .catch((err) => {
        this._error("Upload failed: " + err.message);
        this.stop();
      });
  }

  _drawHistogram() {
    const ctx = this.canvas.getContext("2d");
    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const centerY = this.canvas.height / 2;

    const draw = () => {
        this.analyser.getByteFrequencyData(dataArray);
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        const barWidth = this.canvas.width / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
        const barHeight = dataArray[i];
        ctx.fillStyle = "blue";

        ctx.fillRect(x, centerY - barHeight / 2, barWidth, barHeight);
        x += barWidth + 1;
        }

        this.animationId = requestAnimationFrame(draw);
    };

    draw();
  }

  _monitorSilence() {
    const bufferLength = this.analyser.fftSize;
    const dataArray = new Uint8Array(bufferLength);
    const initialTime = performance.now();

    const check = () => {
      const now = performance.now();
      if (now - initialTime < 2000) {
        requestAnimationFrame(check);
        return;
      }

      this.analyser.getByteTimeDomainData(dataArray);
      const avg =
        dataArray.reduce((sum, val) => sum + Math.abs(val - 128), 0) / bufferLength;

      if (avg < this.silenceThreshold) {
        if (!this.isSilent) {
          this.isSilent = true;
          this.silenceStart = now;
        } else if (now - this.silenceStart >= this.silenceDurationMs) {
          if (this.mediaRecorder?.state === "recording") {
            this.mediaRecorder.requestData();
            this.mediaRecorder.stop();
          }
          return;
        }
      } else {
        this.isSilent = false;
      }

      requestAnimationFrame(check);
    };

    check();
  }

  _error(msg) {
    this.errorEl.textContent = msg;
    this.statusEl.textContent = "Error";
    this.startBtn.disabled = false;
    this.stopBtn.disabled = true;
  }

  _reset() {
    this.elapsed = 0;
    this.timerEl.textContent = "00:00";
    this.errorEl.textContent = "";
    this.statusEl.textContent = "";
  }
}
