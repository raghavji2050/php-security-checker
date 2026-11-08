import { badgeForResult, badgeMessage } from "@/lib/badge";
import { checkVersion } from "@/lib/check";
import { DataUnavailableError } from "@/lib/dataset";
import { log } from "@/lib/log";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { parsePhpVersion } from "@/lib/version";

export const maxDuration = 300;

function svg(body: string, status: number, cache: string): Response {
  return new Response(body, {
    status,
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": cache,
      "x-content-type-options": "nosniff",
    },
  });
}

/** GET /api/badge?v=8.3.12 — small status image from the same check as /api/check. */
export async function GET(request: Request) {
  const limit = rateLimit(`badge:${clientIp(request)}`, 30, 5 * 60 * 1000);
  if (!limit.ok) {
    return svg(badgeMessage("PHP", "rate limited"), 429, "no-store");
  }
  const raw = new URL(request.url).searchParams.get("v") ?? new URL(request.url).searchParams.get("version") ?? "";
  if (!raw.trim()) return svg(badgeMessage("PHP", "missing version"), 400, "public, max-age=300");
  const version = raw.length > 32 ? null : parsePhpVersion(raw);
  if (!version) return svg(badgeMessage("PHP", "invalid version"), 400, "public, max-age=300");
  try {
    const result = await checkVersion(version.raw);
    return svg(badgeForResult(result), 200, "public, max-age=3600");
  } catch (error) {
    if (error instanceof DataUnavailableError) return svg(badgeMessage(`PHP ${version.raw}`, "unable to verify"), 503, "no-store");
    log.error("api.badge.failed", { version: version.raw, error });
    return svg(badgeMessage(`PHP ${version.raw}`, "unable to verify"), 500, "no-store");
  }
}
