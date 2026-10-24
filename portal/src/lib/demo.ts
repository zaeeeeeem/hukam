// Demo mode (?demo=1): a scripted Hukam that fills every page with realistic traffic, so the portal can be
// presented with no live WhatsApp messages. Everything here is local to the browser and clearly marked as demo.
import type {
  AgentKind,
  Chat,
  Decision,
  GalleryItem,
  Health,
  HukamEvent,
  HukamState,
  Intent,
  PendingApproval,
  Session,
  Settings,
} from "./types";

const svg = (body: string, w = 640, h = 480) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${body}</svg>`)}`;

export const DEMO_IMG = {
  logo: (cup: string, bg: string) =>
    svg(
      `<rect width="640" height="640" fill="${bg}"/><circle cx="320" cy="300" r="190" fill="none" stroke="${cup}" stroke-width="10" opacity=".25"/>
<path d="M210 260h200v70a100 100 0 0 1-200 0z" fill="${cup}"/><path d="M410 280h28a38 38 0 0 1 0 76h-34" fill="none" stroke="${cup}" stroke-width="18" stroke-linecap="round"/>
<path d="M260 170c-16 24 16 36 0 60M310 160c-16 24 16 36 0 60M360 170c-16 24 16 36 0 60" fill="none" stroke="${cup}" stroke-width="10" stroke-linecap="round" opacity=".7"/>
<rect x="190" y="420" width="260" height="10" rx="5" fill="${cup}" opacity=".5"/>
<text x="320" y="520" text-anchor="middle" font-family="Georgia, serif" font-size="44" font-weight="700" fill="${cup}" letter-spacing="6">CHAI WALA</text>`,
      640,
      640,
    ),
  sketch: () =>
    svg(
      `<rect width="640" height="480" fill="#efe9dc"/><g fill="none" stroke="#3b3b3b" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" opacity=".85">
<path d="M48 44l545 4-3 390-542-3z"/><path d="M70 74h120M470 72l90 2M420 74h30"/><path d="M90 150c120-6 260-4 330 2M90 190c90-3 170-2 230 1"/>
<path d="M92 236h116l2 40-118-1z"/><path d="M92 320l140-2 2 92-142 1zM252 318l140 1-1 93-140-2zM412 317l140 2 1 92-142-1z"/>
<path d="M470 130l90 4-4 140-88-2z"/><path d="M482 260l64-110"/></g>
<text x="98" y="262" font-family="Comic Sans MS, cursive" font-size="20" fill="#3b3b3b">Sign up</text>
<text x="472" y="110" font-family="Comic Sans MS, cursive" font-size="18" fill="#3b3b3b">photo</text>`,
    ),
  preview: (title: string, accent: string) =>
    svg(
      `<rect width="640" height="400" fill="#0d1117"/><rect width="640" height="44" fill="#161b22"/><circle cx="28" cy="22" r="8" fill="${accent}"/>
<rect x="46" y="16" width="90" height="12" rx="6" fill="#e6edf3" opacity=".8"/><rect x="420" y="16" width="50" height="12" rx="6" fill="#8b949e"/><rect x="484" y="16" width="50" height="12" rx="6" fill="#8b949e"/>
<rect x="548" y="12" width="70" height="20" rx="10" fill="${accent}"/><text x="48" y="120" font-family="Helvetica, Arial" font-size="34" font-weight="700" fill="#e6edf3">${title}</text>
<rect x="48" y="140" width="340" height="10" rx="5" fill="#8b949e" opacity=".7"/><rect x="48" y="160" width="280" height="10" rx="5" fill="#8b949e" opacity=".5"/>
<rect x="48" y="190" width="120" height="34" rx="17" fill="${accent}"/><rect x="420" y="84" width="180" height="150" rx="14" fill="${accent}" opacity=".25"/>
<g fill="#161b22" stroke="#30363d"><rect x="48" y="262" width="170" height="100" rx="12"/><rect x="235" y="262" width="170" height="100" rx="12"/><rect x="422" y="262" width="170" height="100" rx="12"/></g>
<rect x="64" y="280" width="90" height="10" rx="5" fill="#e6edf3" opacity=".7"/><rect x="251" y="280" width="90" height="10" rx="5" fill="#e6edf3" opacity=".7"/><rect x="438" y="280" width="90" height="10" rx="5" fill="#e6edf3" opacity=".7"/>
<rect x="48" y="376" width="544" height="1" fill="#30363d"/><rect x="48" y="386" width="220" height="8" rx="4" fill="#8b949e" opacity=".5"/>`,
      640,
      400,
    ),
  mountain: () =>
    svg(
      `<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1f77f6"/><stop offset="1" stop-color="#ffb37a"/></linearGradient></defs>
<rect width="640" height="480" fill="url(#s)"/><path d="M0 400l120-170 70 80 130-210 120 170 70-60 130 190z" fill="#e8edf5"/><path d="M0 480V400l120-170 70 80 130-210 120 170 70-60 130 190v80z" fill="#2d3b55" opacity=".55"/>
<g transform="translate(400 120) rotate(-18)"><ellipse cx="0" cy="0" rx="34" ry="9" fill="#da4e24"/><circle cx="-26" cy="-6" r="9" fill="#2b2b2b"/><path d="M-10 4l-22 26M6 4l12 24" stroke="#2b2b2b" stroke-width="5"/></g>`,
    ),
};

