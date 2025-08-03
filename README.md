# 🎙️ VoiceRecorder Component

A reusable React + TypeScript component that records audio in chunks based on:

- ⏱️ **Fixed time intervals** (e.g. every 5 seconds), or  
- 🔇 **Silence detection** (e.g. when the user stops speaking for 1.5 seconds)

Each audio chunk is uploaded to a configurable server endpoint.

---

## ✨ Features

- ✅ Chunk audio by **time** or **silence**
- ✅ Toggle strategy via a prop: `chunkBy="time"` or `chunkBy="silence"`
- ✅ Live audio waveform visualization via `<canvas>`
- ✅ Upload each chunk automatically as `.webm`
- ✅ Grace period before detecting silence
- ✅ TypeScript support
- ✅ Full cleanup and resource management

---

## 📦 Installation

Clone or copy `VoiceRecorder.tsx` into your project, e.g.:




💡 Usage:
```import VoiceRecorder from "./components/VoiceRecorder";

function App() {
  return (
    <div className="p-6">
      {/* Record in 5-second chunks */}
      <VoiceRecorder chunkBy="time" />

      {/* Record when silence is detected for 1.5s */}
      {/* <VoiceRecorder chunkBy="silence" /> */}
    </div>
  );
}```
