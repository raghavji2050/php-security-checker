import { buildCatalog } from "@/lib/catalog";
import { DataUnavailableError, loadDataset } from "@/lib/dataset";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const maxDuration = 300;

export async function GET(request: Request) {
  const limit = rateLimit(`catalog:${clientIp(request)}`, 30, 5 * 60 * 1000);
  if (!limit.ok) {
    return Response.json(
      { error: "Too many requests from this address. Try again shortly." },
      { status: 429, headers: { "retry-after": String(limit.retryAfterSeconds), "cache-control": "no-store" } },
    );
  }

  try {
    const dataset = await loadDataset();
    return Response.json(
      {
        rows: buildCatalog({ cves: dataset.cves, advisories: dataset.advisories, branches: dataset.branches }),
        lastDataUpdate: dataset.retrievedAt,
        stale: dataset.stale,
        warnings: dataset.warnings,
        sources: dataset.sources,
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof DataUnavailableError) {
      return Response.json({ error: error.message }, { status: 503, headers: { "cache-control": "no-store" } });
    }
    console.error("vulnerability catalog failed");
    return Response.json(
      { error: "The vulnerability list could not be loaded." },
      { status: 500, headers: { "cache-control": "no-store" } },
    );
  }
}