const OWNER = "923124487312";
const GROUP = "120363414024669346@g.us";
const ME_LID = "237077966905376";

const MEMBERS = {
  ayesha: { name: "Ayesha Khan", phone: "923001234567" },
  hamza: { name: "Hamza Ali", phone: "923214567890" },
  sana: { name: "Sana Malik", phone: "923335551234" },
};

type Step = { after: number; run: () => void };

let traceSeq = 0;
const newTrace = () => `demo${(++traceSeq).toString(36)}${Math.random().toString(36).slice(2, 5)}`;

function settings(): Settings {
  return {
    allow: [OWNER],
    groups: [GROUP],
    owner: OWNER,
    ownerLid: ME_LID,
    defaultAgent: "claude",
    models: { claude: "sonnet", codex: "", opencode: "" },
    gemma: { backends: ["gemini-api", "vertex"], model: "gemma-4-26b-a4b-it", fallbackModel: "gemma-4-31b-it" },
    risk: { gate: true, categories: { push: true, deploy: true, delete: true, secrets: true, infra: true, messaging: true, spend: true } },
    acks: ["👀", "🫡", "⚡", "🔥", "🚀", "🧠", "🛠️", "👍", "✨", "🤝"],
    voice: { enabled: true, whisperModel: "/Users/you/services/whisper/ggml-base.bin" },
    attachments: { enabled: true, maxMb: 8 },
    preview: { enabled: true },
    artifacts: { enabled: true },
    pollMs: 2000,
  };
}

export class DemoEngine {
  state: HukamState;
  events: HukamEvent[] = [];
  private seq = 0;
  private listeners = new Set<() => void>();
  timers = new Set<ReturnType<typeof setTimeout>>();
  virtual: number | null = null;
  private loopIndex = 0;
  private trace: string | null = null;
  private gallery: GalleryItem[] = [];

  constructor() {
    const now = Date.now();
    this.state = {
      now,
      startedAt: now - 3 * 3600_000 - 12 * 60_000,
      owner: { phone: OWNER, lid: ME_LID },
      sessions: [],
      chats: this.chats(),
      approvals: { pending: [], history: [] },
      settings: settings(),
      keys: { gemini: true, vertex: true, dnotifier: true, workspace: true },
      fixed: { dashboardPort: 4747, daemon: "http://127.0.0.1:8767/mcp", workspaceDir: null },
      options: { agents: ["claude", "codex", "opencode"], backends: ["gemini-api", "vertex"], riskCategories: ["push", "deploy", "delete", "secrets", "infra", "messaging", "spend"] },
      gemma: {
        chain: "gemini-api:gemma-4-26b-a4b-it > gemini-api:gemma-4-31b-it > vertex:gemma-4-26b-a4b-it",
        lastServed: { key: "gemini-api:gemma-4-26b-a4b-it", via: "gemini-api", model: "gemma-4-26b-a4b-it", ms: 812, at: now - 40_000 },
        backends: [
          { key: "gemini-api:gemma-4-26b-a4b-it", via: "gemini-api", model: "gemma-4-26b-a4b-it", calls: 41, failures: 2, lastMs: 812, lastOkAt: now - 40_000, lastError: "Gemma 429: Resource has been exhausted (e.g. check quota).", lastErrorAt: now - 52 * 60_000 },
          { key: "gemini-api:gemma-4-31b-it", via: "gemini-api", model: "gemma-4-31b-it", calls: 2, failures: 0, lastMs: 1460, lastOkAt: now - 52 * 60_000, lastError: null, lastErrorAt: null },
          { key: "vertex:gemma-4-26b-a4b-it", via: "vertex", model: "gemma-4-26b-a4b-it", calls: 0, failures: 0, lastMs: null, lastOkAt: null, lastError: null, lastErrorAt: null },
        ],
        configured: { gemini: true, vertex: true },
      },
      dnotifier: { configured: true, connected: true, lastError: null },
    };
    this.seedHistory(now);
  }

  private chats(): Chat[] {
    return [
      { id: OWNER, kind: "dm", label: "Owner", allowed: true, owner: true, members: [], images: [], awaiting: null, sessions: [] },
      {
        id: GROUP,
        kind: "group",
        label: "Hukam × Hacktoberfest",
        allowed: true,
        owner: false,
        members: [
          { phone: OWNER, lid: ME_LID, name: "Zaeem", owner: true },
          { phone: MEMBERS.ayesha.phone, lid: "153459886190766", name: MEMBERS.ayesha.name, owner: false },
          { phone: MEMBERS.hamza.phone, lid: "149930021187721", name: MEMBERS.hamza.name, owner: false },
          { phone: MEMBERS.sana.phone, lid: "160022738819002", name: MEMBERS.sana.name, owner: false },
          { phone: "14502570585", lid: "153459886190767", name: "Hukam", owner: false },
        ],
        images: [],
        awaiting: null,
        sessions: [],
      },
    ];
  }

