export const pct = (n: number) => `${Math.round(n * 100)}%`;

export function compact(n: number | null | undefined) {
  if (n === null || n === undefined) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export function duration(mins: number) {
  if (mins >= 240) return "4h+";
  if (mins >= 60) return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  return `${Math.max(0, Math.round(mins))}m`;
}

export function ago(days: number) {
  if (!isFinite(days)) return "never";
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.round(days / 7)} weeks ago`;
  return `${Math.round(days / 30)} months ago`;
}

export function relative(d: Date | null | undefined) {
  if (!d) return "never";
  const mins = Math.round((Date.now() - d.getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
  return ago(Math.floor(mins / 1440));
}

export function clip(s: string, n: number) {
  return s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s;
}
