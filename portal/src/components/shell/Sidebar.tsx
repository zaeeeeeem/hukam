import { motion } from "motion/react";
import {
  Activity,
  BookOpen,
  Bot,
  HeartPulse,
  Images,
  MessagesSquare,
  PanelLeft,
  Radio,
  Settings2,
  ShieldAlert,
  type LucideIcon,
} from "lucide-react";
import { Link, usePath } from "../../lib/router";
import { usePortal, type Live } from "../../lib/store";
import { phone, plural } from "../../lib/format";
import { sessionStatus } from "../../lib/vocab";
import { AgentAvatar, Skeleton, TONE } from "../ui/primitives";
import { LaserBorder, LogoOrb } from "../ui/surface";

type NavItem = { label: string; href: string; icon: LucideIcon; count?: "approvals" | "working" };

const NAV: NavItem[] = [
  { label: "Live", href: "/", icon: Radio },
  { label: "Agents", href: "/sessions", icon: Bot, count: "working" },
  { label: "Chats", href: "/chats", icon: MessagesSquare },
  { label: "Approvals", href: "/approvals", icon: ShieldAlert, count: "approvals" },
  { label: "Gallery", href: "/gallery", icon: Images },
  { label: "Use cases", href: "/use-cases", icon: BookOpen },
  { label: "Settings", href: "/settings", icon: Settings2 },
  { label: "System", href: "/system", icon: HeartPulse },
];

export const SIDEBAR_W = 248;
export const SIDEBAR_W_COLLAPSED = 72;

