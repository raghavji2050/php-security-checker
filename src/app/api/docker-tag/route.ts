import { CORS_HEADERS } from "@/lib/api";
import { CacheMissError } from "@/lib/cache";
import { loadDockerLibrary } from "@/lib/docker-library";
import {
  compareTagToLibrary,
  DOCKER_LIBRARY_DOC,
  libraryBranchFor,
  parsePhpImageRef,
  secureDockerfileExample,
} from "@/lib/docker-php";
import { log } from "@/lib/log";
import { clientIp, rateLimit, rateLimitHeaders } from "@/lib/rate-limit";

export const maxDuration = 30;

function json(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return Response.json(body, { status, headers: { ...CORS_HEADERS, "cache-control": "no-store", ...extra } });
}

/** GET /api/docker-tag?tag=php:8.3-fpm — official docker-library/php versions.json only. */
export async function GET(request: Request) {
  const limit = rateLimit(`docker:${clientIp(request)}`, 20, 5 * 60 * 1000);
  const rl = rateLimitHeaders(limit);
  if (!limit.ok) {
    return json({ error: "Too many Docker tag checks from this address.", code: "rate_limited", status: 429 }, 429, {
      ...rl,
      "retry-after": String(limit.retryAfterSeconds),
    });
  }
  const raw = new URL(request.url).searchParams.get("tag") ?? "";
  if (!raw.trim()) return json({ error: "Missing tag. Pass ?tag=php:8.3-fpm.", code: "missing_tag", status: 400 }, 400, rl);
  const parsed = parsePhpImageRef(raw);
  if ("ok" in parsed) return json({ error: parsed.reason, code: "invalid_tag", status: 400 }, 400, rl);

  try {
    const library = await loadDockerLibrary();
    const branch = libraryBranchFor(library.branches, parsed.phpBranch);
    const checkVersion = parsed.phpVersion ?? (parsed.floating ? branch?.version ?? null : null);
    return json({
      parsed,
      note: compareTagToLibrary(parsed, library.branches),
      library: {
        source: DOCKER_LIBRARY_DOC,
        retrievedAt: library.retrievedAt,
        stale: library.stale,
        branch: branch?.branch ?? null,
        currentPatch: branch?.version ?? null,
      },
      checkVersion,
      checkPath: checkVersion ? `/check/${checkVersion}` : null,
      exampleDockerfile: secureDockerfileExample(branch?.version ?? parsed.phpVersion),
      limitation: "This does not pull the image, scan packages inside it, or look up CVEs beyond the PHP version the tag names.",
    }, 200, rl);
  } catch (error) {
    if (error instanceof CacheMissError) {
      return json({ error: "The official PHP Docker library file is unavailable right now.", code: "data_unavailable", status: 503 }, 503, rl);
    }
    log.error("api.docker_tag.failed", { error });
    return json({ error: "The official PHP Docker library file is unavailable right now.", code: "data_unavailable", status: 503 }, 503, rl);
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
