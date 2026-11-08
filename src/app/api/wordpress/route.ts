import { CORS_HEADERS } from "@/lib/api";
import { CacheMissError } from "@/lib/cache";
import { log } from "@/lib/log";
import { clientIp, rateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import {
  interpretStableCheck,
  loadWordPressStableCheck,
  normalizeWordPressVersion,
  wordpressStatusCopy,
  WORDPRESS_STABLE_CHECK,
} from "@/lib/wordpress-status";

export const maxDuration = 30;

function json(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return Response.json(body, { status, headers: { ...CORS_HEADERS, "cache-control": "no-store", ...extra } });
}

/** GET /api/wordpress?v=6.4.2 — status labels from api.wordpress.org only. No CVE list. */
export async function GET(request: Request) {
  const limit = rateLimit(`wordpress:${clientIp(request)}`, 20, 5 * 60 * 1000);
  const rl = rateLimitHeaders(limit);
  if (!limit.ok) {
    return json({ error: "Too many WordPress checks from this address.", code: "rate_limited", status: 429 }, 429, {
      ...rl,
      "retry-after": String(limit.retryAfterSeconds),
    });
  }
  const raw = new URL(request.url).searchParams.get("v") ?? "";
  if (!raw.trim()) return json({ error: "Missing version. Pass ?v=6.4.2.", code: "missing_version", status: 400 }, 400, rl);
  const version = normalizeWordPressVersion(raw);
  if (!version) return json({ error: "Use a WordPress core version such as 6.4.2.", code: "invalid_version", status: 400 }, 400, rl);

  try {
    const loaded = await loadWordPressStableCheck();
    const interpreted = interpretStableCheck(loaded.map, version);
    return json({
      version,
      status: interpreted.status,
      listed: interpreted.listed,
      latest: interpreted.latest,
      summary: wordpressStatusCopy(interpreted.status, interpreted.listed),
      source: WORDPRESS_STABLE_CHECK,
      retrievedAt: loaded.retrievedAt,
      stale: loaded.stale,
      limitation: "Plugin and theme vulnerabilities are not covered. No CVE list is generated from this status.",
    }, 200, rl);
  } catch (error) {
    if (error instanceof CacheMissError) {
      return json({ error: "WordPress.org stable-check is unavailable right now.", code: "data_unavailable", status: 503 }, 503, rl);
    }
    log.error("api.wordpress.failed", { error });
    return json({ error: "WordPress.org stable-check is unavailable right now.", code: "data_unavailable", status: 503 }, 503, rl);
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
