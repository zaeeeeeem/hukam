import { AnimatePresence, motion } from "motion/react";
import { CheckCircle2, CircleAlert, Info, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { usePortal } from "../../lib/store";
import { TONE } from "../ui/primitives";
import { PILL } from "../ui/surface";
import { LIVE_LABEL, Sidebar } from "./Sidebar";

const COLLAPSE_KEY = "hukam.sidebar.collapsed";

export function Shell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSE_KEY) === "1");
  useEffect(() => localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0"), [collapsed]);

  // `[` toggles the sidebar (Linear convention). Ignored while typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName))) return;
      if (e.key === "[" && !e.metaKey && !e.ctrlKey && !e.altKey) setCollapsed((c) => !c);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="relative flex h-dvh w-full gap-3 overflow-hidden bg-black p-3 text-white">
      <a href="#portal-main" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:rounded-full focus:bg-white focus:px-4 focus:py-2 focus:text-black">
        Skip to content
      </a>
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -bottom-56 -left-40 size-[640px] rounded-full bg-fu-orange/20 blur-[160px]" />
        <div className="absolute -right-40 -bottom-56 size-[640px] rounded-full bg-fu-glow-blue/20 blur-[160px]" />
      </div>
      <div className="relative flex">
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      </div>
      <main id="portal-main" className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        <div id="portal-scroll" className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain pr-1">
          {children}
        </div>
      </main>
      <Toaster />
    </div>
  );
}

/** Page title + one line of live facts + the connection pill. Same on every page. */
export function PageHeader({ title, facts, actions }: { title: string; facts?: ReactNode; actions?: ReactNode }) {
  const { live, demo } = usePortal();
  const meta = LIVE_LABEL[live];
  return (
    <header className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 px-1 pt-1 pb-0.5">
      <div className="min-w-0">
        <h1 className="font-display text-[26px] leading-tight text-white">{title}</h1>
        <div className="flex min-h-5 items-center text-[13px] text-white/45">{facts}</div>
      </div>
      <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
        {actions}
        {demo && (
          <span className={`${PILL} border-st-active/35 bg-st-active/10 text-[#8fd3ff]`} title="Everything on screen is scripted demo data. Nothing is sent to WhatsApp or to agents.">
            <Info className="size-3.5" />
            Demo data
          </span>
        )}
        {!demo && (
          <span className={PILL} title={meta.title}>
            <span className={`size-2 rounded-full ${TONE[meta.tone].dot} ${live === "dnotifier" || live === "sse" ? "live-breathe" : ""}`} aria-hidden="true" />
            {meta.label}
          </span>
        )}
      </div>
    </header>
  );
}

function Toaster() {
  const { toasts, dismiss } = usePortal();
  return (
    <div aria-live="polite" className="pointer-events-none fixed right-5 bottom-5 z-50 flex w-[min(380px,calc(100vw-40px))] flex-col gap-2">
      <AnimatePresence initial={false}>
        {toasts.map((t) => {
          const Icon = t.tone === "danger" ? CircleAlert : t.tone === "success" ? CheckCircle2 : Info;
          const color = t.tone === "danger" ? "text-[#ff8f86]" : t.tone === "success" ? "text-[#5fe0ad]" : "text-white/70";
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 12, filter: "blur(4px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: 8, transition: { duration: 0.15 } }}
              transition={{ type: "spring", stiffness: 420, damping: 34 }}
              className="pointer-events-auto flex items-start gap-3 rounded-2xl border border-white/12 bg-[#101114]/95 px-4 py-3 text-[13px] leading-relaxed text-white/85 shadow-[0_24px_48px_-20px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-xl"
              role={t.tone === "danger" ? "alert" : "status"}
            >
              <Icon className={`mt-0.5 size-4 shrink-0 ${color}`} />
              <span className="min-w-0 flex-1 break-words">{t.text}</span>
              <button type="button" onClick={() => dismiss(t.id)} aria-label="Dismiss" className="-mr-1 flex size-6 shrink-0 items-center justify-center rounded-md text-white/40 hover:bg-white/8 hover:text-white">
                <X className="size-3.5" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
