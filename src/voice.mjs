// Voice notes: transcribed on this machine with whisper.cpp (open source, offline), then routed like text.

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { homedir } from "node:os";

const run = promisify(execFile);
const MODEL = process.env.WHISPER_MODEL || `${homedir()}/services/whisper/ggml-base.bin`;

export async function transcribe(audioPath) {
  const wav = `${audioPath}.16k.wav`;
  await run("ffmpeg", ["-loglevel", "error", "-y", "-i", audioPath, "-ar", "16000", "-ac", "1", wav]);
  const { stdout } = await run("whisper-cli", ["-m", MODEL, "-f", wav, "-l", "auto", "-nt", "-np"], { timeout: 60_000 });
  return stdout.replace(/\s+/g, " ").trim();
}
