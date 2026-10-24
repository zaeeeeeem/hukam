// The pipeline as seven hops in a row. It follows one trace (the latest message, or the one the presenter
// clicked): each hop shows how that message went through it and how long it took. A laser runs along the
// connector into a hop the moment the message reaches it.
import { AudioLines, Bot, Check, Cpu, Hand, MessageCircle, MessageSquareReply, ShieldCheck, Workflow, X, type LucideIcon } from "lucide-react";
import { useReducedMotion } from "motion/react";
import { duration } from "../../lib/format";
import { HOP_ORDER, type Hop, type HopId, type Trace } from "../../lib/traces";
import type { HukamState } from "../../lib/types";
import { LASER_CONIC_AMBER, LASER_CONIC_BLUE, LaserBorder, NODE_FILL } from "../ui/surface";

type HopDef = { label: string; icon: LucideIcon; sub: (s: HukamState | null) => string };

const shortModel = (m: string | undefined) => (m ? m.replace(/^gemma-4-/, "").replace(/-it$/, "").replace(/-/g, " ").toUpperCase() : "");

export const HOPS: Record<HopId, HopDef> = {
  whatsapp: { label: "WhatsApp", icon: MessageCircle, sub: (s) => (s ? `${s.settings.allow.length + s.settings.groups.length} chats` : "Inbox") },
  whisper: { label: "Whisper", icon: AudioLines, sub: (s) => (s && !s.settings.voice.enabled ? "Off" : "On-device") },
  gemma: { label: "Gemma 4", icon: Cpu, sub: (s) => (s ? shortModel(s.gemma.lastServed?.model ?? s.settings.gemma.model) : "Router") },
  gate: { label: "Risk gate", icon: ShieldCheck, sub: (s) => (!s ? "Owner" : !s.settings.risk.gate ? "Off" : s.approvals.pending.length ? `${s.approvals.pending.length} waiting` : "Owner only") },
  superset: { label: "Superset", icon: Workflow, sub: (s) => (s ? `${s.sessions.length} sessions` : "Agents") },
  agent: { label: "Agents", icon: Bot, sub: (s) => (s ? `${s.sessions.filter((x) => x.status === "working").length} working` : "Coding") },
  reply: { label: "Reply", icon: MessageSquareReply, sub: () => "To WhatsApp" },
};

function hopLine(hop: Hop, id: HopId): { text: string; tone: string } {
  switch (hop.state) {
    case "done":
      return { text: hop.ms != null ? duration(hop.ms) : id === "whatsapp" ? (hop.note === "portal" ? "From portal" : "Received") : "Done", tone: "text-white/80" };
    case "active":
      return { text: id === "agent" ? "Working…" : id === "gemma" ? "Thinking…" : id === "reply" ? "Sent, more to come" : "In progress…", tone: "text-[#5cc2ff]" };
    case "waiting":
      return { text: id === "gate" ? `Owner · ${hop.note ?? ""}`.trim() : "Needs you", tone: "text-[#ffa46b]" };
    case "error":
      return { text: hop.note === "cancelled" ? "Cancelled" : "Failed", tone: "text-[#ff8f86]" };
    case "skipped":
      return { text: hop.note === "low risk" ? "Low risk" : hop.note === "stopped" ? "Stopped" : "Not needed", tone: "text-white/35" };
    default:
      return { text: "—", tone: "text-white/25" };
  }
}

export function PipelineRail({ trace, state }: { trace: Trace | null; state: HukamState | null }) {
  return (
    <ol className="@container grid grid-cols-7 gap-5 xl:gap-7" aria-label="Pipeline hops">
      {HOP_ORDER.map((id, i) => {
        const hop = trace?.hops[id] ?? { state: "idle" as const };
        const prev = i > 0 ? (trace?.hops[HOP_ORDER[i - 1]] ?? { state: "idle" as const }) : null;
        return (
          <li key={id} className="relative flex min-w-0" aria-label={`${HOPS[id].label}: ${hopLine(hop, id).text}`}>
            {prev && <Connector from={prev} to={hop} traceId={trace?.id ?? ""} hopId={id} />}
            <HopNode id={id} hop={hop} state={state} />
          </li>
        );
      })}
    </ol>
  );
}