  // --- plumbing -------------------------------------------------------------------------------------------

  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private changed() {
    this.state = { ...this.state, now: this.now() };
    this.listeners.forEach((l) => l());
  }
  private now() {
    return this.virtual ?? Date.now();
  }
  emit(type: HukamEvent["type"], data: Record<string, unknown>) {
    const e = { id: ++this.seq, type, at: new Date(this.now()).toISOString(), ...(this.trace && { trace: this.trace }), ...data } as HukamEvent;
    this.events = [...this.events, e].slice(-600);
    return e;
  }
  private chatLabel(chat: string) {
    return chat === GROUP ? "Hukam × Hacktoberfest" : "DM";
  }
  private session(name: string) {
    return this.state.sessions.find((s) => s.name === name);
  }
  private patchSession(name: string, patch: Partial<Session>) {
    this.state.sessions = this.state.sessions.map((s) => (s.name === name ? { ...s, ...patch, updatedAt: this.now() } : s));
  }
  private uniqueName(base: string) {
    let name = base;
    for (let i = 2; this.session(name); i++) name = `${base}-${i}`;
    return name;
  }
  rememberPhoto(chat: string, path: string, url: string) {
    this.rememberImage(chat, { path, url, source: "user" });
  }
  private rememberImage(chat: string, img: { path: string; url: string; source: "user" | "agent"; session?: string }) {
    this.state.chats = this.state.chats.map((c) => (c.id === chat ? { ...c, images: [{ ...img, at: this.now() }, ...c.images].slice(0, 5) } : c));
  }

  /** Runs steps in order. Instant mode (history) applies them at once on a virtual clock. */
  play(trace: string, steps: Step[], instantAt?: number) {
    if (instantAt != null) {
      let at = instantAt;
      for (const s of steps) {
        at += s.after;
        this.virtual = at;
        this.trace = trace;
        s.run();
      }
      this.virtual = null;
      this.trace = null;
      return;
    }
    let delay = 0;
    for (const s of steps) {
      delay += s.after;
      const timer = setTimeout(() => {
        this.timers.delete(timer);
        this.trace = trace;
        s.run();
        this.trace = null;
        this.changed();
      }, delay);
      this.timers.add(timer);
    }
  }

  start() {
    const tick = () => {
      const scenario = LOOP[this.loopIndex++ % LOOP.length];
      scenario(this);
      const timer = setTimeout(tick, 17_000);
      this.timers.add(timer);
    };
    const first = setTimeout(tick, 2_500);
    this.timers.add(first);
  }
  stop() {
    this.timers.forEach(clearTimeout);
    this.timers.clear();
  }

  // --- building blocks used by the scenarios ----------------------------------------------------------------

