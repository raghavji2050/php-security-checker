import { gunzipSync, gzipSync } from "node:zlib";
import { getCache } from "@vercel/functions";
import type { CacheEnvelope } from "@/lib/cache";

/**
 * Second cache tier shared by every serverless instance in a region (Vercel Runtime Cache).
 * Each instance's /tmp and memory start empty, so without this a cold instance had to refetch
 * the whole NVD dataset (18-27s). Values are gzipped because the NVD copy is ~4.7 MB as JSON and
 * a Runtime Cache item is capped at 2 MB. Outside Vercel (local dev, tests, Docker) it is off.
 */
export type SharedStore = {
  get: (key: string) => Promise<unknown | null>;
  set: (key: string, value: unknown, options?: { ttl?: number; name?: string }) => Promise<void>;
};

const MAX_ITEM_BYTES = 1_900_000;
// Keep entries well past their freshness TTL so a slow or failing upstream can still be served stale.
const SHARED_TTL_SECONDS = 7 * 24 * 60 * 60;

let override: SharedStore | null | undefined;

/** Test hook: pass a fake store, null to disable, or undefined to restore auto-detection. */
export function setSharedStore(store: SharedStore | null | undefined) {
  override = store;
}

function store(): SharedStore | null {
  if (override !== undefined) return override;
  if (process.env.SHARED_CACHE === "off") return null;
  if (!process.env.RUNTIME_CACHE_ENDPOINT || !process.env.RUNTIME_CACHE_HEADERS) return null;
  return getCache({ namespace: "psc" });
}

export function sharedCacheEnabled(): boolean {
  return store() !== null;
}

export async function readShared<T>(key: string): Promise<CacheEnvelope<T> | null> {
  const s = store();
  if (!s) return null;
  try {
    const raw = await s.get(key);
    if (typeof raw !== "string") return null;
    const envelope = JSON.parse(gunzipSync(Buffer.from(raw, "base64")).toString("utf8")) as CacheEnvelope<T>;
    if (!envelope || typeof envelope.storedAt !== "string" || typeof envelope.ttlMs !== "number" || !("data" in envelope)) {
      return null;
    }
    return envelope;
  } catch {
    // A cache problem must never break a check; fall through to the next tier.
    return null;
  }
}

export async function writeShared<T>(key: string, envelope: CacheEnvelope<T>): Promise<boolean> {
  const s = store();
  if (!s) return false;
  try {
    const packed = gzipSync(JSON.stringify(envelope)).toString("base64");
    if (packed.length > MAX_ITEM_BYTES) {
      console.warn(`shared cache: ${key} too large (${packed.length} bytes), not stored`);
      return false;
    }
    await s.set(key, packed, { ttl: SHARED_TTL_SECONDS, name: key });
    return true;
  } catch {
    console.warn(`shared cache: write failed for ${key}`);
    return false;
  }
}
