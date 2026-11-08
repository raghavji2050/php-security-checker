import { CORS_HEADERS } from "@/lib/api";
import { auditSecurityHeaders } from "@/lib/header-audit";
import { log } from "@/lib/log";
import { clientIp, rateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { defaultHeaderRequest, fetchPublicHeaders, resolvePublicHost, validatePublicUrl } from "@/lib/ssrf";

export const maxDuration = 30;

const MESSAGES: Record<string, string> = {
  invalid_url: "Enter an http or https URL.",
  blocked_target:
    "That URL is not allowed. Only public http and https URLs on ports 80 and 443 are fetched. Local, private, link-local, and metadata addresses are refused, including after a redirect.",
  too_many_redirects: "The URL redirected too many times.",
  timeout: "The site did not respond in time.",
  fetch_failed: "The URL could not be fetched.",
};

function json(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return Response.json(body, { status, headers: { ...CORS_HEADERS, "cache-control": "no-store", ...extra } });
}

export async function POST(request: Request) {
  const limit = rateLimit(`headers:${clientIp(request)}`, 8, 5 * 60 * 1000);
  const rl = rateLimitHeaders(limit);
  if (!limit.ok) {
    return json({ error: "Too many header checks from this address. Try again shortly.", code: "rate_limited", status: 429 }, 429, {
      ...rl,
      "retry-after": String(limit.retryAfterSeconds),
    });
  }

  const raw = await request.text();
  if (raw.length > 4096) return json({ error: "Request body is too large.", code: "too_large", status: 400 }, 400, rl);
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: "Send JSON { \"url\": \"https://example.com\" }.", code: "invalid_body", status: 400 }, 400, rl);
  }
  const url = body && typeof body === "object" && "url" in body && typeof body.url === "string" ? body.url : "";
  if (!url.trim()) return json({ error: "Missing url.", code: "missing_url", status: 400 }, 400, rl);

  const gate = validatePublicUrl(url);
  if (!gate.ok) return json({ error: MESSAGES[gate.code], code: gate.code, status: 400 }, 400, rl);

  try {
    const fetched = await fetchPublicHeaders(url, { resolve: resolvePublicHost, request: defaultHeaderRequest });
    if (!fetched.ok) {
      const status = fetched.code === "timeout" || fetched.code === "fetch_failed" ? 502 : 400;
      return json({ error: MESSAGES[fetched.code] ?? "The URL could not be fetched.", code: fetched.code, status }, status, rl);
    }
    log.info("api.headers.checked", { host: new URL(fetched.finalUrl).hostname, status: fetched.status });
    return json({
      finalUrl: fetched.finalUrl,
      httpStatus: fetched.status,
      redirects: fetched.redirects,
      headers: fetched.headers,
      findings: auditSecurityHeaders(fetched.headers, fetched.finalUrl),
      checkedAt: new Date().toISOString(),
      limitation:
        "Only the response headers of the URL you submitted were read. The page body was discarded. This is not a vulnerability scan and not a proof the site is secure.",
    }, 200, rl);
  } catch (error) {
    log.error("api.headers.failed", { host: gate.url.hostname, error });
    return json({ error: "The URL could not be fetched.", code: "fetch_failed", status: 502 }, 502, rl);
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
