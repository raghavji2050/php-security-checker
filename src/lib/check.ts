import { loadDataset, type DatasetLoaders } from "@/lib/dataset";
import { evaluateVersion } from "@/lib/evaluate";
import type { CheckResult } from "@/lib/types";

export async function checkVersion(version: string, loaders?: DatasetLoaders): Promise<CheckResult> {
  const dataset = await loadDataset(loaders);
  return evaluateVersion({
    version,
    cves: dataset.cves,
    advisories: dataset.advisories,
    changelog: dataset.changelog,
    branches: dataset.branches,
    checkedAt: new Date().toISOString(),
    lastDataUpdate: dataset.retrievedAt,
    stale: dataset.stale,
    sources: dataset.sources,
    warnings: dataset.warnings,
  });
}
