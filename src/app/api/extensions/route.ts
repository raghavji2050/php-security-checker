import { CORS_HEADERS } from "@/lib/api";
import { checkVersion } from "@/lib/check";
import { DataUnavailableError, loadDataset } from "@/lib/dataset";
import { assessExtensions, parsePhpModules, type MentionSource } from "@/lib/extension-check";
import { log } from "@/lib/log";
import { clientIp, rateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { parsePhpVersion } from "@/lib/version";

export const maxDuration = 300;

function json(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return Response.json(body, { status, headers: { ...CORS_HEADERS, "cache-control": "no-store", ...extra } });
}

export async function POST(request: Request) {
  const limit = rateLimit(`extensions:${clientIp(request)}`, 12, 5 * 60 * 1000);
  const rl = rateLimitHeaders(limit);
  if (!limit.ok) {
    return json({ error: "Too many extension checks from this address.", code: "rate_limited", status: 429 }, 429, {
      ...rl,
      "retry-after": String(limit.retryAfterSeconds),
    });
  }
  const raw = await request.text();
  if (raw.length > 64 * 1024) return json({ error: "Request body is too large.", code: "too_large", status: 400 }, 400, rl);
  let body: { modules?: unknown; names?: unknown; version?: unknown };
  try {
    body = JSON.parse(raw) as { modules?: unknown; names?: unknown; version?: unknown };
  } catch {
    return json({ error: "Send JSON with modules (php -m text) or names.", code: "invalid_body", status: 400 }, 400, rl);
  }

  const parsedNames = typeof body.modules === "string"
    ? parsePhpModules(body.modules)
    : Array.isArray(body.names)
      ? parsePhpModules(body.names.filter((item): item is string => typeof item === "string").join("\n"))
      : { ok: false as const, error: "Send modules or names." };
  if (!parsedNames.ok) return json({ error: parsedNames.error, code: "invalid_modules", status: 400 }, 400, rl);

  let version: string | null = null;
  if (typeof body.version === "string" && body.version.trim()) {
    const parsed = parsePhpVersion(body.version);
    if (!parsed) return json({ error: "Version must be MAJOR.MINOR.PATCH, for example 8.3.12.", code: "invalid_version", status: 400 }, 400, rl);
    version = parsed.raw;
  }

  try {
    const dataset = await loadDataset();
    const records: MentionSource[] = dataset.cves.map((cve) => ({
      id: cve.id,
      description: cve.description,
      severity: cve.cvss?.severity ?? null,
    }));
    let verdicts: Map<string, "confirmed" | "potential"> | null = null;
    let versionStatus: string | null = null;
    if (version) {
      const checked = await checkVersion(version);
      versionStatus = checked.securityStatus;
      verdicts = new Map();
      for (const finding of checked.vulnerabilities) {
        const id = finding.cveId ?? finding.id;
        verdicts.set(id, finding.verdict);
      }
    }
    return json({
      version,
      versionStatus,
      extensions: assessExtensions(parsedNames.names, records, verdicts),
      source: "NIST NVD PHP runtime CVE descriptions, matched by extension phrases only",
      retrievedAt: dataset.retrievedAt,
      stale: dataset.stale,
      limitation:
        "A description mention is not a separate extension advisory. Outdated versus current is not assessed. No extension CVE was invented. Bundled-extension issues are usually published as PHP runtime CVEs — check the PHP version.",
    }, 200, rl);
  } catch (error) {
    if (error instanceof DataUnavailableError) {
      return json({ error: error.message, code: "data_unavailable", status: 503 }, 503, rl);
    }
    log.error("api.extensions.failed", { error });
    return json({ error: "Extension data could not be loaded.", code: "internal_error", status: 500 }, 500, rl);
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
