import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { Check, CircleAlert, Copy, ImageOff, RotateCw, type LucideIcon } from "lucide-react";
import { Fragment, useEffect, useState, type ImgHTMLAttributes, type ReactNode } from "react";
import { int, timeAgo } from "../../lib/format";
import { useNow } from "../../lib/store";
import { agentMeta, type Tone } from "../../lib/vocab";
import { SURFACE, TAG } from "./surface";

export const TONE: Record<Tone, { pill: string; dot: string; text: string; ring: string; bg: string }> = {
  neutral: { pill: "bg-white/6 text-white/70 ring-white/10", dot: "bg-white/45", text: "text-white/70", ring: "ring-white/15", bg: "bg-white/[0.06]" },
  active: { pill: "bg-st-active/12 text-[#5cc2ff] ring-st-active/30", dot: "bg-st-active", text: "text-[#5cc2ff]", ring: "ring-st-active/50", bg: "bg-st-active/12" },
  attention: { pill: "bg-st-attention/12 text-[#ffa46b] ring-st-attention/35", dot: "bg-st-attention", text: "text-[#ffa46b]", ring: "ring-st-attention/55", bg: "bg-st-attention/12" },
  success: { pill: "bg-st-success/12 text-[#5fe0ad] ring-st-success/30", dot: "bg-st-success", text: "text-[#5fe0ad]", ring: "ring-st-success/45", bg: "bg-st-success/12" },
  danger: { pill: "bg-st-danger/14 text-[#ff7a70] ring-st-danger/35", dot: "bg-st-danger", text: "text-[#ff7a70]", ring: "ring-st-danger/50", bg: "bg-st-danger/14" },
  muted: { pill: "bg-white/3 text-white/45 ring-white/8", dot: "bg-white/25", text: "text-white/45", ring: "ring-white/10", bg: "bg-white/[0.03]" },
};

export function ToneIcon({ icon: Icon, tone, className = "size-3.5" }: { icon: LucideIcon; tone: Tone; className?: string }) {
  return <Icon className={`shrink-0 ${TONE[tone].text} ${className}`} strokeWidth={2} aria-hidden="true" />;
}

export function StatusPill({ tone, label, icon, size = "md", title }: { tone: Tone; label: string; icon: LucideIcon; size?: "sm" | "md"; title?: string }) {
  return (
    <span
      title={title}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full font-medium whitespace-nowrap ring-1 ring-inset ${TONE[tone].pill} ${
        size === "sm" ? "h-6 px-2.5 text-[11px]" : "h-7 px-3 text-xs"
      }`}
    >
      <ToneIcon icon={icon} tone={tone} className={size === "sm" ? "size-3" : "size-3.5"} />
      {label}
    </span>
  );
}

/** Small neutral chip, like Graphi's node chips. */
export function Chip({ children, className = "", title }: { children: ReactNode; className?: string; title?: string }) {
  return (
    <span
      title={title}
      className={`inline-flex h-6 max-w-full min-w-0 items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.04] px-2 text-[11px] font-medium whitespace-nowrap text-white/80 ${className}`}
    >
      {children}
    </span>
  );
}

export function Mono({ children, className = "", title }: { children: ReactNode; className?: string; title?: string }) {
  return (
    <span title={title} className={`font-mono tabular-nums ${className}`}>
      {children}
    </span>
  );
}

export function TimeAgo({ at, className = "" }: { at: number | string | null | undefined; className?: string }) {
  const now = useNow(5000);
  if (at == null) return null;
  const iso = new Date(typeof at === "string" ? Date.parse(at) : at).toISOString();
  return (
    <time dateTime={iso} title={new Date(iso).toLocaleString()} className={`whitespace-nowrap ${className}`}>
      {timeAgo(at, now)}
    </time>
  );
}

/** Springs to the new value on change; reduced motion shows the value directly. */
export function CountUp({ value, format = int, className = "" }: { value: number; format?: (n: number) => string; className?: string }) {
  const reduce = useReducedMotion();
  const mv = useMotionValue(reduce ? value : 0);
  const text = useTransform(mv, (v) => format(v));
  useEffect(() => {
    if (reduce) {
      mv.set(value);
      return;
    }
    const controls = animate(mv, value, { duration: 0.8, ease: [0.16, 1, 0.3, 1] });
    return () => controls.stop();
  }, [mv, value, reduce]);
  return <motion.span className={`tabular-nums ${className}`}>{text}</motion.span>;
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton rounded-md ${className}`} />;
}

