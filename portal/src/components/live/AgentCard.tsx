// One Superset session: agent, live status (orbiting laser while it works), prompt, summary, made images.
import { ArrowUpRight, Users } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { duration } from "../../lib/format";
import { Link } from "../../lib/router";
import { useNow } from "../../lib/store";
import type { Session } from "../../lib/types";
import { agentMeta, sessionStatus } from "../../lib/vocab";
import { AgentAvatar, Img, StatusPill, TimeAgo, WaText } from "../ui/primitives";
import { LASER_CONIC, LASER_CONIC_AMBER, LaserBorder, NODE_FILL } from "../ui/surface";

export function AgentCard({ session: s, compact = false }: { session: Session; compact?: boolean }) {
  const reduce = useReducedMotion();
  const now = useNow(1000);
  const st = sessionStatus(s.status);
  const working = s.status === "working";
  const blocked = s.status === "blocked";
  const images = [...s.artifacts.map((a) => ({ url: a.url, label: a.path })), ...s.previews.map((p) => ({ url: p.url, label: "Live preview" }))].slice(0, 4);
  const elapsed = working && (s.updatedAt || s.createdAt) ? now - (s.updatedAt || s.createdAt)! : null;

  const body = (
    <Link
      to={`/sessions/${encodeURIComponent(s.name)}`}
      className={`group flex h-full flex-col gap-2.5 rounded-[15px] p-3.5 ${working || blocked ? "" : "transition-colors hover:bg-white/[0.02]"}`}
      aria-label={`${s.name}, ${agentMeta(s.agent).label}, ${st.label}. Open session.`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <AgentAvatar agent={s.agent} size={36} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] leading-tight font-medium text-white" title={s.name}>
            {s.name}
          </p>
          <div className="mt-1 flex min-w-0 items-center gap-2">
            <StatusPill tone={st.tone} icon={st.icon} label={st.label} size="sm" />
            <span className="truncate text-[12px] text-white/45">
              {agentMeta(s.agent).short}
              {s.model ? ` · ${s.model}` : ""}
            </span>
          </div>
        </div>
      </div>

      <p className={`text-[12px] leading-relaxed text-white/70 ${compact ? "line-clamp-2" : "line-clamp-3"}`}>{s.prompt}</p>

      {s.summary && !working && (
        <div className="rounded-[10px] border border-white/[0.06] bg-black/30 px-2.5 py-2">
          <WaText text={s.summary} className={`text-[12px] leading-relaxed ${blocked ? "text-[#ffc59e]" : "text-white/65"} ${compact ? "line-clamp-2" : "line-clamp-3"}`} />
        </div>
      )}

      {images.length > 0 && (
        <div className="flex gap-2">
          {images.map((img) => (
            <Img key={img.url} src={img.url} alt={img.label} title={img.label} className="size-12 rounded-lg border border-white/10 object-cover" />
          ))}
        </div>
      )}

      <div className="mt-auto flex min-w-0 items-center gap-2 pt-0.5 text-[11px] text-white/40">
        {s.chat && (
          <span className="flex min-w-0 items-center gap-1">
            {s.chat !== "DM" && <Users className="size-3 shrink-0" />}
            <span className="truncate">{s.chat === "DM" ? "Owner DM" : s.chat}</span>
          </span>
        )}
        {s.from && s.chat !== "DM" && <span className="truncate">· {s.from}</span>}
        <span className="ml-auto flex shrink-0 items-center gap-1 whitespace-nowrap">
          {elapsed != null ? <span className="font-mono text-[#5cc2ff] tabular-nums">{duration(elapsed)}</span> : <TimeAgo at={s.updatedAt ?? s.createdAt} />}
          <ArrowUpRight className="size-3.5 text-white/30 transition-colors group-hover:text-white/80" />
        </span>
      </div>
    </Link>
  );

  return (
    <motion.div layout={!reduce} initial={reduce ? false : { opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 380, damping: 34 }}>
      {working || blocked ? (
        <LaserBorder radius={16} conic={blocked ? LASER_CONIC_AMBER : LASER_CONIC} innerClassName={NODE_FILL}>
          {body}
        </LaserBorder>
      ) : (
        <div className={`rounded-[16px] border transition-colors ${NODE_FILL} ${s.status === "exited" ? "border-dashed border-st-danger/55" : "border-white/10 hover:border-white/20"} ${s.status === "stopped" ? "opacity-70" : ""}`}>
          {body}
        </div>
      )}
    </motion.div>
  );
}
