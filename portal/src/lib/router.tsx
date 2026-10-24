// A small history router: the portal has a handful of flat routes, and ?demo=1 must survive every navigation.
import { useSyncExternalStore, type AnchorHTMLAttributes, type MouseEvent, type ReactNode } from "react";

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
window.addEventListener("popstate", notify);

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export const usePath = () => useSyncExternalStore(subscribe, () => window.location.pathname);
export const useSearch = () => useSyncExternalStore(subscribe, () => window.location.search);

/** Keeps the demo flag on internal links. */
export function withDemo(to: string) {
  if (!new URLSearchParams(window.location.search).has("demo")) return to;
  const [path, query = ""] = to.split("?");
  const q = new URLSearchParams(query);
  q.set("demo", "1");
  return `${path}?${q.toString()}`;
}

export function navigate(to: string, { replace = false } = {}) {
  const href = withDemo(to);
  if (href === window.location.pathname + window.location.search) return;
  if (replace) window.history.replaceState(null, "", href);
  else window.history.pushState(null, "", href);
  notify();
  document.getElementById("portal-scroll")?.scrollTo({ top: 0 });
}

/** Sets or clears one query parameter without adding a history entry. */
export function setParam(key: string, value: string | null) {
  const q = new URLSearchParams(window.location.search);
  if (value == null || value === "") q.delete(key);
  else q.set(key, value);
  const s = q.toString();
  window.history.replaceState(null, "", `${window.location.pathname}${s ? `?${s}` : ""}`);
  notify();
}

export function Link({ to, children, onClick, ...rest }: { to: string; children: ReactNode } & AnchorHTMLAttributes<HTMLAnchorElement>) {
  const href = withDemo(to);
  return (
    <a
      {...rest}
      href={href}
      onClick={(e: MouseEvent<HTMLAnchorElement>) => {
        onClick?.(e);
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        navigate(to);
      }}
    >
      {children}
    </a>
  );
}

/** Matches "/sessions/:name" style patterns. Returns params or null. */
export function match(pattern: string, path: string): Record<string, string> | null {
  const p = pattern.split("/").filter(Boolean);
  const s = path.split("/").filter(Boolean);
  if (p.length !== s.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < p.length; i++) {
    if (p[i].startsWith(":")) params[p[i].slice(1)] = decodeURIComponent(s[i]);
    else if (p[i] !== s[i]) return null;
  }
  return params;
}
