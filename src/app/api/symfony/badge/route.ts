import { badgeMessage, symfonyBadge } from "@/lib/badge";
import { log } from "@/lib/log";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { checkSymfony, normalizeSymfonyVersion } from "@/lib/symfony-support";

export const maxDuration = 60;

function svg(body: string, status: number, cache: string): Response {
  return new Response(body, {
    status,
    headers: { "content-type": "image/svg+xml; charset=utf-8", "cache-control": cache, "x-content-type-options": "nosniff" },
  });
}

/** GET /api/symfony/badge?v=7.4.10 — status image from the same data as /symfony/check/{version}. */
export async function GET(request: Request) {
  const limit = rateLimit(`symfony-badge:${clientIp(request)}`, 30, 5 * 60 * 1000);
  if (!limit.ok) return svg(badgeMessage("Symfony", "rate limited"), 429, "no-store");
  const raw = new URL(request.url).searchParams.get("v") ?? "";
  if (!raw.trim()) return svg(badgeMessage("Symfony", "missing version"), 400, "public, max-age=300");
  const version = raw.length > 32 ? null : normalizeSymfonyVersion(raw);
  if (!version) return svg(badgeMessage("Symfony", "invalid version"), 400, "public, max-age=300");
  try {
    const result = await checkSymfony(version);
    if (result.supportError && result.advisoryError) return svg(badgeMessage(`Symfony ${version}`, "unable to verify"), 503, "no-store");
    return svg(symfonyBadge(result), 200, "public, max-age=3600");
  } catch (error) {
    log.error("api.symfony_badge.failed", { version, error });
    return svg(badgeMessage(`Symfony ${version}`, "unable to verify"), 500, "no-store");
  }
}
