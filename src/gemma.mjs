// Gemma 4 turns loose WhatsApp text into a structured action, and squashes agent output.
// Backends: the Gemini API (GEMINI_API_KEY), or Vertex AI with gcloud credentials (VERTEX_PROJECT).

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const MODEL = process.env.GEMMA_MODEL || "gemma-4-26b-a4b-it";
const VERTEX_PROJECT = process.env.VERTEX_PROJECT;
const FALLBACK_MODEL = process.env.GEMMA_FALLBACK_MODEL || "gemma-4-31b-it";

// Tried in order. Shared managed quotas return 429 under load, so each backend gets retries before the next.
const BACKENDS = [
  ...(process.env.GEMINI_API_KEY ? [{ via: "gemini-api", model: MODEL }, { via: "gemini-api", model: FALLBACK_MODEL }] : []),
  ...(VERTEX_PROJECT ? [{ via: "vertex", model: MODEL }] : []),
];

export const model = BACKENDS.map((b) => `${b.via}:${b.model}`).join(" > ") || "none";

let token = { value: null, expires: 0 };
async function gcloudToken() {
  if (Date.now() < token.expires) return token.value;
  const { stdout } = await promisify(execFile)("gcloud", ["auth", "print-access-token"]);
  token = { value: stdout.trim(), expires: Date.now() + 45 * 60_000 };
  return token.value;
}

// Vertex AI serves Gemma 4 as a managed model on the global OpenAI-compatible endpoint.
async function generateVertex(prompt, maxTokens, model) {
  const res = await fetch(
    `https://aiplatform.googleapis.com/v1/projects/${VERTEX_PROJECT}/locations/global/endpoints/openapi/chat/completions`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${await gcloudToken()}` },
      body: JSON.stringify({
        model: `google/${model}-maas`,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        max_tokens: maxTokens,
      }),
      signal: AbortSignal.timeout(30_000),
    },
  );
  const json = await res.json();
  const body = Array.isArray(json) ? json[0] : json;
  if (!res.ok) throw Object.assign(new Error(`Gemma (Vertex) ${res.status}: ${body.error?.message}`), { status: res.status });
  return (body.choices?.[0]?.message?.content ?? "").trim();
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function generate(prompt, maxOutputTokens = 600) {
  if (!BACKENDS.length) throw new Error("set GEMINI_API_KEY or VERTEX_PROJECT");
  let lastError;
  for (const b of BACKENDS) {
    for (const delay of [0, 700]) {
      await sleep(delay);
      try {
        return b.via === "vertex"
          ? await generateVertex(prompt, maxOutputTokens, b.model)
          : await generateApi(prompt, maxOutputTokens, b.model);
      } catch (err) {
        lastError = err;
        console.error(`[gemma] ${b.via}:${b.model}`, err.message.slice(0, 120));
        if (err.status && err.status !== 429 && err.status < 500) break;
      }
    }
  }
  throw lastError;
}

async function generateApi(prompt, maxOutputTokens, model) {
  const key = process.env.GEMINI_API_KEY;
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens, thinkingConfig: { thinkingLevel: "minimal" } },
    }),
    signal: AbortSignal.timeout(30_000),
  });
  const json = await res.json();
  if (!res.ok) throw Object.assign(new Error(`Gemma ${res.status}: ${json.error?.message}`), { status: res.status });
  return (json.candidates?.[0]?.content?.parts ?? [])
    .filter((p) => !p.thought)
    .map((p) => p.text)
    .join("")
    .trim();
}

function extractJson(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error(`no JSON in Gemma output: ${text.slice(0, 120)}`);
  return JSON.parse(text.slice(start, end + 1));
}

export async function route(message, sessions) {
  const list = sessions.length
    ? sessions.map((s) => `- ${s.name} (${s.agent}, ${s.status}): ${s.prompt.slice(0, 80)}`).join("\n")
    : "(none)";
  const prompt = `You are Hukam, a router that lets a developer control their coding agents from WhatsApp.
Read the developer's message and decide ONE action. Reply with ONLY a JSON object, no prose.

Actions:
- "spawn": start a new agent on a task. Needs "agent" (claude, codex or opencode; default claude) and "prompt" (clear task for the agent) and "name" (2-3 word kebab-case label).
- "send": send a follow-up to an existing session. Needs "session" (exact name from the list) and "prompt".
- "list": show sessions.
- "status": ask what a session (or all) is doing. "session" optional.
- "stop": stop a session. Needs "session".
- "chat": the message is not a task (greeting, question about Hukam). Put a short answer in "reply".

Always include "risk". Agents work in a sandboxed git worktree, so reading, writing, editing, refactoring and testing code there is NORMAL and "low".
Use "high" ONLY when the task would affect something outside that worktree: git push or merge to a shared branch, deploy or release, delete data or files outside the project, change cloud/infrastructure/DNS, read or change secrets or credentials, send messages or emails to other people, or spend money.
Examples: "add a dark mode toggle" -> low. "write tests for auth" -> low. "fix the navbar bug" -> low. "deploy to production" -> high. "push to main" -> high. "rotate the API keys" -> high. "drop the users table" -> high.
Include "reason": one short sentence.
The message may be English, Urdu or Roman Urdu. Write "prompt" in English.

Active sessions:
${list}

Developer message:
"""${message}"""

JSON shape: {"action":"","agent":null,"session":null,"name":null,"prompt":null,"risk":"low","reason":"","reply":null}`;
  return extractJson(await generate(prompt));
}

export async function summarize(name, screen) {
  return generate(
    `A coding agent named "${name}" just stopped. Below is the end of its terminal.
Write a WhatsApp update of at most 3 short lines: what it did, the result, and anything the developer must do.
If it is asking a question or waiting for approval, say exactly what it is asking. Plain text, no markdown headers.

Terminal:
"""${screen.slice(-6000)}"""`,
    300,
  );
}
