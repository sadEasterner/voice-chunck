import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.raw({ type: "audio/webm", limit: "10mb" }));

const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

app.post("/api/upload-audio", (req, res) => {
  const chunkId = req.headers["x-chunk-id"];
  if (!chunkId || typeof chunkId !== "string") {
    return res.status(400).send("Missing chunk ID");
  }

  if (!req.body || !Buffer.isBuffer(req.body)) {
    return res.status(400).send("Invalid audio data");
  }

  const filePath = path.join(uploadDir, chunkId);

  fs.writeFile(filePath, req.body, (err) => {
    if (err) {
      console.error("Error saving chunk:", err);
      return res.status(500).send("Error saving chunk");
    }

    console.log("Saved playable chunk:", filePath);
    res.status(200).send("Chunk saved");
  });
});

app.get("/", (_req, res) => {
  res.send("Audio server is running.");
});

app.listen(PORT, () => {
  console.log(`Server listening at http://localhost:${PORT}`);
});
