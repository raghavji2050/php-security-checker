import { fetchPhpAdvisories } from "@/lib/advisories";
import { getOrLoad, secondsFromEnv } from "@/lib/cache";
import { fetchChangelogIndex } from "@/lib/changelog";
import { fetchPhpRuntimeCves } from "@/lib/nvd";
import { fetchPhpBranches, type BranchSnapshot } from "@/lib/php-releases";
import type { ChangelogIndex, NormalizedAdvisory, NormalizedCve, PhpBranch, SourceInfo } from "@/lib/types";

export class DataUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DataUnavailableError";
  }
}

export type LoadedDataset = {
  cves: NormalizedCve[];
  advisories: NormalizedAdvisory[];
  changelog: ChangelogIndex;
  branches: PhpBranch[];
  retrievedAt: string | null;
  stale: boolean;
  warnings: string[];
  sources: SourceInfo[];
};

export type DatasetLoaders = {
  nvd: () => Promise<NormalizedCve[]>;
  advisories: () => Promise<NormalizedAdvisory[]>;
  changelog: () => Promise<ChangelogIndex>;
  branches: () => Promise<BranchSnapshot>;
};

export const liveLoaders: DatasetLoaders = {
  nvd: fetchPhpRuntimeCves,
  advisories: fetchPhpAdvisories,
  changelog: fetchChangelogIndex,
  branches: () => fetchPhpBranches(),
};

const HOUR = 60 * 60;

export async function loadBranchCatalog(loaders: DatasetLoaders = liveLoaders): Promise<{
  branches: PhpBranch[];
  retrievedAt: string | null;
  stale: boolean;
  warnings: string[];
  sources: SourceInfo[];
}> {
  const phpTtl = secondsFromEnv("PHP_CACHE_TTL_SECONDS", 12 * HOUR) * 1000;
  const warnings: string[] = [];
  const branches = await loadOptional(
    "php-branches-v1",
    phpTtl,
    loaders.branches,
    { branches: [], warnings: [] },
    "Official PHP branch and release data could not be loaded.",
    warnings,
  );
  warnings.push(...branches.data.warnings);
  return {
    branches: branches.data.branches,
    retrievedAt: branches.storedAt,
    stale: branches.stale,
    warnings,
    sources: [
      {
        name: "php.net supported versions, end-of-life list, and releases",
        url: "https://www.php.net/supported-versions.php",
        retrievedAt: branches.storedAt,
        stale: branches.stale,
      },
    ],
  };
}

export async function loadDataset(loaders: DatasetLoaders = liveLoaders): Promise<LoadedDataset> {
  const nvdTtl = secondsFromEnv("NVD_CACHE_TTL_SECONDS", 6 * HOUR) * 1000;
  const phpTtl = secondsFromEnv("PHP_CACHE_TTL_SECONDS", 12 * HOUR) * 1000;
  const warnings: string[] = [];
  const [nvdResult, advisories, changelog, branches] = await Promise.all([
    getOrLoad({
      key: "nvd-php-runtime-v1",
      ttlMs: nvdTtl,
      load: loaders.nvd,
      allowStale: true,
    }).then(
      (value) => ({ ok: true as const, value }),
      (error: unknown) => ({ ok: false as const, error }),
    ),
    loadOptional(
      "github-php-advisories-v1",
      nvdTtl,
      loaders.advisories,
      [] as NormalizedAdvisory[],
      "GitHub security advisories for php/php-src could not be loaded. Results use NVD and php.net only.",
      warnings,
    ),
    loadOptional(
      "php-changelog-index-v1",
      phpTtl,
      loaders.changelog,
      {} as ChangelogIndex,
      "The PHP ChangeLog could not be loaded, so changelog cross-checks were skipped.",
      warnings,
    ),
    loadOptional(
      "php-branches-v1",
      phpTtl,
      loaders.branches,
      { branches: [], warnings: [] } as BranchSnapshot,
      "Official PHP branch and release data could not be loaded. Support status and upgrade advice are incomplete.",
      warnings,
    ),
  ]);

  if (!nvdResult.ok) {
    const reason = nvdResult.error instanceof Error ? nvdResult.error.message : "unknown error";
    console.error("NVD load failed:", reason);
    throw new DataUnavailableError(
      "PHP runtime CVEs could not be loaded from NVD and no cached copy is available. The version cannot be verified right now.",
    );
  }
  const nvd = nvdResult.value;

  warnings.push(...branches.data.warnings);
  const stale = nvd.stale || branches.stale;
  if (advisories.stale) warnings.push(`GitHub advisory data is stale as of ${advisories.storedAt}.`);
  if (changelog.stale) warnings.push(`PHP ChangeLog data is stale as of ${changelog.storedAt}.`);
  if (nvd.stale) warnings.push(`NVD data is stale as of ${nvd.storedAt} and is not being presented as current.`);

  const sources: SourceInfo[] = [
    {
      name: "NIST NVD API 2.0",
      url: "https://services.nvd.nist.gov/rest/json/cves/2.0",
      retrievedAt: nvd.storedAt,
      stale: nvd.stale,
    },
    {
      name: "php.net supported versions, end-of-life list, and releases",
      url: "https://www.php.net/supported-versions.php",
      retrievedAt: branches.storedAt,
      stale: branches.stale,
    },
    {
      name: "PHP ChangeLog",
      url: "https://www.php.net/ChangeLog-8.php",
      retrievedAt: changelog.storedAt,
      stale: changelog.stale,
    },
    {
      name: "GitHub Security Advisories for php/php-src",
      url: "https://github.com/php/php-src/security/advisories",
      retrievedAt: advisories.storedAt,
      stale: advisories.stale,
    },
  ];

  return {
    cves: nvd.data,
    advisories: advisories.data,
    changelog: changelog.data,
    branches: branches.data.branches,
    retrievedAt: nvd.storedAt,
    stale,
    warnings,
    sources,
  };
}

async function loadOptional<T>(
  key: string,
  ttlMs: number,
  load: () => Promise<T>,
  fallback: T,
  failureWarning: string,
  warnings: string[],
): Promise<{ data: T; storedAt: string | null; stale: boolean }> {
  try {
    return await getOrLoad({ key, ttlMs, load, allowStale: true });
  } catch {
    warnings.push(failureWarning);
    return { data: fallback, storedAt: null, stale: false };
  }
}