  inbound(chat: string, from: { name: string | null; phone: string } | "owner", text: string, extra: Record<string, unknown> = {}) {
    const owner = from === "owner";
    this.emit("inbound", {
      from: owner ? (chat === GROUP ? "Zaeem" : "7312") : from.name,
      chat: this.chatLabel(chat),
      chatId: chat,
      owner,
      text,
      voice: false,
      phone: owner ? OWNER : from.phone,
      ...extra,
    });
  }
  intent(chat: string, intent: Intent, ms = 700 + Math.round(Math.random() * 400), model = "gemini-api:gemma-4-26b-a4b-it") {
    this.emit("intent", { model, ms, intent, chatId: chat });
    if (model.startsWith("gemini") || model.startsWith("vertex")) {
      const backends = this.state.gemma.backends.map((b) => (b.key === model ? { ...b, calls: b.calls + 1, lastMs: ms, lastOkAt: this.now() } : b));
      this.state.gemma = { ...this.state.gemma, backends, lastServed: { key: model, via: model.split(":")[0], model: model.split(":")[1], ms, at: this.now() } };
    }
  }
  reply(chat: string, text: string, attachment?: { kind: "image"; url: string; name: string }) {
    this.emit("reply", { text, chat: this.chatLabel(chat), chatId: chat, ...(attachment && { attachment }) });
  }
  spawn(chat: string, agent: AgentKind, base: string, prompt: string, from: string | null) {
    const name = this.uniqueName(base);
    const now = this.now();
    this.state.sessions = [
      { name, agent, status: "working", prompt, model: agent === "claude" ? "sonnet" : null, chatId: chat, chat: this.chatLabel(chat), from, createdAt: now, updatedAt: now, finishedAt: null, summary: null, artifacts: [], previews: [], followUps: [] },
      ...this.state.sessions,
    ];
    this.state.chats = this.state.chats.map((c) => (c.id === chat ? { ...c, sessions: [name, ...c.sessions] } : c));
    this.emit("spawn", { name, agent, prompt, chatId: chat, chat: this.chatLabel(chat) });
    this.emit("status", { name, status: "working", chatId: chat });
    const who = chat === GROUP && from ? `${from.split(" ")[0]}, started` : "Started";
    this.reply(chat, `🚀 ${who} *${name}* on ${agent}.\nI'll message ${chat === GROUP ? "here" : "you"} when it's done.`);
    return name;
  }
  finish(name: string, summary: string, opts: { artifact?: { path: string; url: string }; preview?: string; blocked?: boolean } = {}) {
    const s = this.session(name);
    if (!s || s.status === "stopped") return;
    const chat = s.chatId || OWNER;
    const state = opts.blocked ? "blocked" : "idle";
    this.patchSession(name, { status: state, summary, finishedAt: this.now() });
    this.emit("status", { name, status: state, chatId: chat });
    this.emit("done", { name, state, summary, chatId: chat, model: "gemini-api:gemma-4-26b-a4b-it", ms: 640 });
    if (opts.blocked) {
      this.reply(chat, `🔐 *${name}* needs you:\n${summary}\n\nReply \`@${name} <answer>\` or \`stop ${name}\`.`);
      return;
    }
    this.reply(chat, `✅ *${name}* finished:\n${summary}\n\nFollow up with \`@${name} <message>\`.`);
    if (opts.artifact) {
      const a = { ...opts.artifact, at: this.now() };
      this.patchSession(name, { artifacts: [a, ...(this.session(name)?.artifacts ?? [])] });
      this.rememberImage(chat, { path: a.path, url: a.url, source: "agent", session: name });
      this.reply(chat, `🎨 ${name}: ${a.path}`, { kind: "image", url: a.url, name: a.path.split("/").pop()! });
      this.emit("artifact", { name, path: a.path, url: a.url, chatId: chat });
      this.gallery.unshift({ url: a.url, name: a.path.split("/").pop()!, kind: "image", source: "agent", at: this.now(), size: 412_000, session: name, chatId: chat });
    }
    if (opts.preview) {
      this.patchSession(name, { previews: [{ url: opts.preview, at: this.now() }, ...(this.session(name)?.previews ?? [])] });
      this.emit("preview", { name, url: opts.preview, chatId: chat });
      this.gallery.unshift({ url: opts.preview, name: `hukam-${name}-preview.png`, kind: "image", source: "preview", at: this.now(), size: 182_000, session: name, chatId: chat });
    }
  }
  gate(chat: string, intent: Intent, from: string | null) {
    const code = Math.random().toString(36).slice(2, 6);
    const p: PendingApproval = {
      code,
      prompt: intent.prompt || "",
      reason: intent.reason || null,
      category: intent.category || null,
      action: intent.action,
      agent: intent.agent || null,
      session: intent.session || null,
      chatId: chat,
      chat: this.chatLabel(chat),
      from,
      at: this.now(),
    };
    this.state.approvals = { ...this.state.approvals, pending: [p, ...this.state.approvals.pending] };
    this.emit("gate", { code, reason: intent.reason, prompt: intent.prompt, category: intent.category, chatId: chat, chat: this.chatLabel(chat), from });
    const ask = chat === GROUP ? `The owner must approve: \`yes ${code}\` to run or \`no ${code}\` to cancel.` : `Reply \`yes ${code}\` to run or \`no ${code}\` to cancel.`;
    this.reply(chat, `⚠️ Gemma flagged this as risky: ${intent.reason}\n\n"${intent.prompt}"\n\n${ask}`);
    return { code, trace: this.trace };
  }

  /** Approve/cancel. Continues inside the trace that asked, like the router. */
  decideNow(code: string, ok: boolean, via: "portal" | "whatsapp", trace: string | null) {
    const p = this.state.approvals.pending.find((x) => x.code === code);
    if (!p) return false;
    const prevTrace = this.trace;
    this.trace = trace ?? prevTrace;
    const d: Decision = { code, ok, via, at: this.now(), askedAt: p.at ?? undefined, prompt: p.prompt, reason: p.reason, category: p.category, chatId: p.chatId, chat: p.chat, from: p.from };
    this.state.approvals = { pending: this.state.approvals.pending.filter((x) => x.code !== code), history: [d, ...this.state.approvals.history] };
    this.emit("approval", { code, ok, via, prompt: p.prompt, chatId: p.chatId });
    if (!ok) {
      this.reply(p.chatId, "❌ Cancelled.");
      this.trace = prevTrace;
      return true;
    }
    const name = this.spawn(p.chatId, (p.agent as AgentKind) || "claude", "deploy-landing", p.prompt, p.from);
    const t = this.trace;
    this.trace = prevTrace;
    this.play(t || newTrace(), [{ after: 9000, run: () => this.finish(name, "Built the landing page and deployed it to the preview URL.\nhttps://chai-wala-demo.vercel.app is live; production alias updated.") }], this.virtual ?? undefined);
    return true;
  }

  // --- history: what happened before the presenter opened the portal ----------------------------------------