function HopNode({ id, hop, state }: { id: HopId; hop: Hop; state: HukamState | null }) {
  const def = HOPS[id];
  const Icon = def.icon;
  const line = hopLine(hop, id);
  const skipped = hop.state === "skipped" || hop.state === "idle";
  const body = (
    <div className={`flex h-full flex-col gap-2.5 px-3 pt-3 pb-2.5 transition-opacity duration-300 ${skipped ? "opacity-55" : ""}`}>
      <div className="flex min-w-0 items-center gap-2.5">
        <span
          className={`relative flex size-8 shrink-0 items-center justify-center rounded-full border @max-[1000px]:hidden ${
            hop.state === "active"
              ? "border-st-active/50 bg-st-active/15 text-[#8fd3ff]"
              : hop.state === "waiting"
                ? "border-st-attention/50 bg-st-attention/15 text-[#ffb685]"
                : hop.state === "done"
                  ? "border-white/15 bg-white/[0.07] text-white"
                  : hop.state === "error"
                    ? "border-st-danger/45 bg-st-danger/12 text-[#ff8f86]"
                    : "border-white/10 bg-white/[0.04] text-white/55"
          }`}
        >
          <Icon className="size-4" strokeWidth={1.8} />
          {hop.state === "done" && (
            <span className="absolute -right-1 -bottom-1 flex size-3.5 items-center justify-center rounded-full bg-st-success ring-2 ring-node">
              <Check className="size-2.5 text-black" strokeWidth={3.5} />
            </span>
          )}
          {hop.state === "error" && (
            <span className="absolute -right-1 -bottom-1 flex size-3.5 items-center justify-center rounded-full bg-st-danger ring-2 ring-node">
              <X className="size-2.5 text-black" strokeWidth={3.5} />
            </span>
          )}
          {hop.state === "waiting" && (
            <span className="absolute -right-1 -bottom-1 flex size-3.5 items-center justify-center rounded-full bg-st-attention ring-2 ring-node">
              <Hand className="size-2 text-black" strokeWidth={3} />
            </span>
          )}
        </span>
        <div className="min-w-0">
          <p className="truncate text-[13px] leading-tight font-medium whitespace-nowrap text-white">{def.label}</p>
          <p className="truncate text-[11px] leading-tight whitespace-nowrap text-white/45" title={id === "gemma" ? (state?.gemma.chain ?? "") : undefined}>
            {def.sub(state)}
          </p>
        </div>
      </div>
      <p className={`truncate border-t border-white/[0.06] pt-2 font-mono text-[11px] tabular-nums ${line.tone}`} title={hop.note && id === "gemma" ? hop.note : undefined}>
        {line.text}
      </p>
    </div>
  );
  if (hop.state === "active" || hop.state === "waiting") {
    return (
      <LaserBorder radius={14} conic={hop.state === "waiting" ? LASER_CONIC_AMBER : LASER_CONIC_BLUE} className="min-w-0 flex-1" innerClassName={NODE_FILL}>
        {body}
      </LaserBorder>
    );
  }
  return (
    <div
      className={`min-w-0 flex-1 rounded-[14px] border ${NODE_FILL} ${
        hop.state === "error" ? "border-dashed border-st-danger/55" : hop.state === "done" ? "border-white/14" : "border-white/[0.08]"
      }`}
    >
      {body}
    </div>
  );
}

/** Straight connector between two hops. A one-shot laser plays when the next hop was reached in the last moments. */
function Connector({ from, to, traceId, hopId }: { from: Hop; to: Hop; traceId: string; hopId: HopId }) {
  const reduce = useReducedMotion();
  const reached = to.state === "done" || to.state === "active" || to.state === "waiting" || to.state === "error";
  const fresh = !reduce && reached && to.at != null && Date.now() - to.at < 2500;
  const running = !reduce && to.state === "active";
  const passive = !reached && (from.state === "done" || from.state === "skipped") && to.state === "skipped";
  const stroke = reached ? "rgba(255,255,255,0.32)" : passive ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.10)";
  return (
    <div className="absolute top-0 right-full bottom-0 flex w-5 items-center xl:w-7" aria-hidden="true">
      <svg className="h-3 w-full overflow-visible" viewBox="0 0 100 12" preserveAspectRatio="none">
        <line x1="0" y1="6" x2="100" y2="6" stroke={stroke} strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeDasharray={reached ? undefined : "3 4"} />
        {running && (
          <line x1="0" y1="6" x2="100" y2="6" stroke="#1f77f6" strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinecap="round" pathLength={100} strokeDasharray="14 300" className="laser-loop" />
        )}
        {fresh && (
          <g key={`${traceId}-${hopId}-${to.at}`}>
            <line x1="0" y1="6" x2="100" y2="6" stroke="#da4e24" strokeOpacity={0.45} strokeWidth="5" vectorEffect="non-scaling-stroke" strokeLinecap="round" pathLength={100} strokeDasharray="22 300" className="laser-run" />
            <line x1="0" y1="6" x2="100" y2="6" stroke="#ffb685" strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinecap="round" pathLength={100} strokeDasharray="8 300" className="laser-run" />
          </g>
        )}
      </svg>
    </div>
  );
}
