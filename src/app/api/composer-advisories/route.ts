import { CORS_HEADERS } from "@/lib/api";
import { CacheMissError } from "@/lib/cache";
import { auditComposerPackages, MAX_API_PACKAGES } from "@/lib/packagist-advisories";
import { clientIp, rateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { isValidPackageName } from "@/lib/composer-lock";
import { log } from "@/lib/log";

export const maxDuration = 60;

const COMPOSER_CORS: Record<string, string> = {
  ...CORS_HEADERS,
  "access-control-allow-methods": "GET, POST, OPTIONS",
};

type BodyPackages = Record<string, string> | { name: string; version: string; isDev?: boolean }[];

function parseBody(raw: unknown): { packages: { name: string; version: string; isDev?: boolean }[] } | { error: string; code: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { error: "Send a JSON object with a packages map or list.", code: "invalid_body" };
  }
  const packagesField = (raw as { packages?: BodyPackages }).packages;
  if (packagesField === undefined) {
    return { error: "Missing packages. Send { \"packages\": { \"vendor/pkg\": \"1.2.3\" } }.", code: "missing_packages" };
  }

  const out: { name: string; version: string; isDev?: boolean }[] = [];

  if (Array.isArray(packagesField)) {
    for (const item of packagesField) {
      if (!item || typeof item !== "object") continue;
      const name = typeof item.name === "string" ? item.name.trim() : "";
      const version = typeof item.version === "string" ? item.version.trim() : "";
      if (!name || !version) continue;
      out.push({ name, version, isDev: item.isDev === true });
    }
  } else if (packagesField && typeof packagesField === "object") {
    for (const [name, version] of Object.entries(packagesField)) {
      if (typeof version !== "string") continue;
      out.push({ name: name.trim(), version: version.trim() });
    }
  } else {
    return { error: "packages must be an object map or an array.", code: "invalid_body" };
  }

  if (out.length === 0) {
    return { error: "No valid packages provided.", code: "missing_packages" };
  }
  if (out.length > MAX_API_PACKAGES) {
    return { error: `Too many packages (max ${MAX_API_PACKAGES}).`, code: "too_many_packages" };
  }

  const cleaned = out.filter((p) => isValidPackageName(p.name) && p.version.length > 0 && p.version.length <= 64);
  if (cleaned.length === 0) {
    return { error: "No valid vendor/package names in the request.", code: "invalid_packages" };
  }

  return { packages: cleaned };
}

function composerJson(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return Response.json(body, {
    status,
    headers: { ...COMPOSER_CORS, "cache-control": "no-store", ...extra },
  });
}

function composerError(code: string, message: string, status: number, extra: Record<string, string> = {}): Response {
  return composerJson({ error: message, code, status }, status, extra);
}

/**
 * POST /api/composer-advisories
 * Body: { packages: { "vendor/pkg": "1.2.3", ... } } or { packages: [{ name, version, isDev? }] }
 * Only the name@version list is accepted — never a raw composer.lock.
 */
export async function POST(request: Request) {
  const limit = rateLimit(`composer:${clientIp(request)}`, 10, 5 * 60 * 1000);
  if (!limit.ok) {
    return composerError("rate_limited", "Too many composer checks from this address. Try again shortly.", 429, {
      ...rateLimitHeaders(limit),
      "retry-after": String(limit.retryAfterSeconds),
    });
  }
  const rl = rateLimitHeaders(limit);

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return composerError("invalid_body", "Content-Type must be application/json.", 400, rl);
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > 512_000) {
    return composerError("too_large", "Request body is too large.", 413, rl);
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return composerError("invalid_body", "Body must be JSON.", 400, rl);
  }

  const parsed = parseBody(raw);
  if ("error" in parsed) {
    return composerError(parsed.code, parsed.error, 400, rl);
  }

  try {
    const result = await auditComposerPackages(parsed.packages);
    return composerJson(result, 200, rl);
  } catch (error) {
    if (error instanceof CacheMissError || (error instanceof Error && /Packagist/i.test(error.message))) {
      return composerError(
        "data_unavailable",
        "Packagist security advisories are unavailable right now. Please retry shortly.",
        503,
        rl,
      );
    }
    log.error("api.composer-advisories.failed", { error, packageCount: parsed.packages.length });
    return composerError("internal_error", "The composer advisory check could not be completed.", 500, rl);
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: COMPOSER_CORS });
}

// Keep a tiny GET so smoke/OpenAPI can discover the route exists; no advisory data without packages.
export async function GET() {
  return composerError(
    "missing_packages",
    "POST a JSON body with packages (name@version map). Raw composer.lock files are not accepted.",
    400,
  );
}
