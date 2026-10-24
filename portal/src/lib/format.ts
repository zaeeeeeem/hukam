export const int = (n: number) => Math.round(n).toLocaleString("en-US");

export function timeAgo(t: number | string | null | undefined, now = Date.now()) {
  if (t == null) return "";
  const ms = now - (typeof t === "string" ? Date.parse(t) : t);
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export function duration(ms: number | null | undefined) {
  if (ms == null || Number.isNaN(ms)) return "";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  const s = ms / 1000;
  if (s < 60) return `${s < 10 ? s.toFixed(1) : Math.round(s)} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${Math.round(s % 60)}s`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}

export function clock(t: number | string | null | undefined) {
  if (t == null) return "";
  const d = new Date(typeof t === "string" ? Date.parse(t) : t);
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function dateTime(t: number | string | null | undefined) {
  if (t == null) return "";
  const d = new Date(typeof t === "string" ? Date.parse(t) : t);
  return d.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function bytes(n: number | null | undefined) {
  if (n == null) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1048576).toFixed(1)} MB`;
}

/** +92 312 448 7312 style, for E.164 digits. Unknown shapes come back with a plus. */
export function phone(digits: string | null | undefined) {
  if (!digits) return "";
  if (digits.startsWith("92") && digits.length === 12) return `+92 ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`;
  if (digits.startsWith("1") && digits.length === 11) return `+1 ${digits.slice(1, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  return `+${digits}`;
}

export const plural = (n: number, one: string, many = `${one}s`) => `${int(n)} ${n === 1 ? one : many}`;

/** Strips WhatsApp formatting marks for display (the portal shows plain text). */
export const plain = (s: string) => s.replace(/(^|\s)[*_~]([^*_~\n]+)[*_~](?=\s|$|[.,!?:])/g, "$1$2").replace(/`([^`]+)`/g, "$1");

export const sameDay = (a: number, b: number) => new Date(a).toDateString() === new Date(b).toDateString();
