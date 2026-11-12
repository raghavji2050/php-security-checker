import { getOrLoad } from "@/lib/cache";
import { fetchText } from "@/lib/http";
import { log } from "@/lib/log";

/** FIRST.org EPSS API (free, public, no key). */
export const EPSS_API = "https://api.first.org/data/v1/epss";
export const EPSS_PAGE = "https://www.first.org/epss/";

export type EpssScore = {
  cveId: string;
  /** Probability of exploitation activity in the next 30 days, 0..1. */
  epss: number;
  /** Share of all scored CVEs with a lower or equal score, 0..1. */
  percentile: number;
  /** Date FIRST computed the score (YYYY-MM-DD). */
  date: string | null;
};

export type EpssLookup = { ok: true; score: EpssScore | null } | { ok: false; score: null };

const ID_RE = /^CVE-\d{4}-\d{4,}$/;

function unit(value: unknown): number | null {
  const n = typeof value === "string" ? Number(value) : typeof value === "number" ? value : NaN;
  return Number.isFinite(n) && n >= 0 && n <= 1 ? n : null;
}

/** Parse the FIRST EPSS API response; rows with bad numbers are dropped, never guessed. */
export function parseEpss(payload: unknown): Record<string, EpssScore> {
  const out: Record<string, EpssScore> = {};
  if (!payload || typeof payload !== "object") return out;
  const data = (payload as Record<string, unknown>).data;
  if (!Array.isArray(data)) return out;
  for (const raw of data) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Record<string, unknown>;
    const id = typeof row.cve === "string" ? row.cve.trim().toUpperCase() : "";
    const epss = unit(row.epss);
    const percentile = unit(row.percentile);
    if (!ID_RE.test(id) || epss === null || percentile === null) continue;
    const date = typeof row.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(row.date) ? row.date : null;
    out[id] = { cveId: id, epss, percentile, date };
  }
  return out;
}

/** "0.97%" style, keeping small values readable ("<0.01%"). */
export function formatProbability(value: number): string {
  const pct = value * 100;
  if (pct > 0 && pct < 0.01) return "<0.01%";
  // Never round a real score up to a certain-sounding 100%.
  if (pct < 100 && pct >= 99.95) return ">99.9%";
  return `${pct >= 10 ? pct.toFixed(1) : pct.toFixed(2)}%`;
}

/** "top 3%" style for the percentile. */
export function formatPercentile(value: number): string {
  const top = (1 - value) * 100;
  if (top < 1) return "top 1%";
  return `top ${Math.ceil(top)}%`;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Look up one CVE's EPSS score. Never throws: ok=false when FIRST is unreachable. */
export async function lookupEpss(id: string): Promise<EpssLookup> {
  const cveId = id.toUpperCase();
  if (!ID_RE.test(cveId)) return { ok: true, score: null };
  try {
    const cached = await getOrLoad({
      key: `epss-v1-${cveId}`,
      ttlMs: DAY_MS / 2,
      allowStale: true,
      load: () => fetchText(`${EPSS_API}?cve=${encodeURIComponent(cveId)}`, {}, { timeoutMs: 15_000, retries: 2 }),
    });
    const parsed = parseEpss(JSON.parse(cached.data));
    return { ok: true, score: parsed[cveId] ?? null };
  } catch (error) {
    log.error("epss.failed", { id: cveId, error });
    return { ok: false, score: null };
  }
}