  private seedHistory(now: number) {
    const ago = (m: number) => now - m * 60_000;
    HISTORY.forEach(([minutes, scenario]) => scenario(this, ago(minutes)));
    // One risky task still waiting for the owner, and one agent that needs an answer.
    this.events.sort((a, b) => Date.parse(a.at) - Date.parse(b.at)).forEach((e, i) => (e.id = i + 1));
    this.seq = this.events.length;
    this.gallery.push(
      { url: DEMO_IMG.sketch(), name: "3EB0C4A1F2.jpg", kind: "image", source: "user", at: ago(44), size: 1_820_000, chatId: OWNER, chat: "DM", from: "Owner", text: "build this" },
      { url: DEMO_IMG.mountain(), name: "flying-guy-k2.png", kind: "image", source: "agent", at: ago(96), size: 1_240_000, session: "flying-guy-k2", chatId: OWNER },
      { url: "", name: "3EB0D19C77.pdf", kind: "pdf", source: "user", at: ago(31), size: 412_000, chatId: GROUP, chat: "Hukam × Hacktoberfest", from: MEMBERS.sana.name, text: "menu page banao is se" },
    );
  }

  // --- portal actions -------------------------------------------------------------------------------------

  command(text: string, chat = OWNER) {
    const trace = newTrace();
    const lower = text.trim().toLowerCase();
    const steps: Step[] = [{ after: 0, run: () => this.inbound(chat, "owner", text, { source: "portal" }) }];
    if (/^(list|ls|sessions|status)$/.test(lower)) {
      steps.push({ after: 300, run: () => this.intent(chat, { action: "list", risk: "low" }, 0, "fast-path") });
      steps.push({ after: 400, run: () => this.reply(chat, this.state.sessions.slice(0, 6).map((s) => `• *${s.name}* (${s.agent}) ${s.status}`).join("\n")) });
    } else if (/^(help|\?)$/.test(lower)) {
      steps.push({ after: 300, run: () => this.intent(chat, { action: "help", risk: "low" }, 0, "fast-path") });
      steps.push({ after: 300, run: () => this.reply(chat, "*Hukam* — command your agents from WhatsApp\n• Just say what you want\n• `claude: <task>` start an agent\n• `@name <message>` follow up\n• `list` see all agents") });
    } else if (/deploy|push|production|\.env|secret|drop table|delete/.test(lower)) {
      const intent: Intent = { action: "spawn", agent: "claude", name: "deploy-landing", prompt: text, risk: "high", category: /\.env|secret/.test(lower) ? "secrets" : /push/.test(lower) ? "push" : /delete|drop/.test(lower) ? "delete" : "deploy", reason: "Affects something outside the sandbox." };
      steps.push({ after: 900, run: () => this.intent(chat, intent) });
      steps.push({ after: 300, run: () => this.gate(chat, intent, null) });
    } else if (/^@([\w-]+)\s+(.+)/.test(text.trim())) {
      const [, name, prompt] = text.trim().match(/^@([\w-]+)\s+(.+)/)!;
      steps.push({ after: 0, run: () => void 0 });
      if (this.session(name)) {
        steps.push({ after: 300, run: () => this.intent(chat, { action: "send", session: name, prompt, risk: "low" }, 0, "fast-path") });
        steps.push({ after: 300, run: () => this.followUpNow(name, prompt) });
        steps.push({ after: 7000, run: () => this.finish(name, "Applied the follow-up and reloaded the page.") });
      } else {
        steps.push({ after: 300, run: () => this.reply(chat, `No session named ${name}.`) });
      }
    } else {
      const agent: AgentKind = /^codex|image|logo|poster|icon/.test(lower) ? "codex" : /^opencode/.test(lower) ? "opencode" : "claude";
      const base = lower.replace(/^(claude|codex|opencode)\s*:?\s*/, "").split(/\s+/).filter((w) => w.length > 2).slice(0, 3).join("-").replace(/[^a-z0-9-]/g, "") || "task";
      const prompt = text.replace(/^(claude|codex|opencode)\s*:?\s*/i, "");
      steps.push({ after: 900, run: () => this.intent(chat, { action: "spawn", agent, name: base, prompt, risk: "low", reason: "Code change inside the sandboxed workspace." }) });
      let name = "";
      steps.push({ after: 300, run: () => (name = this.spawn(chat, agent, base, prompt, null)) });
      steps.push({
        after: 9000,
        run: () =>
          this.finish(
            name,
            agent === "codex" ? "Generated the image and saved it under outputs/." : "Made the change in index.html and checked it renders.\nNothing else touched.",
            agent === "codex" ? { artifact: { path: `outputs/${base}.png`, url: DEMO_IMG.logo("#1f77f6", "#f5efe4") } } : { preview: DEMO_IMG.preview("Shipped from WhatsApp", "#da4e24") },
          ),
      });
    }
    this.play(trace, steps);
    return trace;
  }

  followUpNow(name: string, prompt: string) {
    const s = this.session(name);
    if (!s) return;
    this.patchSession(name, { status: "working", followUps: [{ prompt, at: this.now(), from: "Owner (portal)" }, ...s.followUps] });
    this.emit("send", { name, prompt, chatId: s.chatId });
    this.emit("status", { name, status: "working", chatId: s.chatId });
    this.reply(s.chatId || OWNER, `➡️ Sent to *${name}*.`);
  }

  followUp(name: string, text: string) {
    const trace = newTrace();
    this.play(trace, [
      { after: 0, run: () => this.followUpNow(name, text) },
      { after: 7000, run: () => this.finish(name, "Applied the follow-up. The page reloads with the change.", { preview: DEMO_IMG.preview("Updated from the portal", "#1f77f6") }) },
    ]);
    return trace;
  }

