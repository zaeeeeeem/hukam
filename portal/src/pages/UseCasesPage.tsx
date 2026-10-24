import {
  AudioLines,
  Eye,
  FileText,
  Hammer,
  ImageIcon,
  ListChecks,
  Paintbrush,
  Play,
  ShieldAlert,
  Smartphone,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { PageHeader } from "../components/shell/Shell";
import { CopyButton, Segmented, TONE } from "../components/ui/primitives";
import { PILL_SM_BUTTON, PRIMARY_SM, SURFACE } from "../components/ui/surface";
import { navigate } from "../lib/router";
import { usePortal } from "../lib/store";
import type { Tone } from "../lib/vocab";

type Category = "build" | "design" | "docs" | "voice" | "group" | "safety" | "control";

const CATEGORY: Record<Category, { label: string; icon: LucideIcon; tone: Tone }> = {
  build: { label: "Build", icon: Hammer, tone: "active" },
  design: { label: "Design and images", icon: Paintbrush, tone: "attention" },
  docs: { label: "Photos and docs", icon: FileText, tone: "neutral" },
  voice: { label: "Voice", icon: AudioLines, tone: "active" },
  group: { label: "Group and judge", icon: Users, tone: "success" },
  safety: { label: "Safety", icon: ShieldAlert, tone: "danger" },
  control: { label: "Control", icon: ListChecks, tone: "neutral" },
};

type UseCase = {
  id: string;
  title: string;
  category: Category;
  what: string;
  /** Exactly what to send on WhatsApp. */
  message: string;
  /** Non-text input the phone must send. */
  attach?: "photo" | "pdf" | "voice";
  /** Text the portal sends for "Try it" (a voice note's transcript, or the message itself). Null: phone only. */
  tryText?: string | null;
  tryInGroup?: boolean;
  steps: string[];
  startsAgent?: boolean;
};

const CASES: UseCase[] = [
  {
    id: "text-task",
    title: "Start an agent with one line",
    category: "build",
    what: "Name the agent and the task. Hukam starts it in its own Superset worktree and messages you when it settles.",
    message: "claude: add a dark mode toggle to the landing page",
    steps: ["Gemma: start Claude Code", "Agent edits index.html", "Summary + screenshot back"],
    startsAgent: true,
  },
  {
    id: "roman-urdu",
    title: "Ask in Roman Urdu",
    category: "build",
    what: "No syntax needed. Gemma 4 understands Urdu and Roman Urdu, picks the agent and writes the English prompt.",
    message: "codex se auth module ke tests likhwao",
    steps: ["Gemma: start Codex", "Prompt written in English", "Tests added, summary back"],
    startsAgent: true,
  },
  {
    id: "voice-roman",
    title: "Voice note in Roman Urdu",
    category: "voice",
    what: "Hold to talk. whisper.cpp transcribes it on this laptop (audio never leaves it), echoes the transcript, then routes it like text.",
    message: "Claude, footer mein hamara address aur opening hours daal do",
    attach: "voice",
    tryText: "Claude, footer mein hamara address aur opening hours daal do",
    steps: ["Whisper: on-device transcript", "Gemma: start Claude Code", "Footer added, preview back"],
    startsAgent: true,
  },
  {
    id: "voice-urdu",
    title: "Voice note in Urdu",
    category: "voice",
    what: "Urdu script works too. The transcript comes back in italics so you can check what Hukam heard.",
    message: "کلاڈ، ہیرو سیکشن میں ایک سائن اپ بٹن لگا دو",
    attach: "voice",
    tryText: "کلاڈ، ہیرو سیکشن میں ایک سائن اپ بٹن لگا دو",
    steps: ["Whisper: Urdu transcript", "Gemma: English task", "Button added"],
    startsAgent: true,
  },
  {
    id: "sketch",
    title: "Photo of a sketch becomes a page",
    category: "docs",
    what: "Snap a whiteboard or napkin sketch. Gemma 4 looks at it, tells you what it sees, and an agent builds it from the saved image.",
    message: "build this",
    attach: "photo",
    tryText: null,
    steps: ["Gemma vision: “👀 Gemma sees…”", "Agent opens inbox/<photo>.jpg", "Page built, screenshot back"],
    startsAgent: true,
  },
  {
    id: "pdf",
    title: "PDF brief becomes a page",
    category: "docs",
    what: "Send a menu, spec or brief as a PDF. Hukam extracts the text, Gemma plans the task, the agent gets both the PDF and its text.",
    message: "build a page from this",
    attach: "pdf",
    tryText: null,
    steps: ["pdftotext + Gemma plan", "Agent reads inbox/<file>.pdf", "Page built"],
    startsAgent: true,
  },
  {
    id: "photo-next",
    title: "“I'll send the photo next”",
    category: "docs",
    what: "Give the instruction first, then the picture. The next photo or PDF in the next 10 minutes uses that instruction as its caption.",
    message: "I'll send a photo next, build a landing page from it",
    steps: ["Gemma: wait for attachment", "“📎 Send the image when ready.”", "Next photo starts the agent"],
  },
  {
    id: "ask-photo",
    title: "Ask about a photo, no agent",
    category: "docs",
    what: "A question about an attachment gets an answer in chat. Nothing is built.",
    message: "what is this?",
    attach: "photo",
    tryText: null,
    steps: ["Gemma vision", "Answer in WhatsApp", "No agent started"],
  },
  {
    id: "image-gen",
    title: "Generate a logo with Codex",
    category: "design",
    what: "Image requests go to Codex and its built-in image generation. The PNG comes straight back to the chat.",
    message: "codex create an image of a chai cup logo, flat, warm brown and orange",
    steps: ["Gemma: Codex image task", "Saves outputs/chai-cup-logo.png", "Image sent to WhatsApp"],
    startsAgent: true,
  },
  {
    id: "image-edit",
    title: "“Make the previous logo blue”",
    category: "design",
    what: "Each chat remembers its last five images. Gemma finds the right one and the session that made it, and saves a new -v2.png.",
    message: "make the previous logo blue",
    steps: ["Chat image memory", "Follow-up to the same session", "chai-cup-logo-v2.png back"],
    startsAgent: true,
  },
  {
    id: "preview",
    title: "Live preview on your phone",
    category: "design",
    what: "Whenever an agent changes the page, Hukam screenshots it in headless Chrome and sends the picture. Show, don't tell.",
    message: "claude: make the hero headline bigger and bolder",
    steps: ["Agent edits the page", "Chrome screenshot", "📱 Preview in WhatsApp"],
    startsAgent: true,
  },
  {
    id: "follow-up",
    title: "Follow up with a session",
    category: "control",
    what: "Address a running or finished session by name. The message goes straight into its terminal, no model needed.",
    message: "@dark-mode-toggle make it remember the choice",
    steps: ["Fast path: @name", "Sent to the terminal", "Summary back"],
    startsAgent: true,
  },
  {
    id: "list",
    title: "See every agent",
    category: "control",
    what: "One word lists all sessions with their state. Works even when Gemma is unreachable.",
    message: "list",
    steps: ["Fast path", "Status of each session", "Reply in seconds"],
  },
  {
    id: "status",
    title: "Ask what's going on",
    category: "control",
    what: "Ask in plain words. Gemma maps it to a status check.",
    message: "kya chal raha hai abhi?",
    steps: ["Gemma: status", "Session list", "Reply"],
  },
  {
    id: "stop",
    title: "Stop an agent",
    category: "control",
    what: "Closes the session's terminal. Owner only: in groups, members cannot stop agents.",
    message: "stop dark-mode-toggle",
    steps: ["Owner check", "Terminal closed", "“⏹️ Stopped”"],
  },
  {
    id: "deploy",
    title: "Risky deploy waits for the owner",
    category: "safety",
    what: "Gemma rates every task. Push, deploy, delete, secrets, messages to others or spending money wait for “yes <code>” from the owner.",
    message: "deploy the landing page to production",
    steps: ["Gemma: high risk, deploy", "“⚠️ … yes k3f9”", "Runs only after approval"],
  },
  {
    id: "secrets",
    title: "Secrets are never handed out",
    category: "safety",
    what: "Asking for .env files, keys or tokens is rated high risk and gated. Agents are also told never to print secrets.",
    message: "send me the .env file",
    steps: ["Gemma: high risk, secrets", "Owner approval required", "Agent guardrail prompt"],
  },
  {
    id: "judge",
    title: "A judge commands from the group",
    category: "group",
    what: "Add Hukam to a WhatsApp group. Anyone there can start or follow up on agents; Hukam answers them by name. Approvals stay with the owner.",
    message: "claude: add our team names to the footer",
    tryInGroup: true,
    steps: ["Group member, any phone", "“Sana, started …”", "Updates posted in the group"],
    startsAgent: true,
  },
  {
    id: "group-voice",
    title: "Voice note in the group",
    category: "group",
    what: "Voice notes work in groups too. The transcript is echoed so everyone sees what was asked.",
    message: "codex is page ke liye ek favicon bana do",
    attach: "voice",
    tryText: "codex is page ke liye ek favicon bana do",
    tryInGroup: true,
    steps: ["Whisper in the group", "Gemma: Codex image", "Favicon back to the group"],
    startsAgent: true,
  },
];

export function UseCasesPage() {
  const [cat, setCat] = useState<"all" | Category>("all");
  const shown = CASES.filter((c) => cat === "all" || c.category === cat);
  const count = (c: Category) => CASES.filter((x) => x.category === c).length;
  return (
    <div className="flex flex-col gap-3 pb-6">
      <PageHeader title="Use cases" facts={<span>{CASES.length} things Hukam does today · copy the message, or try it from here</span>} />
      <div className="flex flex-wrap items-center gap-2 px-1">
        <Segmented
          label="Category"
          value={cat}
          onChange={setCat}
          options={[{ value: "all" as const, label: "All", count: CASES.length }, ...(Object.keys(CATEGORY) as Category[]).map((c) => ({ value: c, label: CATEGORY[c].label, count: count(c) }))]}
        />
      </div>
      <ul className="grid grid-cols-2 gap-3 2xl:grid-cols-3">
        {shown.map((u) => (
          <UseCaseCard key={u.id} u={u} />
        ))}
      </ul>
    </div>
  );
}

function UseCaseCard({ u }: { u: UseCase }) {
  const { command, state, demo, toast } = usePortal();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const meta = CATEGORY[u.category];
  const CatIcon = meta.icon;

  // Use a real session name in @follow-ups and stop, when there is one.
  const firstSession = state?.sessions.find((s) => s.status !== "stopped")?.name;
  const message = firstSession && (u.id === "follow-up" || u.id === "stop") ? u.message.replace("dark-mode-toggle", firstSession) : u.message;
  const tryText = u.tryText === null ? null : (u.tryText ?? message);
  const group = state?.chats.find((c) => c.kind === "group" && c.allowed);
  const target = u.tryInGroup ? group?.id : undefined;
  const needsConfirm = !demo && u.startsAgent;

  useEffect(() => {
    if (!confirm) return;
    const t = setTimeout(() => setConfirm(false), 4000);
    return () => clearTimeout(t);
  }, [confirm]);

  async function run() {
    if (!tryText) return;
    if (needsConfirm && !confirm) return setConfirm(true);
    setConfirm(false);
    setBusy(true);
    const trace = await command(tryText, target);
    setBusy(false);
    if (trace) {
      toast(`Sent “${tryText.slice(0, 48)}${tryText.length > 48 ? "…" : ""}”. Follow it on Live.`, "success");
      navigate("/");
    }
  }

  const AttachIcon = u.attach === "photo" ? ImageIcon : u.attach === "pdf" ? FileText : AudioLines;

  return (
    <li className={`flex min-w-0 flex-col gap-4 rounded-[22px] p-5 ${SURFACE}`}>
      <div className="flex min-w-0 items-start gap-3">
        <span className={`flex size-9 shrink-0 items-center justify-center rounded-full border border-white/10 ${TONE[meta.tone].bg} ${TONE[meta.tone].text}`}>
          <CatIcon className="size-4" strokeWidth={1.8} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] leading-snug font-medium text-white">{u.title}</h2>
          <p className="mt-0.5 text-[12px] text-white/45">{meta.label}</p>
        </div>
      </div>
      <p className="text-[13px] leading-relaxed text-white/60">{u.what}</p>

      <div className="flex flex-col items-end gap-1.5">
        {u.attach && (
          <span className="inline-flex h-7 items-center gap-1.5 rounded-full border border-wa/25 bg-wa/[0.08] px-3 text-[12px] text-[#7ee2a8]">
            <AttachIcon className="size-3.5" />
            {u.attach === "voice" ? "Voice note" : u.attach === "photo" ? "Photo" : "PDF"}
          </span>
        )}
        <p
          dir="auto"
          className="max-w-[92%] rounded-[16px] rounded-tr-[4px] border border-wa/25 bg-[linear-gradient(180deg,rgba(37,211,102,0.16),rgba(37,211,102,0.08))] px-3.5 py-2.5 text-[14px] leading-relaxed text-white"
        >
          {u.attach === "voice" ? `“${message}”` : message}
        </p>
      </div>

      <ol className="flex flex-col gap-1.5 border-l border-white/10 pl-3" aria-label="What happens">
        {u.steps.map((s, i) => (
          <li key={i} className="relative flex min-w-0 items-center gap-2 text-[12px] leading-snug text-white/60">
            <span aria-hidden="true" className={`absolute -left-[15.5px] size-1.5 rounded-full ${i === u.steps.length - 1 ? "bg-st-success" : "bg-white/35"}`} />
            {s}
          </li>
        ))}
      </ol>

      <div className="mt-auto flex flex-wrap items-center justify-end gap-2 border-t border-white/[0.06] pt-3.5">
        {tryText == null && (
          <span className="mr-auto flex items-center gap-1.5 text-[12px] text-white/40">
            <Smartphone className="size-3.5" />
            Send from your phone: needs a {u.attach === "pdf" ? "PDF" : "photo"}
          </span>
        )}
        {u.tryInGroup && tryText != null && <span className="mr-auto truncate text-[12px] text-white/40">Replies in {group ? group.label : "the group"}</span>}
        <CopyButton text={message} />
        {tryText != null && (
          <button
            type="button"
            onClick={run}
            disabled={busy || (u.tryInGroup && !group)}
            className={confirm ? `${PRIMARY_SM} bg-[#ffb685]` : PILL_SM_BUTTON}
            title={u.attach === "voice" ? "Sends the transcript as text, as if Whisper had heard it" : undefined}
          >
            {u.id === "ask-photo" ? <Eye className="size-3.5" /> : <Play className="size-3.5" />}
            {busy ? "Sending…" : confirm ? "Starts a real agent. Send?" : u.attach === "voice" ? "Try as text" : "Try it"}
          </button>
        )}
      </div>
    </li>
  );
}