export function InlineError({ children, onRetry }: { children: ReactNode; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-st-danger/25 bg-st-danger/7 px-3.5 py-2.5 text-[13px] text-[#ff9a92]">
      <CircleAlert className="mt-0.5 size-4 shrink-0" />
      <span className="min-w-0 flex-1 leading-relaxed">{children}</span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border border-st-danger/30 px-3 text-xs text-[#ffb3ad] transition-colors hover:bg-st-danger/10"
        >
          <RotateCw className="size-3" />
          Retry
        </button>
      )}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, children, action, className = "" }: { icon: LucideIcon; title: string; children?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 px-6 py-10 text-center ${className}`}>
      <span className="flex size-11 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.04] text-white/50">
        <Icon className="size-5" strokeWidth={1.8} />
      </span>
      <div className="flex max-w-[38ch] flex-col gap-1">
        <p className="text-[14px] font-medium text-white/85">{title}</p>
        {children && <p className="text-[13px] leading-relaxed text-white/45">{children}</p>}
      </div>
      {action}
    </div>
  );
}

/** Every page section: icon + title + optional count/action in the header, body below. */
export function SectionCard({
  icon: Icon,
  title,
  subtitle,
  count,
  action,
  children,
  className = "",
  bodyClassName = "p-4",
  id,
}: {
  icon?: LucideIcon;
  title: string;
  subtitle?: ReactNode;
  count?: number | string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  id?: string;
}) {
  return (
    <section id={id} aria-label={title} className={`flex min-w-0 flex-col rounded-[22px] ${SURFACE} ${className}`}>
      <header className="flex min-h-14 shrink-0 items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-[15px] font-medium text-white">
            {Icon && <Icon className="size-4 shrink-0 text-white/60" strokeWidth={1.8} />}
            <span className="truncate">{title}</span>
          </h2>
          {subtitle && <p className="mt-0.5 truncate text-[12px] text-white/45">{subtitle}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {action}
          {count != null && <span className={`${TAG} font-mono tabular-nums`}>{count}</span>}
        </div>
      </header>
      <div className={`min-h-0 ${bodyClassName}`}>{children}</div>
    </section>
  );
}

/** Agent identity: a drawn icon in a ring of the agent's colour. */
export function AgentAvatar({ agent, size = 36, working = false }: { agent: string | null | undefined; size?: number; working?: boolean }) {
  const meta = agentMeta(agent);
  const Icon = meta.icon;
  return (
    <span
      aria-hidden="true"
      className="relative inline-flex shrink-0 items-center justify-center rounded-full"
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at 30% 25%, ${meta.color}38, ${meta.color}10 70%)`,
        boxShadow: `inset 0 0 0 1.5px ${meta.color}b3, 0 0 18px -6px ${meta.color}`,
      }}
    >
      <Icon style={{ color: meta.color, width: size * 0.46, height: size * 0.46 }} strokeWidth={2} />
      {working && (
        <span className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full bg-st-active ring-2 ring-node" />
      )}
    </span>
  );
}

export function CopyButton({ text, label = "Copy", className = "" }: { text: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          const ta = document.createElement("textarea");
          ta.value = text;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          ta.remove();
        }
        setDone(true);
        setTimeout(() => setDone(false), 1600);
      }}
      aria-label={done ? "Copied" : `${label} message`}
      className={`inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 text-[12px] whitespace-nowrap text-white/75 transition-colors hover:border-white/20 hover:bg-white/[0.08] hover:text-white ${className}`}
    >
      {done ? <Check className="size-3.5 text-[#5fe0ad]" /> : <Copy className="size-3.5" />}
      {done ? "Copied" : label}
    </button>
  );
}

