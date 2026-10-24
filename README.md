# Hukam

**Command your coding agents from WhatsApp.**

*Hukam* (حکم) is Urdu for "command". You message your own WhatsApp number in plain English, Urdu or Roman Urdu, by text or voice note. Gemma 4 works out what you mean. Hukam starts or messages the right coding agent (Claude Code, Codex, OpenCode) through Superset, then sends you a short summary on WhatsApp when the agent finishes. A live dashboard shows each step over DNotifier realtime.

Built at Hacktoberfest Hack Day Lahore × Cloud Native Security Pakistan, 24 October 2026.

## Why

Developers now run several AI agents in parallel. When you leave your desk, they all stall waiting for you. Hukam puts them in your pocket without opening a port on your laptop or adding a new app.

## How it works

```
Phone (WhatsApp)
   │
   ▼
WhatsApp MCP daemon  (github.com/Sealjay/mcp-whatsapp, MIT)
   │  list_messages / send_message over HTTP MCP
   ▼
Hukam router  (this repo)
   ├─ Voice note? whisper.cpp transcribes it locally (offline) ──► text
   ├─ Gemma 4 via Gemini API: message ──► {action, agent, session, prompt, risk}
   ├─ Risk gate: risky tasks wait for "yes <code>" on WhatsApp
   ├─ Superset CLI: agents create / terminals send / agents wait / terminals read
   ├─ DNotifier realtime ──► live dashboard (localhost:4747)
   └─ When an agent settles: Gemma squashes its terminal into 3 lines ──► WhatsApp
```

| Part | Role |
|---|---|
| `src/router.mjs` | Polls WhatsApp, routes each message, tracks sessions, risk gate, approvals |
| `src/gemma.mjs` | Gemma 4 intent routing and result summaries (Gemini API) |
| `src/superset.mjs` | Spawns, messages, waits on and reads terminal agents via the Superset CLI |
| `src/whatsapp.mjs` | Client for the WhatsApp MCP daemon |
| `src/preview.mjs` | Headless Chrome screenshot of the agent's page, sent back to WhatsApp |
| `src/voice.mjs` | Voice notes: ffmpeg + whisper.cpp, fully local |
| `src/bus.mjs` | Event stream to the dashboard: DNotifier realtime, local SSE fallback |
| `public/index.html` | Live dashboard: WhatsApp feed, Gemma decisions, agent cards |

## What you can send

| Message | What happens |
|---|---|
| `codex se auth module ke tests likhwao` | Gemma picks `spawn`, agent `codex`, writes an English prompt |
| `claude: add a dark mode toggle` | Starts a Claude Code session |
| `@dark-mode-toggle make it remember the choice` | Follow-up to an existing session |
| 🎙️ *"Claude, add a footer with our address"* | Voice note: transcribed locally, echoed back, then routed like text |
| 🖼️ photo / screenshot of a sketch, mockup or bug, captioned "build this" or nothing | Gemma 4 looks at the image, replies "👀 Gemma sees: …", and starts an agent pointed at the saved image (`inbox/<id>.jpg`) |
| 📄 PDF (spec, menu, brief) + "build a page from this" | Text extracted with `pdftotext`, Gemma plans the task, the agent gets the PDF and its text in `inbox/` |
| 🖼️/📄 + "what is this?" / "summarize" | Gemma answers in chat, no agent started |
| *(automatic)* | When an agent changes the page, Hukam screenshots it in headless Chrome and sends the picture: a live preview on your phone |
| `list` | All sessions and their state |
| `stop dark-mode-toggle` | Closes that session |
| `yes k3f9` / `no k3f9` | Approves or cancels a task Gemma flagged as risky |

**Group mode.** Add Hukam to a WhatsApp group and list its JID in `WA_GROUPS`. Any member can send text or voice notes there; Hukam reacts, routes and posts agent updates back in the group, addressing the sender by name.

## Security

- **Allowlist.** Only numbers in `WA_ALLOW` and groups in `WA_GROUPS` are read. Everyone else, and every other group, is ignored.
- **Owner-only controls.** In groups anyone can start or follow up on agents, but only the owner (`WA_OWNER`, matched by phone or LID) can approve risky tasks (`yes <code>`) or `stop` an agent.
- **Secrets.** Requests to read or send `.env` files, keys, tokens or files outside the workspace are rated high risk and need the owner's approval; agents are also told never to reveal secrets.
- **Risk gate.** Gemma rates every task. Anything that could push, deploy, delete, touch secrets or spend money waits for an explicit `yes <code>` reply.
- **Guardrail prompt.** Every spawned agent is told to stay inside its workspace and not push or deploy.
- **Isolation.** Agents run in a separate Superset worktree, not your main checkout.
- **Attachments.** Photos and PDFs (max 8 MB) are saved only inside the agent sandbox (`<workspace>/inbox/`); Gemma sees them via the Gemini API. The dashboard serves them read-only with strict filename checks.
- **Audit trail.** Every message, decision and agent state change is streamed to the dashboard and logged.
- **No inbound ports.** The WhatsApp daemon binds to loopback. Hukam only makes outbound calls.
- **Fallbacks.** Gemma is tried on the Gemini API (26B, then 31B), then on Vertex AI, with retries on rate limits. If every backend fails, a strict regex parser (`claude: <task>`, `@name <msg>`, `list`) keeps working, and agent summaries fall back to the agent's own closing lines.
- **Voice stays local.** Voice notes are transcribed on your machine with whisper.cpp; audio is never sent to a cloud API.

Known limits: the WhatsApp daemon uses the unofficial `whatsmeow` multi-device protocol, so use a spare number. The dashboard receives DNotifier credentials from localhost and is for local demo use only.

## Run it

Requirements: Node 20+, ffmpeg, [whisper.cpp](https://github.com/ggml-org/whisper.cpp) (`brew install whisper-cpp` plus a `ggml-base.bin` model) for voice notes, the [Superset](https://superset.sh) CLI with a local workspace, a running [mcp-whatsapp](https://github.com/Sealjay/mcp-whatsapp) daemon paired to a spare number, and a Gemini API key.

```bash
npm install
cp .env.example .env   # fill in GEMINI_API_KEY, WA_ALLOW, HUKAM_WORKSPACE, optional DNOTIFIER_*
npm start
open http://localhost:4747
```

Then message the paired number from an allowlisted phone: `help`.

## Models and licences

- **Gemma 4** (`gemma-4-26b-a4b-it`, fallback `gemma-4-31b-it`) through the Gemini API, with Vertex AI as a backup. Open weights under the [Gemma Terms of Use](https://ai.google.dev/gemma/terms).
- **Whisper** (`ggml-base`) via [whisper.cpp](https://github.com/ggml-org/whisper.cpp), MIT. Open-weight speech recognition, run locally.
- **mcp-whatsapp** by Sealjay, [MIT](https://github.com/Sealjay/mcp-whatsapp/blob/main/LICENSE).
- **DNotifier** JavaScript SDK `@dnotifier-realtime/dnotifier` for realtime events.

## Contributed upstream

Building Hukam surfaced a gap in the WhatsApp MCP daemon: text messages had no visible ID, so they could not be reacted to or marked read. We fixed it and sent it back: [Sealjay/mcp-whatsapp#82](https://github.com/Sealjay/mcp-whatsapp/pull/82).

## Licence

Apache-2.0. See [LICENSE](LICENSE).
