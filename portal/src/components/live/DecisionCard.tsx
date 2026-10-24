// What Gemma 4 decided for one message: action, agent, session, risk, reason, what it saw, model, latency,
// and (for risky tasks) the owner's approval with inline approve/cancel.
import { Check, Eye, ShieldAlert, ShieldCheck, X, Zap } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { duration } from "../../lib/format";
import { usePortal } from "../../lib/store";
import type { Trace } from "../../lib/traces";
import { actionLabel, agentMeta, RISK_CATEGORY } from "../../lib/vocab";
import { AgentAvatar, Chip, Mono, StatusPill, TimeAgo, WaText } from "../ui/primitives";
import { DANGER_SM, PRIMARY_SM } from "../ui/surface";

export function modelLabel(model: string | undefined) {
  if (!model) return "";
  if (model === "fast-path") return "Fast path · no model";
  if (model === "regex-fallback") return "Fallback parser";
  if (model === "attachment-fallback") return "Attachment fallback";
  const [via, m] = model.split(":");
  return `${(m ?? via).replace(/-it$/, "")}${m ? ` · ${via === "vertex" ? "Vertex AI" : "Gemini API"}` : ""}`;
}

export function DecisionCard({ trace: t, selected, onSelect }: { trace: Trace; selected?: boolean; onSelect?: () => void }) {
  const reduce = useReducedMotion();
  const { decide } = usePortal();
  const [busy, setBusy] = useState<null | "yes" | "no">(null);
  const i = t.intent!;
  const high = i.risk === "high";
  const runs = i.action === "spawn" || i.action === "send";
  const agent = i.agent || (i.action === "send" ? undefined : null);
  const cat = i.category ? (RISK_CATEGORY[i.category]?.label ?? i.category) : null;
  const waiting = t.gate && !t.approval;

  return (
    <motion.div layout={!reduce} initial={reduce ? false : { opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 380, damping: 34 }}>
      <div
        role={onSelect ? "button" : undefined}
        tabIndex={onSelect ? 0 : undefined}
        aria-pressed={onSelect ? !!selected : undefined}
        onClick={onSelect}
        onKeyDown={(e) => {
          if (onSelect && e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            onSelect();
          }
        }}
        className={`flex flex-col gap-2.5 rounded-[16px] border p-3.5 transition-colors ${onSelect ? "cursor-pointer" : ""} ${
          waiting
            ? "border-st-attention/35 bg-st-attention/[0.05]"
            : selected
              ? "border-white/25 bg-white/[0.06]"
              : "border-white/[0.07] bg-white/[0.025] hover:border-white/15 hover:bg-white/[0.04]"
        }`}
      >
        <div className="flex min-w-0 items-start gap-2.5">
          {runs ? (
            <AgentAvatar agent={agent ?? "claude"} size={28} />
          ) : (
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-white/12 bg-white/[0.05] text-white/70">
              <Zap className="size-3.5" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[13px] leading-snug font-medium text-white">
              {actionLabel(i.action)}
              {runs && <span className="font-normal text-white/50"> · {i.action === "send" ? (i.session ?? "") : agentMeta(agent).label}</span>}
            </p>
            <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[11px] text-white/40">
              {i.action === "spawn" && (t.session ?? i.name) ? (
                <>
                  <Mono className="truncate text-white/55">{t.session ?? i.name}</Mono>
                  <span aria-hidden="true">·</span>
                </>
              ) : null}
              <TimeAgo at={t.events.find((e) => e.type === "intent")?.at} className="shrink-0" />
            </p>
          </div>
        </div>

        {i.reason && <p className="text-[12px] leading-relaxed text-white/55">{i.reason}</p>}
        {i.description && (
          <p className="flex gap-2 rounded-[10px] border border-white/[0.06] bg-black/30 px-2.5 py-2 text-[12px] leading-relaxed text-white/70">
            <Eye className="mt-0.5 size-3.5 shrink-0 text-[#8fd3ff]" />
            <span>
              <span className="text-white/45">Gemma saw: </span>
              {i.description}
            </span>
          </p>
        )}
        {i.action === "chat" && i.reply && <WaText text={i.reply} className="line-clamp-2 text-[12px] leading-relaxed text-white/60" />}

        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          {high ? (
            <StatusPill tone="attention" icon={ShieldAlert} label={cat ? `High risk · ${cat}` : "High risk"} size="sm" />
          ) : runs ? (
            <StatusPill tone="success" icon={ShieldCheck} label="Low risk" size="sm" />
          ) : null}
          <Chip title={t.model}>
            <span className="truncate">{modelLabel(t.model)}</span>
          </Chip>
          {t.gemmaMs != null && t.gemmaMs > 0 && (
            <Chip>
              <Mono>{duration(t.gemmaMs)}</Mono>
            </Chip>
          )}
          {t.approval && (
            <Chip>
              {t.approval.ok ? <Check className="size-3 text-[#5fe0ad]" /> : <X className="size-3 text-[#ff8f86]" />}
              {t.approval.ok ? "Approved" : "Cancelled"}
              {t.approval.via ? <span className="text-white/40">via {t.approval.via === "portal" ? "portal" : "WhatsApp"}</span> : null}
            </Chip>
          )}
        </div>

        {waiting && t.gate && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-st-attention/20 pt-2.5">
            <p className="text-[12px] text-[#ffb685]">
              Waiting for the owner · code <Mono className="text-white/85">{t.gate.code}</Mono>
            </p>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                className={DANGER_SM}
                disabled={!!busy}
                onClick={async (e) => {
                  e.stopPropagation();
                  setBusy("no");
                  await decide(t.gate!.code, false);
                  setBusy(null);
                }}
              >
                <X className="size-3.5" />
                {busy === "no" ? "Cancelling…" : "Cancel"}
              </button>
              <button
                type="button"
                className={PRIMARY_SM}
                disabled={!!busy}
                onClick={async (e) => {
                  e.stopPropagation();
                  setBusy("yes");
                  await decide(t.gate!.code, true);
                  setBusy(null);
                }}
              >
                <Check className="size-3.5" />
                {busy === "yes" ? "Approving…" : "Approve"}
              </button>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
