import { apiError, apiJson, corsPreflight } from "@/lib/api";
import { checkVersion } from "@/lib/check";
import { DataUnavailableError } from "@/lib/dataset";
import { clientIp, rateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { parsePhpVersion } from "@/lib/version";

export const maxDuration = 300;

const FORMAT_HINT = "Use MAJOR.MINOR.PATCH, for example 8.1.12. A branch such as 8.1 is not a release.";

/** Public API: GET /api/check?v=8.1.12 (the older ?version= is still accepted). */
export async function GET(request: Request) {
  const limit = rateLimit(`check:${clientIp(request)}`, 20, 5 * 60 * 1000);
  if (!limit.ok) {
    return apiError("rate_limited", "Too many checks from this address. Try again shortly.", 429, {
      ...rateLimitHeaders(limit),
      "retry-after": String(limit.retryAfterSeconds),
    });
  }

  const rl = rateLimitHeaders(limit);
  const params = new URL(request.url).searchParams;
  const raw = params.get("v") ?? params.get("version");
  if (raw === null || raw.trim() === "") {
    return apiError("missing_version", `Missing version. Pass ?v=X.Y.Z. ${FORMAT_HINT}`, 400, rl);
  }
  const version = raw.length > 32 ? null : parsePhpVersion(raw);
  if (!version) {
    return apiError("invalid_version", `Invalid version. ${FORMAT_HINT}`, 400, rl);
  }

  try {
    const result = await checkVersion(version.raw);
    return apiJson(result, 200, rl);
  } catch (error) {
    if (error instanceof DataUnavailableError) {
      return apiError("data_unavailable", error.message, 503, rl, {
        securityStatus: "unable_to_verify",
        version: version.raw,
      });
    }
    console.error("version check failed");
    return apiError("internal_error", "The check could not be completed.", 500, rl);
  }
}

export function OPTIONS() {
  return corsPreflight();
}
