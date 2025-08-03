🎙️ VoiceRecorder Component
A React component for recording audio in chunks, either:

⏱️ Fixed time intervals (e.g. every 5 seconds), or

🔇 Automatically on silence (e.g. after 1.5 seconds of no speech)

Each chunk is uploaded as a .webm file to a server endpoint.
Visual feedback via waveform is provided in real-time.

📦 Features
✅ Chunk audio based on time or silence

✅ Toggle chunking strategy with a prop

✅ Live waveform visualization using <canvas>

✅ Upload each chunk automatically

✅ React best practices & cleanup

✅ Customizable chunk durations and thresholds

🚀 Installation
This is a standalone component — just copy VoiceRecorder.tsx into your components/ directory.

Install required dependencies (if not already in your project):
```npm install react```


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
