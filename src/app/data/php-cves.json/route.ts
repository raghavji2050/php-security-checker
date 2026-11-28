import { cacheLife } from "next/cache";
import { buildExplorerRows } from "@/lib/cve-explorer";
import { loadDataset } from "@/lib/dataset";
import { log } from "@/lib/log";
import { buildOpenData } from "@/lib/open-data";
import { SITE_URL } from "@/lib/site";

export const maxDuration = 300;

async function openData(): Promise<string | null> {
  "use cache";
  cacheLife("hours");
  try {
    const data = await loadDataset();
    const rows = buildExplorerRows(data.cves, data.branches.map((b) => b.branch));
    return JSON.stringify(buildOpenData({ rows, siteUrl: SITE_URL, retrievedAt: data.retrievedAt, stale: data.stale, sources: data.sources }));
  } catch (error) {
    log.error("open_data.failed", { error });
    return null;
  }
}

/** GET /data/php-cves.json — open, NVD-attributed JSON of every PHP interpreter CVE. */
export async function GET() {
  const body = await openData();
  if (!body) {
    return Response.json({ error: "CVE data is unavailable right now. Try again later." }, { status: 503, headers: { "retry-after": "600", "cache-control": "no-store" } });
  }
  return new Response(body, {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=3600",
      "access-control-allow-origin": "*",
    },
  });
}
