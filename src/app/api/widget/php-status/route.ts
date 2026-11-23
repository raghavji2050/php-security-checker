import { loadBranchCatalog } from "@/lib/dataset";
import { log } from "@/lib/log";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { statusWidgetSvg } from "@/lib/status-widget";

export const maxDuration = 120;

function svg(body: string, status: number, cache: string): Response {
  return new Response(body, {
    status,
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": cache,
      "x-content-type-options": "nosniff",
      "access-control-allow-origin": "*",
    },
  });
}

/** GET /api/widget/php-status — embeddable SVG card of PHP branch support status (php.net data). */
export async function GET(request: Request) {
  const limit = rateLimit(`widget:${clientIp(request)}`, 60, 5 * 60 * 1000);
  if (!limit.ok) return svg(statusWidgetSvg([], null), 429, "no-store");
  try {
    const data = await loadBranchCatalog();
    if (data.branches.length === 0) return svg(statusWidgetSvg([], null), 503, "no-store");
    return svg(statusWidgetSvg(data.branches, data.retrievedAt), 200, "public, max-age=3600, s-maxage=3600");
  } catch (error) {
    log.error("api.widget.failed", { error });
    return svg(statusWidgetSvg([], null), 503, "no-store");
  }
}
