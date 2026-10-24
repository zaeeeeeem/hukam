// Gemma 4 turns loose WhatsApp text into a structured action, and squashes agent output.
// Backends: the Gemini API (GEMINI_API_KEY), or Vertex AI with gcloud credentials (VERTEX_PROJECT).

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import * as settings from "./settings.mjs";

const VERTEX_PROJECT = process.env.VERTEX_PROJECT;

// Tried in order (owner-configurable). Shared managed quotas return 429 under load, so each backend gets retries
// before the next. A backend without credentials is skipped.
function backends() {
  const { backends: order, model, fallbackModel } = settings.get().gemma;
  return order.flatMap((via) => {
    if (via === "gemini-api" && process.env.GEMINI_API_KEY) return [{ via, model }, ...(fallbackModel && fallbackModel !== model ? [{ via, model: fallbackModel }] : [])];
    if (via === "vertex" && VERTEX_PROJECT) return [{ via, model }];
    return [];
  });
}

// Human-readable chain, e.g. "gemini-api:gemma-4-26b-a4b-it > vertex:gemma-4-26b-a4b-it". Read live: settings may change.
export const chain = () => backends().map((b) => `${b.via}:${b.model}`).join(" > ") || "none";

// Per-backend telemetry for the portal's System page. Keyed "via:model".
const stats = new Map();
let lastServed = null;
const statOf = (b) => {
  const key = `${b.via}:${b.model}`;
  if (!stats.has(key)) stats.set(key, { key, via: b.via, model: b.model, calls: 0, failures: 0, lastMs: null, lastOkAt: null, lastError: null, lastErrorAt: null });
  return stats.get(key);
};
export const telemetry = () => ({
  chain: chain(),
  lastServed,
  backends: backends().map((b) => statOf(b)),
  configured: { gemini: !!process.env.GEMINI_API_KEY, vertex: !!VERTEX_PROJECT },
});
// Which backend answered the most recent call, e.g. "gemini-api:gemma-4-26b-a4b-it" (with its latency).
export const served = () => lastServed;

let token = { value: null, expires: 0 };
async function gcloudToken() {
  if (Date.now() < token.expires) return token.value;
  const { stdout } = await promisify(execFile)("gcloud", ["auth", "print-access-token"]);
  token = { value: stdout.trim(), expires: Date.now() + 45 * 60_000 };
  return token.value;
}

