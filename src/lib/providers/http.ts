import { log } from "../log";
import { NotAvailable, RateLimited, ReauthRequired } from "./types";

interface Opts extends RequestInit {
  timeoutMs?: number;
  /** Label for logs, e.g. "x.search". */
  op: string;
}

/**
 * fetch with a timeout, one retry on 5xx/network errors, and platform errors
 * mapped to typed exceptions the sync engine knows how to handle.
 */
export async function fetchJson<T>(url: string, { timeoutMs = 15_000, op, ...init }: Opts): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
    } catch (err) {
      if (attempt === 0) continue;
      throw new Error(`${op}: network error (${(err as Error).message})`);
    }
    if (res.ok) {
      if (res.status === 204) return undefined as T;
      return (await res.json()) as T;
    }
    const body = await res.text().catch(() => "");
    if (res.status >= 500 && attempt === 0) continue;
    log.warn("provider.http_error", { op, status: res.status, body: body.slice(0, 300) });
    if (res.status === 401) throw new ReauthRequired();
    if (res.status === 429) {
      const reset = res.headers.get("x-rate-limit-reset") ?? res.headers.get("retry-after");
      const at = reset ? (Number(reset) > 1e9 ? new Date(Number(reset) * 1000) : new Date(Date.now() + Number(reset) * 1000)) : null;
      throw new RateLimited(at);
    }
    if (res.status === 403) throw new NotAvailable(`${op} is not available for this account or API tier`);
    throw new Error(`${op}: HTTP ${res.status}`);
  }
}

export function form(data: Record<string, string>) {
  return new URLSearchParams(data).toString();
}
