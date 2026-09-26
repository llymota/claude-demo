type Level = "debug" | "info" | "warn" | "error";

const SECRET_KEYS = /token|secret|password|authorization|cookie|credential/i;

function redact(value: unknown, depth = 0): unknown {
  if (depth > 4 || value === null || typeof value !== "object") return value;
  if (value instanceof Error) return { name: value.name, message: value.message };
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, SECRET_KEYS.test(k) ? "[redacted]" : redact(v, depth + 1)]));
}

function write(level: Level, event: string, data?: Record<string, unknown>) {
  if (level === "debug" && process.env.NODE_ENV === "production") return;
  const line = JSON.stringify({ level, event, time: new Date().toISOString(), ...(redact(data ?? {}) as object) });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

/** Structured JSON logs, one line per event, with secrets redacted. */
export const log = {
  debug: (e: string, d?: Record<string, unknown>) => write("debug", e, d),
  info: (e: string, d?: Record<string, unknown>) => write("info", e, d),
  warn: (e: string, d?: Record<string, unknown>) => write("warn", e, d),
  error: (e: string, d?: Record<string, unknown>) => write("error", e, d),
};
