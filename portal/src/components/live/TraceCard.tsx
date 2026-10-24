// One inbound message and Hukam's answer, as it appears in the Live conversation column and on the Chats page.
import { AudioLines, FileText, Laptop, MessageSquareReply, Users } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { PHASE, type Trace } from "../../lib/traces";
import { bytes } from "../../lib/format";
import { Chip, Img, initialsOf, TimeAgo, TONE, WaText } from "../ui/primitives";

export function Initials({ name, owner = false, size = 28 }: { name: string | null; owner?: boolean; size?: number }) {
  const label = owner ? "You" : name && !/^\d+$/.test(name) ? name : "?";
  const initials = owner ? "Y" : initialsOf(label);
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold ${
        owner ? "border-fu-orange/50 bg-fu-orange/15 text-[#ffb08a]" : "border-white/12 bg-white/[0.06] text-white/75"
      }`}
      style={{ width: size, height: size }}
    >
      {initials}
    </span>
  );
}

export function senderName(t: Trace) {
  if (t.owner) return t.source === "portal" ? "You (portal)" : "You";
  if (t.from && !/^\d+$/.test(t.from)) return t.from;
  return t.from ? `…${t.from}` : "Unknown";
}

export function TraceCard({ trace: t, selected, onSelect, showChat = true }: { trace: Trace; selected?: boolean; onSelect?: () => void; showChat?: boolean }) {
  const reduce = useReducedMotion();
  const phase = PHASE[t.phase];
  const lastReply = [...t.replies].reverse().find((r) => !r.attachment);
  const replyImages = t.replies.filter((r) => r.attachment?.kind === "image");
  const group = t.chat && t.chat !== "DM";
  return (
    <motion.div layout={!reduce} initial={reduce ? false : { opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 380, damping: 34 }}>
      <div
        role={onSelect ? "button" : undefined}
        tabIndex={onSelect ? 0 : undefined}
        aria-pressed={onSelect ? !!selected : undefined}
        onClick={onSelect}
        onKeyDown={(e) => {
          if (onSelect && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            onSelect();
          }
        }}
        className={`group flex w-full flex-col gap-2.5 rounded-[16px] border p-3.5 text-left transition-colors ${onSelect ? "cursor-pointer" : ""} ${
          selected ? "border-white/25 bg-white/[0.06] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]" : "border-white/[0.07] bg-white/[0.025] hover:border-white/15 hover:bg-white/[0.04]"
        }`}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <Initials name={t.from} owner={t.owner} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] leading-tight font-medium text-white">{senderName(t)}</p>
            <p className="mt-0.5 flex min-w-0 items-center gap-1 text-[11px] text-white/40">
              {showChat && group && (
                <>
                  <Users className="size-3 shrink-0" />
                  <span className="truncate">{t.chat}</span>
                  <span aria-hidden="true">·</span>
                </>
              )}
              <TimeAgo at={t.start} className="shrink-0" />
              {t.source === "portal" && (
                <span className="flex shrink-0 items-center gap-1">
                  · <Laptop className="size-3" /> portal
                </span>
              )}
            </p>
          </div>
          <span className={`inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-medium ring-1 ring-inset ${TONE[phase.tone].pill}`}>
            <span className={`size-1.5 rounded-full ${TONE[phase.tone].dot}`} />
            {phase.label}
          </span>
        </div>

        {t.voice && (
          <span className="flex items-center gap-1.5 text-[11px] text-white/45">
            <AudioLines className="size-3.5 text-[#8fd3ff]" />
            Voice note{t.transcriptMs != null ? ` · transcribed on-device in ${(t.transcriptMs / 1000).toFixed(1)} s` : ""}
          </span>
        )}
        {t.attachment?.kind === "image" && t.attachment.url && (
          <Img src={t.attachment.url} alt={`Photo from ${senderName(t)}`} className="h-28 w-auto min-w-28 max-w-full self-start rounded-xl border border-white/10 object-cover" />
        )}
        {t.attachment?.kind === "pdf" && (
          <Chip className="self-start">
            <FileText className="size-3.5 text-[#ff9a92]" />
            <span className="truncate">{t.attachment.name}</span>
            {t.attachment.size ? <span className="text-white/40">{bytes(t.attachment.size)}</span> : null}
          </Chip>
        )}
        {t.text && <WaText text={t.text} className={`line-clamp-3 text-[13px] leading-relaxed ${t.voice ? "text-white/85 italic" : "text-white/85"}`} />}

        {(lastReply || replyImages.length > 0) && (
          <div className="ml-[38px] flex flex-col gap-2 rounded-[12px] border border-white/[0.06] bg-black/30 px-3 py-2.5">
            <p className="flex items-center gap-1.5 text-[11px] font-medium text-white/45">
              <MessageSquareReply className="size-3" />
              Hukam replied
              {t.replies.length > 1 && <span className="font-normal text-white/30">· {t.replies.length} messages</span>}
            </p>
            {lastReply && <WaText text={lastReply.text} className="line-clamp-3 text-[12px] leading-relaxed text-white/70" />}
            {replyImages.length > 0 && (
              <div className="flex gap-2">
                {replyImages.slice(0, 3).map((r) => (
                  <Img key={r.attachment!.url} src={r.attachment!.url} alt={r.attachment!.name} className="size-14 rounded-lg border border-white/10 object-cover" />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
