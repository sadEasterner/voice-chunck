import { useState } from "react";
import VoiceRecorder, {
  type ChunkingMode,
} from "@/components/vioce/vioce-recorder";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
export default function App() {
  const [chunkType, setChunkType] = useState<ChunkingMode>("time");
  return (
    <div className="p-6 h-screen w-screen flex flex-col items-center gap-1 justify-center">
      {/* Use either mode */}
      <div className="flex">
        <Select
          onValueChange={(val) => setChunkType(val as ChunkingMode)}
          defaultValue="time"
        >
          <SelectTrigger className="w-[180px] cursor-pointer">
            <SelectValue placeholder="Theme" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="silence">Chunk by Silence</SelectItem>
            <SelectItem value="time">Chunk by Time</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <VoiceRecorder chunkBy={chunkType} />
      {/* <VoiceRecorder chunkBy="silence" /> */}
    </div>
  );
}
