// Structured server logging: one JSON line per event so Vercel logs are searchable.
// Never pass request bodies or headers here. Keys that look like secrets are redacted and
// long strings are trimmed, so a mistake can't leak a token into the logs.

export type LogLevel = "info" | "warn" | "error";
type Fields = Record<string, unknown>;

const SECRET_KEY = /(pass(word)?|secret|token|api[-_]?key|authorization|cookie|session|credential|private)/i;
const MAX_STRING = 300;
const MAX_DEPTH = 3;

function clean(value: unknown, depth: number): unknown {
  if (value instanceof Error) return { name: value.name, message: clean(value.message, depth) };
  if (typeof value === "string") return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}…` : value;
  if (value === null || typeof value !== "object") return typeof value === "function" ? undefined : value;
  if (depth >= MAX_DEPTH) return "[truncated]";
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => clean(v, depth + 1));
  const out: Fields = {};
  for (const [key, v] of Object.entries(value as Fields)) {
    out[key] = SECRET_KEY.test(key) ? "[redacted]" : clean(v, depth + 1);
  }
  return out;
}

export function formatLog(level: LogLevel, event: string, fields: Fields = {}, now = new Date()): string {
  const safe = clean(fields, 0) as Fields;
  return JSON.stringify({ ts: now.toISOString(), level, event, ...safe });
}

function emit(level: LogLevel, event: string, fields?: Fields) {
  const line = formatLog(level, event, fields);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const log = {
  info: (event: string, fields?: Fields) => emit("info", event, fields),
  warn: (event: string, fields?: Fields) => emit("warn", event, fields),
  error: (event: string, fields?: Fields) => emit("error", event, fields),
};