  stopSession(name: string) {
    const s = this.session(name);
    if (!s) return;
    this.patchSession(name, { status: "stopped" });
    this.emit("status", { name, status: "stopped", chatId: s.chatId });
    this.reply(s.chatId || OWNER, `⏹️ Stopped *${name}*.`);
    this.changed();
  }

  decide(code: string, ok: boolean) {
    const gateEvent = this.events.find((e) => e.type === "gate" && e.code === code);
    const done = this.decideNow(code, ok, "portal", gateEvent?.trace ?? null);
    this.changed();
    return done;
  }

  saveSettings(patch: Partial<Settings>) {
    this.state.settings = { ...this.state.settings, ...patch };
    this.emit("settings", { changed: true });
    this.changed();
    return this.state.settings;
  }

  health(): Health {
    const now = Date.now();
    return {
      now,
      router: { ok: true, startedAt: this.state.startedAt, uptimeMs: now - this.state.startedAt, pid: 48213, node: "v24.16.0", pollMs: 2000, poll: { lastOkAt: now - 1200, lastErrorAt: now - 41 * 60_000, lastError: "list_messages: context deadline exceeded", polls: 5412 } },
      whatsapp: { ok: true, connected: true, paired: true, phone: "14502570585", latencyMs: 14, error: null, daemon: "http://127.0.0.1:8767/mcp" },
      gemma: { ...this.state.gemma, ok: true },
      superset: { ok: true, version: "1.40.0", error: null, workspace: true },
      whisper: { ok: true, enabled: true, binary: "/opt/homebrew/bin/whisper-cli", ffmpeg: true, model: "/Users/you/services/whisper/ggml-base.bin", modelExists: true },
      chrome: { ok: true, path: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" },
      pdftotext: { ok: true },
      dnotifier: { configured: true, connected: true, lastError: null },
      errors: [
        { at: now - 41 * 60_000, scope: "poll", message: "list_messages: context deadline exceeded" },
        { at: now - 52 * 60_000, scope: "gemma", message: "gemini-api:gemma-4-26b-a4b-it Gemma 429: Resource has been exhausted (e.g. check quota)." },
        { at: now - 63 * 60_000, scope: "groups", message: "list_groups: list joined groups: info query returned status 429: rate-overlimit" },
      ],
    };
  }

  galleryItems() {
    return [...this.gallery].sort((a, b) => b.at - a.at);
  }

  terminal(name: string) {
    const s = this.session(name);
    if (!s) return null;
    return [
      `> ${s.prompt}`,
      "",
      "⏺ Read(index.html)",
      "  ⎿  Read 182 lines",
      "",
      s.status === "working" ? "⏺ Update(index.html)" : "⏺ Update(index.html)",
      "  ⎿  Updated index.html with 24 additions and 3 removals",
      "",
      s.summary ? `⏺ ${s.summary.split("\n")[0]}` : "✻ Working… (esc to interrupt)",
    ].join("\n");
  }
}

// --- scripted scenarios -------------------------------------------------------------------------------------
// Each takes the engine and an optional start time (history); without a start time it plays live.

type Scenario = (d: DemoEngine, at?: number) => void;

const voiceFooter: Scenario = (d, at) => {
  const text = "claude se kaho footer mein hamara address aur opening hours daal de";
  let name = "";
  d.play(
    newTrace(),
    [
      { after: 0, run: () => d.inbound(OWNER, "owner", text, { voice: true }) },
      { after: 1400, run: () => d.emit("voice", { text, ms: 1380, chatId: OWNER, chat: "DM", from: null }) },
      { after: 820, run: () => d.intent(OWNER, { action: "spawn", agent: "claude", name: "footer-address-hours", prompt: "Add a footer to the page with the company address and opening hours.", risk: "low", reason: "Page edit inside the sandboxed workspace." }) },
      { after: 300, run: () => (name = d.spawn(OWNER, "claude", "footer-address-hours", "Add a footer to the page with the company address and opening hours.", "Owner")) },
      { after: 11000, run: () => d.finish(name, "Added a footer with the address (Gulberg III, Lahore) and opening hours.\nStyled to match the page; mobile layout checked.", { preview: DEMO_IMG.preview("Chai Wala, Gulberg", "#da4e24") }) },
    ],
    at,
  );
};

const groupLogo: Scenario = (d, at) => {
  let name = "";
  d.play(
    newTrace(),
    [
      { after: 0, run: () => d.inbound(GROUP, MEMBERS.ayesha, "codex make a flat logo for Chai Wala, warm brown and orange") },
      { after: 900, run: () => d.intent(GROUP, { action: "spawn", agent: "codex", name: "chai-wala-logo", prompt: "Create a flat minimalist logo of a steaming chai cup for 'Chai Wala' in warm brown and orange. Use your built-in image generation tool. Save it as PNG at outputs/chai-wala-logo.png.", risk: "low", reason: "Image generation inside the workspace." }) },
      { after: 300, run: () => (name = d.spawn(GROUP, "codex", "chai-wala-logo", "Create a flat minimalist logo of a steaming chai cup for 'Chai Wala' in warm brown and orange. Save it as PNG at outputs/chai-wala-logo.png.", MEMBERS.ayesha.name)) },
      { after: 12000, run: () => d.finish(name, "Generated the Chai Wala logo with the built-in image tool.\nSaved outputs/chai-wala-logo.png (1024×1024).", { artifact: { path: "outputs/chai-wala-logo.png", url: DEMO_IMG.logo("#7a3b12", "#f6e7d2") } }) },
    ],
    at,
  );
};

const logoBlue: Scenario = (d, at) => {
  const target = d.state.sessions.find((s) => s.name.startsWith("chai-wala-logo"))?.name;
  if (!target) return groupLogo(d, at);
  d.play(
    newTrace(),
    [
      { after: 0, run: () => d.inbound(GROUP, MEMBERS.ayesha, "make the previous logo blue") },
      { after: 860, run: () => d.intent(GROUP, { action: "send", session: target, prompt: "Edit outputs/chai-wala-logo.png: change the warm brown to deep blue (#1f77f6). Save it as a NEW PNG at outputs/chai-wala-logo-v2.png without overwriting the original.", risk: "low", reason: "Edits an image this chat made earlier." }) },
      { after: 300, run: () => d.followUpNow(target, "Edit outputs/chai-wala-logo.png: change the brown to deep blue. Save as outputs/chai-wala-logo-v2.png.") },
      { after: 9000, run: () => d.finish(target, "Recoloured the logo to deep blue.\nSaved outputs/chai-wala-logo-v2.png; the original is unchanged.", { artifact: { path: "outputs/chai-wala-logo-v2.png", url: DEMO_IMG.logo("#1f77f6", "#eef4ff") } }) },
    ],
    at,
  );
};

const riskyDeploy: Scenario = (d, at) => {
  const intent: Intent = { action: "spawn", agent: "claude", name: "deploy-landing", prompt: "Deploy the landing page to production on Vercel.", risk: "high", category: "deploy", reason: "Deploying to production affects the live site." };
  let gate: { code: string; trace: string | null } | null = null;
  const trace = newTrace();
  d.play(
    trace,
    [
      { after: 0, run: () => d.inbound(GROUP, MEMBERS.hamza, "deploy the landing page to production") },
      { after: 940, run: () => d.intent(GROUP, intent) },
      { after: 300, run: () => (gate = d.gate(GROUP, intent, MEMBERS.hamza.name)) },
    ],
    at,
  );
  // Live: if nobody decides in the portal, the owner says yes on the phone after a while.
  if (at == null) {
    const timer = setTimeout(() => {
      if (gate && d.state.approvals.pending.some((x) => x.code === gate!.code)) {
        const t2 = newTrace();
        d.play(t2, [
          { after: 0, run: () => d.inbound(GROUP, "owner", `yes ${gate!.code}`) },
          { after: 200, run: () => d.intent(GROUP, { action: "approval", ok: true, code: gate!.code }, 0, "fast-path") },
          { after: 100, run: () => d.decideNow(gate!.code, true, "whatsapp", trace) },
        ]);
      }
    }, 12_000);
    d.timers.add(timer);
  }
};

const sketchPhoto: Scenario = (d, at) => {
  let name = "";
  const url = DEMO_IMG.sketch();
  d.play(
    newTrace(),
    [
      { after: 0, run: () => (d.inbound(OWNER, "owner", "build this", { attachment: { kind: "image", url, name: "3EB0C4A1F2.jpg", size: 1_820_000 } }), d.rememberPhoto(OWNER, "inbox/3EB0C4A1F2.jpg", url)) },
      { after: 2100, run: () => d.intent(OWNER, { action: "spawn", agent: "claude", name: "landing-from-sketch", prompt: "Build the landing page in the sketch at inbox/3EB0C4A1F2.jpg: headline, sign-up button, photo on the right, three feature cards.", risk: "low", reason: "Build a page from a reference image.", description: "A hand-drawn wireframe: a headline, a Sign up button, a photo on the right and three cards below." }, 2080) },
      { after: 200, run: () => d.reply(OWNER, "👀 Gemma sees: A hand-drawn wireframe: a headline, a Sign up button, a photo on the right and three cards below.") },
      { after: 300, run: () => (name = d.spawn(OWNER, "claude", "landing-from-sketch", "Build the landing page in the sketch at inbox/3EB0C4A1F2.jpg.", "Owner")) },
      { after: 12000, run: () => d.finish(name, "Built the landing page from your sketch: hero, sign-up button, photo slot and three cards.\nPreview attached.", { preview: DEMO_IMG.preview("Your sketch, built", "#1f77f6") }) },
    ],
    at,
  );
};

const listCmd: Scenario = (d, at) => {
  d.play(
    newTrace(),
    [
      { after: 0, run: () => d.inbound(OWNER, "owner", "list") },
      { after: 120, run: () => d.intent(OWNER, { action: "list", risk: "low" }, 0, "fast-path") },
      { after: 300, run: () => d.reply(OWNER, d.state.sessions.slice(0, 5).map((s) => `• *${s.name}* (${s.agent}) ${s.status}`).join("\n") || "No agents yet.") },
    ],
    at,
  );
};

const judgeFollowUp: Scenario = (d, at) => {
  const target = d.state.sessions.find((s) => s.name.startsWith("landing-from-sketch"))?.name;
  if (!target) return listCmd(d, at);
  d.play(
    newTrace(),
    [
      { after: 0, run: () => d.inbound(GROUP, MEMBERS.sana, `@${target} make the headline bigger and add our team photo`) },
      { after: 200, run: () => d.intent(GROUP, { action: "send", session: target, prompt: "make the headline bigger and add our team photo", risk: "low" }, 0, "fast-path") },
      { after: 300, run: () => d.followUpNow(target, "make the headline bigger and add our team photo") },
      { after: 8000, run: () => d.finish(target, "Headline is now 64px; added a team photo block under the hero.\nWhich photo should I use? I left a placeholder.", { blocked: true }) },
    ],
    at,
  );
};

const pdfBrief: Scenario = (d, at) => {
  let name = "";
  d.play(
    newTrace(),
    [
      { after: 0, run: () => d.inbound(GROUP, MEMBERS.sana, "menu page banao is se", { attachment: { kind: "pdf", url: "", name: "3EB0D19C77.pdf", size: 412_000 } }) },
      { after: 1700, run: () => d.intent(GROUP, { action: "spawn", agent: "claude", name: "menu-page", prompt: "Build a menu page from the PDF at inbox/3EB0D19C77.pdf (text at inbox/3EB0D19C77.txt): categories, items and prices.", risk: "low", reason: "Build a page from a document.", description: "A two-page café menu: chai, parathas and desserts with prices in PKR." }, 1680) },
      { after: 200, run: () => d.reply(GROUP, "👀 Gemma sees: A two-page café menu: chai, parathas and desserts with prices in PKR.") },
      { after: 300, run: () => (name = d.spawn(GROUP, "claude", "menu-page", "Build a menu page from the PDF at inbox/3EB0D19C77.pdf.", MEMBERS.sana.name)) },
      { after: 10000, run: () => d.finish(name, "Built menu.html with 3 sections and 18 items from the PDF.\nPrices in PKR; linked from the nav.", { preview: DEMO_IMG.preview("Menu · Chai Wala", "#34d399") }) },
    ],
    at,
  );
};

const HISTORY: [number, Scenario][] = [
  [96, (d, at) => {
    let name = "";
    d.play(newTrace(), [
      { after: 0, run: () => d.inbound(OWNER, "owner", "claude: add a dark mode toggle to the landing page") },
      { after: 760, run: () => d.intent(OWNER, { action: "spawn", agent: "claude", name: "dark-mode-toggle", prompt: "Add a dark mode toggle to the landing page.", risk: "low", reason: "UI change inside the workspace." }) },
      { after: 300, run: () => (name = d.spawn(OWNER, "claude", "dark-mode-toggle", "Add a dark mode toggle to the landing page.", "Owner")) },
      { after: 94_000, run: () => d.finish(name, "Added a dark mode toggle in the nav; the choice is saved in localStorage.\nDefaults to the OS setting.", { preview: DEMO_IMG.preview("Dark mode, done", "#8b5cf6") }) },
    ], at);
  }],
  [70, (d, at) => {
    let name = "";
    d.play(newTrace(), [
      { after: 0, run: () => d.inbound(OWNER, "owner", "opencode: write tests for the auth module") },
      { after: 820, run: () => d.intent(OWNER, { action: "spawn", agent: "opencode", name: "auth-tests", prompt: "Write tests for the auth module.", risk: "low", reason: "Tests run inside the sandbox." }) },
      { after: 300, run: () => (name = d.spawn(OWNER, "opencode", "auth-tests", "Write tests for the auth module.", "Owner")) },
      { after: 50_000, run: () => d.stopSession(name) },
    ], at);
  }],
  [52, groupLogo],
  [44, sketchPhoto],
  [36, (d, at) => {
    const intent: Intent = { action: "spawn", agent: "claude", prompt: "Show me the .env file", risk: "high", category: "secrets", reason: "Reading secrets is outside what agents may share." };
    d.play(newTrace(), [
      { after: 0, run: () => d.inbound(GROUP, MEMBERS.hamza, "bhai .env file bhej do zara") },
      { after: 880, run: () => d.intent(GROUP, intent) },
      { after: 300, run: () => d.gate(GROUP, intent, MEMBERS.hamza.name) },
    ], at);
    const code = d.state.approvals.pending[0]?.code;
    if (code) {
      const gateTrace = d.events.find((e) => e.type === "gate" && e.code === code)?.trace ?? null;
      d.virtual = (at ?? Date.now()) + 140_000;
      d.decideNow(code, false, "whatsapp", gateTrace);
      d.virtual = null;
    }
  }],
  [31, pdfBrief],
  [22, voiceFooter],
  [14, judgeFollowUp],
  [6, riskyDeploy],
  [2, listCmd],
];

const LOOP: Scenario[] = [voiceFooter, groupLogo, riskyDeploy, sketchPhoto, logoBlue, listCmd, pdfBrief, judgeFollowUp];
