import { loadBranchCatalog, DataUnavailableError } from "@/lib/dataset";

export const maxDuration = 120;
import { clientIp, rateLimit } from "@/lib/rate-limit";

export async function GET(request: Request) {
  const limit = rateLimit(`versions:${clientIp(request)}`, 60, 5 * 60 * 1000);
  if (!limit.ok) {
    return Response.json(
      { error: "Too many requests from this address. Try again shortly." },
      { status: 429, headers: { "retry-after": String(limit.retryAfterSeconds), "cache-control": "no-store" } },
    );
  }

  try {
    const dataset = await loadBranchCatalog();
    if (dataset.branches.length === 0) {
      throw new DataUnavailableError(
        "Official PHP branch data could not be loaded and no cached copy is available.",
      );
    }
    return Response.json(
      {
        branches: dataset.branches.map((branch) => ({
          branch: branch.branch,
          initialReleaseDate: branch.initialReleaseDate,
          activeSupportEnd: branch.activeSupportEnd,
          securitySupportEnd: branch.securitySupportEnd,
          state: branch.state,
          latestPatch: branch.latestPatch,
        })),
        retrievedAt: dataset.retrievedAt,
        stale: dataset.stale,
        sources: dataset.sources,
        warnings: dataset.warnings,
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof DataUnavailableError) {
      return Response.json({ error: error.message }, { status: 503, headers: { "cache-control": "no-store" } });
    }
    console.error("php versions lookup failed");
    return Response.json(
      { error: "PHP version data could not be loaded." },
      { status: 500, headers: { "cache-control": "no-store" } },
    );
  }
}
