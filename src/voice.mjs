// Voice notes: transcribed on this machine with whisper.cpp (open source, offline), then routed like text.

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import * as settings from "./settings.mjs";

const run = promisify(execFile);

// The model path comes from the owner's settings (default: WHISPER_MODEL or ~/services/whisper/ggml-base.bin).
export async function transcribe(audioPath) {
  const MODEL = settings.get().voice.whisperModel;
  const wav = `${audioPath}.16k.wav`;
  await run("ffmpeg", ["-loglevel", "error", "-y", "-i", audioPath, "-ar", "16000", "-ac", "1", wav]);
  const { stdout } = await run("whisper-cli", ["-m", MODEL, "-f", wav, "-l", "auto", "-nt", "-np"], { timeout: 60_000 });
  return stdout.replace(/\s+/g, " ").trim();
}
