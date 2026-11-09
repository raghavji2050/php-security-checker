import { CORS_HEADERS } from "@/lib/api";
import { log } from "@/lib/log";
import { clientIp, rateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { checkSymfony, normalizeSymfonyVersion } from "@/lib/symfony-support";

export const maxDuration = 60;

function json(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return Response.json(body, { status, headers: { ...CORS_HEADERS, "cache-control": "no-store", ...extra } });
}

/** GET /api/symfony?v=7.4.10 — symfony.com support data plus Packagist advisories for symfony/symfony. */
export async function GET(request: Request) {
  const limit = rateLimit(`symfony:${clientIp(request)}`, 15, 5 * 60 * 1000);
  const rl = rateLimitHeaders(limit);
  if (!limit.ok) {
    return json({ error: "Too many Symfony checks from this address.", code: "rate_limited", status: 429 }, 429, {
      ...rl,
      "retry-after": String(limit.retryAfterSeconds),
    });
  }
  const raw = new URL(request.url).searchParams.get("v") ?? "";
  if (!raw.trim()) return json({ error: "Missing version. Pass ?v=7.4.10.", code: "missing_version", status: 400 }, 400, rl);
  const version = normalizeSymfonyVersion(raw);
  if (!version) return json({ error: "Use a stable MAJOR.MINOR.PATCH version, for example 7.4.10.", code: "invalid_version", status: 400 }, 400, rl);
  const result = await checkSymfony(version);
  if (result.supportError && result.advisoryError) {
    log.error("api.symfony.failed", { version });
    return json({ error: "Symfony release data and Packagist advisories are both unavailable right now.", code: "data_unavailable", status: 503 }, 503, rl);
  }
  return json(result, 200, rl);
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
