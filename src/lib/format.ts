import type { Ts } from "@shared/types";

const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });
const dateTimeFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
const timeFmt = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit" });

export function toMs(ts: Ts | null | undefined): number | null {
  return ts ? ts.toMillis() : null;
}

export function formatDate(ts: Ts | number | null | undefined): string {
  if (ts == null) return "—";
  return dateFmt.format(typeof ts === "number" ? ts : ts.toDate());
}

export function formatDateTime(ts: Ts | number | null | undefined): string {
  if (ts == null) return "—";
  return dateTimeFmt.format(typeof ts === "number" ? ts : ts.toDate());
}

export function formatTime(ts: Ts | number | null | undefined): string {
  if (ts == null) return "";
  return timeFmt.format(typeof ts === "number" ? ts : ts.toDate());
}

export function formatRelative(ms: number, nowMs: number = Date.now()): string {
  const diff = ms - nowMs;
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (abs < 60_000) return diff < 0 ? "just now" : "in under a minute";
  if (abs < 3_600_000) return rtf.format(Math.round(diff / 60_000), "minute");
  if (abs < 86_400_000) return rtf.format(Math.round(diff / 3_600_000), "hour");
  return rtf.format(Math.round(diff / 86_400_000), "day");
}

/** "2d 4h", "3h 12m", "4m 09s" */
export function formatDuration(ms: number): string {
  if (ms <= 0) return "0s";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  return `${m}m ${String(sec).padStart(2, "0")}s`;
}

export function newRequestId(): string {
  return crypto.randomUUID();
}
