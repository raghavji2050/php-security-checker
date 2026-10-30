type Bucket = {
  hits: number[];
};

const buckets = new Map<string, Bucket>();

/** Upper bound on tracked keys so a flood of distinct addresses can't grow memory without limit. */
const MAX_KEYS = 5000;

export type RateLimitResult = {
  ok: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
};

function prune(now: number, windowMs: number): void {
  for (const [key, bucket] of buckets) {
    if (bucket.hits.every((hit) => now - hit >= windowMs)) buckets.delete(key);
  }
  // Still too many: drop the oldest-inserted keys (Map keeps insertion order).
  while (buckets.size >= MAX_KEYS) {
    const oldest = buckets.keys().next().value;
    if (oldest === undefined) break;
    buckets.delete(oldest);
  }
}

/** Sliding-window, in-memory limiter (per server instance; no paid service needed). */
export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()): RateLimitResult {
  if (!buckets.has(key) && buckets.size >= MAX_KEYS) prune(now, windowMs);
  const bucket = buckets.get(key) ?? { hits: [] };
  bucket.hits = bucket.hits.filter((hit) => now - hit < windowMs);
  if (bucket.hits.length >= limit) {
    const oldest = bucket.hits[0] ?? now;
    const retryAfterSeconds = Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000));
    buckets.set(key, bucket);
    return { ok: false, limit, remaining: 0, retryAfterSeconds };
  }
  bucket.hits.push(now);
  buckets.set(key, bucket);
  return { ok: true, limit, remaining: limit - bucket.hits.length, retryAfterSeconds: 0 };
}

/** Standard-ish rate limit headers for API responses. */
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    "x-ratelimit-limit": String(result.limit),
    "x-ratelimit-remaining": String(result.remaining),
  };
}

export function clientIp(request: Request): string {
  // On Vercel, x-vercel-forwarded-for is set by the platform and can't be spoofed by the client.
  for (const header of ["x-vercel-forwarded-for", "x-forwarded-for"]) {
    const value = request.headers.get(header);
    const first = value?.split(",")[0]?.trim();
    if (first) return first.slice(0, 80);
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp.slice(0, 80);
  return "local";
}

export function trackedKeyCount(): number {
  return buckets.size;
}

export function resetRateLimits(): void {
  buckets.clear();
}
