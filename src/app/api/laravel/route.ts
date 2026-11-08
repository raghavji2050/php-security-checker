import { CORS_HEADERS } from "@/lib/api";
import { CacheMissError } from "@/lib/cache";
import { laravelMajor, laravelSupportState, loadLaravelSupport, normalizeLaravelVersion } from "@/lib/laravel-support";
import { log } from "@/lib/log";
import { auditComposerPackages } from "@/lib/packagist-advisories";
import { clientIp, rateLimit, rateLimitHeaders } from "@/lib/rate-limit";

export const maxDuration = 60;

function json(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return Response.json(body, { status, headers: { ...CORS_HEADERS, "cache-control": "no-store", ...extra } });
}

/** GET /api/laravel?v=11.31.0 — official support table plus Packagist advisories for laravel/framework. */
export async function GET(request: Request) {
  const limit = rateLimit(`laravel:${clientIp(request)}`, 15, 5 * 60 * 1000);
  const rl = rateLimitHeaders(limit);
  if (!limit.ok) {
    return json({ error: "Too many Laravel checks from this address.", code: "rate_limited", status: 429 }, 429, {
      ...rl,
      "retry-after": String(limit.retryAfterSeconds),
    });
  }
  const raw = new URL(request.url).searchParams.get("v") ?? "";
  if (!raw.trim()) return json({ error: "Missing version. Pass ?v=11.31.0.", code: "missing_version", status: 400 }, 400, rl);
  const version = normalizeLaravelVersion(raw);
  if (!version) return json({ error: "Use a stable MAJOR.MINOR.PATCH version, for example 11.31.0.", code: "invalid_version", status: 400 }, 400, rl);
  const major = laravelMajor(version);

  const [supportResult, auditResult] = await Promise.allSettled([
    loadLaravelSupport(),
    auditComposerPackages([{ name: "laravel/framework", version }]),
  ]);

  if (supportResult.status === "rejected" && auditResult.status === "rejected") {
    log.error("api.laravel.failed", { error: supportResult.reason });
    const unavailable = supportResult.reason instanceof CacheMissError || auditResult.reason instanceof CacheMissError;
    return json({
      error: "Laravel support data and Packagist advisories are both unavailable right now.",
      code: "data_unavailable",
      status: 503,
    }, unavailable ? 503 : 503, rl);
  }

  const support = supportResult.status === "fulfilled" ? supportResult.value : null;
  const row = support && major !== null ? support.rows.find((item) => item.major === major) ?? null : null;
  const today = new Date().toISOString().slice(0, 10);
  const state = row && support ? laravelSupportState(row, today) : null;

  return json({
    version,
    package: "laravel/framework",
    today,
    support: support
      ? {
          state: state?.state ?? "unknown",
          detail: row
            ? state?.detail
            : `Laravel ${major} is not in the support table that was read. No end date was guessed.`,
          row,
          source: support.source,
          retrievedAt: support.retrievedAt,
          stale: support.stale,
        }
      : null,
    supportError: supportResult.status === "rejected" ? "The official Laravel release notes could not be loaded." : null,
    advisories: auditResult.status === "fulfilled" ? auditResult.value : null,
    advisoryError: auditResult.status === "rejected" ? "Packagist advisories could not be loaded." : null,
    limitation:
      "This checks the version string you entered against Laravel's published support table and Packagist advisories for laravel/framework only. It does not open your application, scan plugins, or read APP_KEY.",
  }, 200, rl);
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
