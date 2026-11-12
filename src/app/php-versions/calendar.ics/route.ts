import { cacheLife } from "next/cache";
import { loadBranchCatalog } from "@/lib/dataset";
import { buildIcs, supportEvents } from "@/lib/ics";
import { log } from "@/lib/log";
import { SITE_URL } from "@/lib/site";

async function calendar(): Promise<string | null> {
  "use cache";
  cacheLife("hours");
  try {
    const data = await loadBranchCatalog();
    if (data.branches.length === 0) return null;
    const now = new Date().toISOString();
    return buildIcs(supportEvents(data.branches, now.slice(0, 10)), { siteUrl: SITE_URL, stamp: data.retrievedAt ?? now });
  } catch (error) {
    log.error("ics.failed", { error });
    return null;
  }
}

/** GET /php-versions/calendar.ics — subscribe to PHP support end dates (php.net data). */
export async function GET() {
  const body = await calendar();
  if (!body) return new Response("PHP branch data is unavailable right now.\n", { status: 503, headers: { "content-type": "text/plain; charset=utf-8", "retry-after": "600" } });
  return new Response(body, {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": 'inline; filename="php-support-dates.ics"',
      "cache-control": "public, max-age=21600",
    },
  });
}
