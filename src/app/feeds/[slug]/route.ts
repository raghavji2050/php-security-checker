import { cacheLife } from "next/cache";
import { buildExplorerRows } from "@/lib/cve-explorer";
import { buildCveAtom, parseFeedSlug } from "@/lib/cve-feed";
import { loadDataset } from "@/lib/dataset";
import { log } from "@/lib/log";
import { SITE_URL } from "@/lib/site";

export const maxDuration = 300;

async function feed(branch: string): Promise<string | null> {
  "use cache";
  cacheLife("hours");
  try {
    const data = await loadDataset();
    const rows = buildExplorerRows(data.cves, data.branches.map((b) => b.branch));
    return buildCveAtom({ rows, branch, siteUrl: SITE_URL, updated: data.retrievedAt });
  } catch (error) {
    log.error("feed.failed", { branch, error });
    return null;
  }
}

/** GET /feeds/all.xml or /feeds/8.3.xml — Atom feed of the newest PHP CVEs from NVD. */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const branch = parseFeedSlug((await params).slug);
  if (!branch) return new Response("Unknown feed. Use /feeds/all.xml or /feeds/8.3.xml.\n", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
  const body = await feed(branch);
  if (!body) return new Response("CVE data is unavailable right now. Try again later.\n", { status: 503, headers: { "content-type": "text/plain; charset=utf-8", "retry-after": "600" } });
  return new Response(body, {
    headers: { "content-type": "application/atom+xml; charset=utf-8", "cache-control": "public, max-age=3600" },
  });
}
