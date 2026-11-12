import { getOrLoad, secondsFromEnv } from "@/lib/cache";
import { fetchText } from "@/lib/http";
import { log } from "@/lib/log";

/** Official CISA Known Exploited Vulnerabilities catalog (public JSON feed). */
export const KEV_URL = "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json";
export const KEV_CATALOG_PAGE = "https://www.cisa.gov/known-exploited-vulnerabilities-catalog";

export type KevEntry = {
  cveId: string;
  name: string | null;
  dateAdded: string | null;
  dueDate: string | null;
  /** CISA's own value: "Known" or "Unknown". */
  ransomware: "Known" | "Unknown" | null;
  requiredAction: string | null;
};

export type KevCatalog = {
  version: string | null;
  released: string | null;
  entries: Record<string, KevEntry>;
};

export type KevLookup = {
  /** Only the entries for the CVE IDs that were asked for. */
  entries: Record<string, KevEntry>;
  version: string | null;
  retrievedAt: string | null;
  /** False when the feed could not be loaded; then "not listed" must not be claimed. */
  ok: boolean;
};

const ID_RE = /^CVE-\d{4}-\d{4,}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function date(value: unknown): string | null {
  const v = text(value);
  return v && DATE_RE.test(v.slice(0, 10)) ? v.slice(0, 10) : null;
}

export function parseKevCatalog(payload: unknown): KevCatalog {
  const empty: KevCatalog = { version: null, released: null, entries: {} };
  if (!payload || typeof payload !== "object") return empty;
  const root = payload as Record<string, unknown>;
  const list = root.vulnerabilities;
  if (!Array.isArray(list)) return empty;
  const entries: Record<string, KevEntry> = {};
  for (const raw of list) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Record<string, unknown>;
    const id = text(row.cveID)?.toUpperCase();
    if (!id || !ID_RE.test(id)) continue;
    const ransom = text(row.knownRansomwareCampaignUse);
    entries[id] = {
      cveId: id,
      name: text(row.vulnerabilityName),
      dateAdded: date(row.dateAdded),
      dueDate: date(row.dueDate),
      ransomware: ransom === "Known" || ransom === "Unknown" ? ransom : null,
      requiredAction: text(row.requiredAction),
    };
  }
  return { version: text(root.catalogVersion), released: text(root.dateReleased), entries };
}

export function pickKev(catalog: KevCatalog, ids: Iterable<string>): Record<string, KevEntry> {
  const out: Record<string, KevEntry> = {};
  for (const id of ids) {
    const hit = catalog.entries[id.toUpperCase()];
    if (hit) out[hit.cveId] = hit;
  }
  return out;
}

const HOUR = 60 * 60;

/**
 * Look up CVE IDs in the CISA KEV catalog. Shares the raw-feed cache key with /news,
 * and never throws: on failure it returns ok=false so pages can simply hide the badge.
 */
export async function lookupKev(ids: Iterable<string>): Promise<KevLookup> {
  try {
    const cached = await getOrLoad({
      key: "news-cisa-kev-v1",
      ttlMs: secondsFromEnv("NEWS_CACHE_TTL_SECONDS", HOUR) * 1000,
      allowStale: true,
      load: () => fetchText(KEV_URL, {}, { timeoutMs: 30_000, retries: 3 }),
    });
    const catalog = parseKevCatalog(JSON.parse(cached.data));
    if (Object.keys(catalog.entries).length === 0) throw new Error("KEV feed had no entries");
    return { ok: true, entries: pickKev(catalog, ids), version: catalog.version, retrievedAt: cached.storedAt };
  } catch (error) {
    log.error("kev.failed", { error });
    return { ok: false, entries: {}, version: null, retrievedAt: null };
  }
}