export const LIVE_LABEL: Record<Live, { label: string; tone: "success" | "attention" | "muted" | "active"; title: string }> = {
  dnotifier: { label: "Live · DNotifier", tone: "success", title: "Events arrive over DNotifier realtime" },
  sse: { label: "Live · local stream", tone: "success", title: "Events arrive over the router's local stream (DNotifier not configured)" },
  connecting: { label: "Connecting…", tone: "muted", title: "Connecting to the Hukam router" },
  offline: { label: "Reconnecting…", tone: "attention", title: "Lost the router. Showing the last known state and retrying." },
  demo: { label: "Demo data", tone: "active", title: "Scripted demo traffic. Nothing here touches WhatsApp or agents." },
};

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const path = usePath();
  const { state, load, live, demo } = usePortal();
  const pendingCount = state?.approvals.pending.length ?? 0;
  const working = state?.sessions.filter((s) => s.status === "working").length ?? 0;
  const roster = state ? [...state.sessions].sort((a, b) => rank(a.status) - rank(b.status)).slice(0, 6) : [];
  const liveMeta = LIVE_LABEL[live];

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? SIDEBAR_W_COLLAPSED : SIDEBAR_W }}
      transition={{ type: "spring", stiffness: 320, damping: 36 }}
      className="relative flex h-full shrink-0 flex-col overflow-hidden rounded-[22px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06)_0%,rgba(255,255,255,0.015)_40%,rgba(255,255,255,0.03)_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_30px_60px_-30px_rgba(0,0,0,0.9)] backdrop-blur-2xl"
      aria-label="Portal navigation"
    >
      <div aria-hidden="true" className="pointer-events-none absolute -top-24 -left-16 size-64 rounded-full bg-fu-glow-blue/25 blur-[80px]" />
      <div aria-hidden="true" className="pointer-events-none absolute -right-20 -bottom-24 size-64 rounded-full bg-fu-orange/15 blur-[90px]" />

      <div className={`relative flex h-16 shrink-0 items-center ${collapsed ? "justify-center" : "justify-between pr-3 pl-4"}`}>
        {!collapsed && (
          <Link to="/" className="flex items-center gap-2.5 rounded-lg" title="Hukam: live">
            <LogoOrb size={30} />
            <span className="font-display text-[20px] leading-none text-white">Hukam</span>
            <span className="font-display text-[15px] leading-none text-white/40" lang="ur">
              حکم
            </span>
          </Link>
        )}
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? "Expand sidebar ( [ )" : "Collapse sidebar ( [ )"}
          title={collapsed ? "Expand  [" : "Collapse  ["}
          className="flex size-9 items-center justify-center rounded-lg text-white/55 transition-colors hover:bg-white/8 hover:text-white"
        >
          <PanelLeft className="size-[18px]" strokeWidth={1.8} />
        </button>
      </div>

      <div className={`relative mx-3 mb-3 rounded-xl border border-white/10 bg-white/[0.04] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] ${collapsed ? "flex justify-center py-2" : "px-3 py-2.5"}`}>
        {collapsed ? (
          <Activity className="size-4 text-white/60" aria-hidden="true" />
        ) : load !== "ready" || !state ? (
          <div className="space-y-1.5">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-3 w-20" />
          </div>
        ) : (
          <>
            <p className="truncate text-[13px] font-medium text-white">Owner {phone(state.owner.phone)}</p>
            <p className="truncate text-[12px] text-white/45">
              {plural(state.settings.allow.length, "number")} · {plural(state.settings.groups.length, "group")}
            </p>
          </>
        )}
      </div>

      <nav className="relative flex flex-col gap-0.5 px-3" aria-label="Pages">
        {NAV.map((item) => {
          const active = item.href === "/" ? path === "/" : path === item.href || path.startsWith(`${item.href}/`);
          const count = item.count === "approvals" ? pendingCount : item.count === "working" ? working : 0;
          const attention = item.count === "approvals";
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              to={item.href}
              aria-current={active ? "page" : undefined}
              title={collapsed ? item.label : undefined}
              className={`relative flex h-10 items-center gap-3 rounded-[11px] text-[14px] transition-colors hover:bg-white/5 ${collapsed ? "justify-center" : "px-3"}`}
            >
              {active && (
                <motion.span
                  layoutId="nav-active"
                  className="absolute inset-0 rounded-[11px] border border-white/12 bg-white/[0.07] shadow-[inset_0_1px_0_rgba(255,255,255,0.10)]"
                  transition={{ type: "spring", stiffness: 400, damping: 36 }}
                />
              )}
              <span className="relative">
                <Icon className={`size-[18px] ${active ? "text-white" : "text-white/55"}`} strokeWidth={1.8} />
                {collapsed && count > 0 && <span className={`absolute -top-1.5 -right-1.5 size-2 rounded-full ring-2 ring-[#0b0c0f] ${attention ? "bg-st-attention" : "bg-st-active"}`} />}
              </span>
              {!collapsed && (
                <>
                  <span className={`relative flex-1 truncate ${active ? "text-white" : "text-white/70"}`}>{item.label}</span>
                  {count > 0 && (
                    <span
                      className={`relative min-w-5 rounded-full px-1.5 text-center font-mono text-[11px] leading-5 ring-1 ring-inset ${
                        attention ? "bg-st-attention/15 text-[#ffa46b] ring-st-attention/35" : "bg-st-active/12 text-[#5cc2ff] ring-st-active/30"
                      }`}
                      title={attention ? `${count} waiting for your decision` : `${count} working`}
                    >
                      {count}
                    </span>
                  )}
                </>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="relative mt-5 min-h-0 flex-1 overflow-y-auto px-3 pb-2">
        {!collapsed && (
          <div className="mb-2 flex items-center justify-between px-3">
            <p className="flex items-center gap-1.5 text-[11px] font-medium tracking-[0.08em] text-white/45 uppercase">
              <Bot className="size-3.5 text-white/60" />
              Agents
            </p>
            {state && <span className="text-[11px] text-white/35">{working > 0 ? `${working} working` : plural(state.sessions.length, "session")}</span>}
          </div>
        )}
        <ul className="flex flex-col gap-1">
          {load === "loading" &&
            Array.from({ length: 4 }).map((_, i) => (
              <li key={i} className={`flex h-12 items-center gap-3 ${collapsed ? "justify-center" : "px-2.5"}`}>
                <Skeleton className="size-8 rounded-full" />
                {!collapsed && <Skeleton className="h-3 w-24" />}
              </li>
            ))}
          {state && roster.length === 0 && !collapsed && <li className="px-3 py-2 text-[12px] leading-relaxed text-white/35">No agents yet. Send a task from WhatsApp or the Live page.</li>}
          {roster.map((s) => {
            const st = sessionStatus(s.status);
            const isWorking = s.status === "working";
            const row = (
              <Link
                to={`/sessions/${encodeURIComponent(s.name)}`}
                title={`${s.name} · ${st.label}`}
                aria-current={path === `/sessions/${s.name}` ? "page" : undefined}
                className={`flex h-12 w-full items-center gap-3 rounded-xl text-left transition-colors ${
                  isWorking ? "bg-white/[0.05] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] hover:bg-white/[0.08]" : "border border-transparent hover:border-white/8 hover:bg-white/[0.04]"
                } ${collapsed ? "justify-center" : "px-2.5"}`}
              >
                <AgentAvatar agent={s.agent} size={32} />
                {!collapsed && (
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-white/90">{s.name}</span>
                    <span className={`block truncate text-[11px] ${s.status === "idle" ? "text-white/40" : TONE[st.tone].text}`}>{st.label}</span>
                  </span>
                )}
              </Link>
            );
            return <li key={s.name}>{isWorking ? <LaserBorder radius={13}>{row}</LaserBorder> : row}</li>;
          })}
        </ul>
      </div>

      <div className={`relative flex shrink-0 flex-col gap-1 border-t border-white/8 p-3 ${collapsed ? "items-center" : ""}`}>
        <div className={`flex h-8 items-center gap-2 text-[12px] ${collapsed ? "justify-center" : "px-2"}`} title={liveMeta.title}>
          <span className={`size-2 shrink-0 rounded-full ${TONE[liveMeta.tone].dot} ${live === "dnotifier" || live === "sse" ? "live-breathe" : ""}`} aria-hidden="true" />
          {!collapsed && <span className={live === "offline" || live === "connecting" ? "text-white/45" : "text-white/70"}>{liveMeta.label}</span>}
        </div>
        {!collapsed && (
          <a href="/classic" className="flex h-8 items-center px-2 text-[12px] text-white/40 transition-colors hover:text-white/80">
            Classic dashboard
          </a>
        )}
        {demo && !collapsed && (
          <a href={window.location.pathname} className="flex h-8 items-center px-2 text-[12px] text-[#5cc2ff] transition-colors hover:text-white">
            Leave demo mode
          </a>
        )}
      </div>
    </motion.aside>
  );
}

const rank = (s: string) => ({ working: 0, blocked: 1, idle: 2, exited: 3, stopped: 4 })[s] ?? 5;
