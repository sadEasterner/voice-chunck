import { ChunkedVoiceRecorder } from "./recorder-plugin.js";

// Example usage
const recorder = new ChunkedVoiceRecorder("#myRecorder", {
  chunkBy: "silence",
  chunkDurationMs: 4000,
  silenceThreshold: 4,
  silenceDurationMs: 1500,
  serverUrl: "http://localhost:3001/api/upload-audio",
});