// Vertex AI serves Gemma 4 as a managed model on the global OpenAI-compatible endpoint.
// `image` ({ mime, base64 }) is optional and goes in as an extra content part on both backends.
async function generateVertex(prompt, maxTokens, model, image) {
  const res = await fetch(
    `https://aiplatform.googleapis.com/v1/projects/${VERTEX_PROJECT}/locations/global/endpoints/openapi/chat/completions`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${await gcloudToken()}` },
      body: JSON.stringify({
        model: `google/${model}-maas`,
        messages: [
          {
            role: "user",
            content: image
              ? [{ type: "image_url", image_url: { url: `data:${image.mime};base64,${image.base64}` } }, { type: "text", text: prompt }]
              : prompt,
          },
        ],
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

async function generate(prompt, maxOutputTokens = 600, image = null) {
  const list = backends();
  if (!list.length) throw new Error("set GEMINI_API_KEY or VERTEX_PROJECT");
  let lastError;
  for (const b of list) {
    const st = statOf(b);
    for (const delay of [0, 700]) {
      await sleep(delay);
      const started = Date.now();
      st.calls++;
      try {
        const text = b.via === "vertex"
          ? await generateVertex(prompt, maxOutputTokens, b.model, image)
          : await generateApi(prompt, maxOutputTokens, b.model, image);
        st.lastMs = Date.now() - started;
        st.lastOkAt = Date.now();
        lastServed = { key: st.key, via: b.via, model: b.model, ms: st.lastMs, at: st.lastOkAt };
        return text;
      } catch (err) {
        lastError = err;
        st.failures++;
        st.lastMs = Date.now() - started;
        st.lastError = err.message.slice(0, 200);
        st.lastErrorAt = Date.now();
        console.error(`[gemma] ${b.via}:${b.model}`, err.message.slice(0, 120));
        if (err.status && err.status !== 429 && err.status < 500) break;
      }
    }
  }
  throw lastError;
}

async function generateApi(prompt, maxOutputTokens, model, image) {
  const key = process.env.GEMINI_API_KEY;
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [...(image ? [{ inlineData: { mimeType: image.mime, data: image.base64 } }] : []), { text: prompt }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens, thinkingConfig: { thinkingLevel: "minimal" } },
    }),
    signal: AbortSignal.timeout(image ? 60_000 : 30_000),
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

function routePrompt(message, sessions, attachmentNote = "", context = "") {
  const list = sessions.length
    ? sessions.map((s) => `- ${s.name} (${s.agent}, ${s.status}): ${s.prompt.slice(0, 80)}`).join("\n")
    : "(none)";
  const prompt = `You are Hukam, a router that lets a developer control their coding agents from WhatsApp.
Read the developer's message and decide ONE action. Reply with ONLY a JSON object, no prose.

Actions:
- "spawn": start a new agent on a task. Needs "agent" (claude, codex or opencode; default ${settings.get().defaultAgent}) and "prompt" (clear task for the agent) and "name" (2-3 word kebab-case label).
- "send": send a follow-up to an existing session. Needs "session" (exact name from the list) and "prompt".
- "list": show sessions.
- "status": ask what a session (or all) is doing. "session" optional.
- "stop": stop a session. Needs "session".
- "chat": the message is not a task (greeting, question about Hukam). Put a short answer in "reply".
- "await_attachment": the developer says they will send a photo, image, screenshot or PDF next and gives the instruction for it ("I'll send a photo next, build a page from it", "next image ke saath yeh karna"). Put that instruction in "prompt" (in English). Do NOT use this if no future attachment is mentioned.

Images: if the message asks to create, make, generate, draw or design an image, logo, poster, icon, banner, illustration or picture, use "spawn" with agent "codex" (unless the developer explicitly names another agent) and write "prompt" as a complete task that first restates WHAT to draw (subject, style, colors, any text, from the developer's message), then says: use your built-in image generation tool if available (otherwise draw it as SVG and export a PNG), and save the final image as PNG at outputs/<short-kebab-name>.png. Example prompt: "Create a flat minimalist logo of a steaming chai cup in warm brown and orange. Use your built-in image generation tool if available (otherwise draw it as SVG and export a PNG). Save the final image as PNG at outputs/chai-cup-logo.png." Image creation is "low" risk.
Editing images: if the message refers to a previous image or logo ("make the logo blue", "edit the previous image", "update that picture"), use the "Recent images in this chat" list. If the image was made by a session that is in the active list and not stopped/exited, use "send" to that session; otherwise "spawn" agent "codex". Either way the "prompt" must name the exact file path of the image, say what to change, and say to save the edited version as a NEW PNG under outputs/ (e.g. outputs/<name>-v2.png) without overwriting the original.

Always include "risk". Agents work in a sandboxed git worktree, so reading, writing, editing, refactoring and testing code there is NORMAL and "low".
Use "high" ONLY when the task would affect something outside that worktree: git push or merge to a shared branch, deploy or release, delete data or files outside the project, change cloud/infrastructure/DNS, read or change secrets or credentials, send messages or emails to other people, or spend money.
Also "high": any request to read, print, show, send or upload secrets, .env files, SSH keys, API keys, tokens or passwords, or any file outside the workspace (e.g. ~/, /etc).
Examples: "add a dark mode toggle" -> low. "write tests for auth" -> low. "fix the navbar bug" -> low. "deploy to production" -> high. "push to main" -> high. "rotate the API keys" -> high. "drop the users table" -> high. "show me the .env file" -> high. "cat ~/.ssh/id_rsa" -> high.
When "risk" is "high", also include "category": one of push, deploy, delete, secrets, infra, messaging, spend (or "other").
Include "reason": one short sentence.
The message may be English, Urdu or Roman Urdu. Write "prompt" in English.

Active sessions:
${list}

${context ? `${context}\n\n` : ""}${attachmentNote}Developer message:
"""${message}"""

JSON shape: {"action":"","agent":null,"session":null,"name":null,"prompt":null,"risk":"low","category":null,"reason":"","reply":null${attachmentNote ? ',"description":""' : ""}}`;
  return prompt;
}

// context: optional extra lines for the prompt, e.g. "Recent images in this chat: ...".
export async function route(message, sessions, context = "") {
  return extractJson(await generate(routePrompt(message, sessions, "", context)));
}

// A photo or PDF arrived (with an optional caption). Gemma looks at it and returns route()'s intent plus "description".
// att: { kind: "image" | "pdf", path (relative to the agent workspace), mime, base64 (images), text (PDF text) }
export async function routeWithAttachment(caption, sessions, att, context = "") {
  const what = att.kind === "pdf" ? "a PDF document" : "an image (photo, screenshot, sketch or mockup)";
  const note = `The developer attached ${what}. It is saved in the agent's workspace at ${att.path}.
${att.kind === "pdf" ? `Extracted text of the PDF (may be truncated):\n"""${(att.text || "(no text found)").slice(0, 15_000)}"""\n` : "The image is included above.\n"}
Also include "description": 1-2 plain sentences on what the attachment shows or contains.
If the message asks to edit or restyle the attached image itself ("make this blue", "remove the background"), use "spawn" with agent "codex" (unless another is named) and say to save the edited image as a new PNG under outputs/.
Otherwise, if the message is empty or asks to build, make, fix, add or change something, use "spawn" (agent claude unless another is named) and write "prompt" as a complete task for the agent: say the reference file is at ${att.path} and that it must open it and use it, then describe concretely what to build or fix based on what you see.
If the message only asks a question about the attachment ("what is this?", "summarize this"), use "chat" and put the answer in "reply" (WhatsApp-sized, max 8 short lines).

`;
  const image = att.kind === "image" ? { mime: att.mime, base64: att.base64 } : null;
  const intent = extractJson(await generate(routePrompt(caption || "(no message, only the attachment)", sessions, note, context), 1200, image));
  if (["spawn", "send"].includes(intent.action) && !String(intent.prompt || "").includes(att.path)) {
    intent.prompt = `${intent.prompt || "Build what the attached reference shows."}\n\nReference file: ${att.path} (open it and use it).`;
  }
  if (["spawn", "send"].includes(intent.action) && intent.description) intent.prompt += `\nWhat Gemma saw in it: ${intent.description}`;
  return intent;
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