export function Toggle({ checked, onChange, label, disabled = false }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-10 shrink-0 items-center rounded-full border transition-colors duration-200 disabled:opacity-40 ${
        checked ? "border-st-active/50 bg-st-active/70" : "border-white/12 bg-white/[0.08]"
      }`}
    >
      <span
        className={`inline-block size-[18px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.5)] transition-transform duration-200 ${checked ? "translate-x-[18px]" : "translate-x-[2px]"}`}
      />
    </button>
  );
}

/** WhatsApp formatting: *bold*, _italic_, ~strike~, `code`, line breaks. Plain React nodes, no HTML injection. */
export function WaText({ text, className = "" }: { text: string; className?: string }) {
  const lines = text.split("\n");
  return (
    <span className={`break-words whitespace-pre-wrap ${className}`}>
      {lines.map((line, i) => (
        <Fragment key={i}>
          {formatLine(line)}
          {i < lines.length - 1 && "\n"}
        </Fragment>
      ))}
    </span>
  );
}

function formatLine(line: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(`[^`\n]+`)|(\*[^*\n]+\*)|(_[^_\n]+_)|(~[^~\n]+~)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(line))) {
    if (m.index > last) out.push(line.slice(last, m.index));
    const tok = m[0];
    const inner = tok.slice(1, -1);
    if (m[1]) out.push(<code key={k++} className="rounded bg-white/[0.08] px-1 py-px font-mono text-[0.92em] text-white/90">{inner}</code>);
    else if (m[2]) out.push(<strong key={k++} className="font-semibold text-white">{inner}</strong>);
    else if (m[3]) out.push(<em key={k++}>{inner}</em>);
    else out.push(<s key={k++}>{inner}</s>);
    last = m.index + tok.length;
  }
  if (last < line.length) out.push(line.slice(last));
  return out;
}

export function Field({ label, hint, error, children, htmlFor, badge }: { label: string; hint?: ReactNode; error?: string; children: ReactNode; htmlFor?: string; badge?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <label htmlFor={htmlFor} className="text-[13px] font-medium text-white/85">
          {label}
        </label>
        {badge}
      </div>
      {children}
      {error ? <p className="text-[12px] text-[#ff9a92]">{error}</p> : hint ? <p className="text-[12px] leading-relaxed text-white/40">{hint}</p> : null}
    </div>
  );
}

export const INPUT =
  "h-9 w-full min-w-0 rounded-[10px] border border-white/10 bg-black/40 px-3 text-[13px] text-white placeholder:text-white/30 transition-colors hover:border-white/20 focus:border-st-active/60 focus:outline-none focus-visible:outline-none focus:ring-2 focus:ring-st-active/25";

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string; count?: number }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="inline-flex h-8 w-fit max-w-full shrink-0 items-center self-start overflow-x-auto gap-0.5 rounded-full border border-white/10 bg-white/[0.03] p-0.5">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(o.value)}
            className={`relative inline-flex h-full items-center gap-1.5 rounded-full px-3 text-[12px] whitespace-nowrap transition-colors ${on ? "text-white" : "text-white/55 hover:text-white/85"}`}
          >
            {on && <motion.span layoutId={`seg-${label}`} className="absolute inset-0 rounded-full border border-white/12 bg-white/[0.09]" transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
            <span className="relative">{o.label}</span>
            {o.count != null && <span className="relative font-mono text-[11px] text-white/40 tabular-nums">{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** An image that shows a quiet placeholder instead of the browser's broken-image icon and alt text. */
export function Img({ className = "", alt = "", ...rest }: ImgHTMLAttributes<HTMLImageElement>) {
  const [failed, setFailed] = useState(false);
  if (failed || !rest.src) {
    return (
      <span role="img" aria-label={alt ? `${alt} (not available)` : "Image not available"} title="Image not available" className={`flex items-center justify-center bg-white/[0.04] text-white/30 ${className}`}>
        <ImageOff className="size-4" />
      </span>
    );
  }
  return <img {...rest} alt={alt} className={className} onError={() => setFailed(true)} />;
}

/** First letters of a display name, skipping emoji and symbols (WhatsApp push names often have them). */
export function initialsOf(name: string | null | undefined) {
  const words = (name ?? "").split(/\s+/).filter(Boolean);
  const letters = words.map((w) => [...w].find((ch) => /\p{L}|\p{N}/u.test(ch))).filter(Boolean) as string[];
  return (letters.slice(0, 2).join("") || "?").toUpperCase();
}
