import { fetchJson, fetchText } from "@/lib/http";
import {
  computeSupportDates,
  isoDate,
  parseBranchOverrides,
  parseEolHtml,
  parsePublishedDate,
  parseSupportedVersionsHtml,
  supportStateOn,
  type BranchOverride,
  type PublishedBranch,
} from "@/lib/lifecycle";
import type { PhpBranch } from "@/lib/types";
import { compareVersions, parsePhpVersion } from "@/lib/version";

type ReleaseRecord = {
  version: string;
  date: string | null;
};

const BRANCHES_INC = "https://raw.githubusercontent.com/php/web-php/master/include/branches.inc";

export function parseReleaseIndex(payload: unknown): ReleaseRecord[] {
  if (!payload || typeof payload !== "object") return [];
  const record = payload as Record<string, unknown>;
  if (typeof record.version === "string" && record.source) {
    return [{ version: record.version, date: typeof record.date === "string" ? record.date : null }];
  }
  const releases: ReleaseRecord[] = [];
  for (const [key, value] of Object.entries(record)) {
    if (!parsePhpVersion(key) || !value || typeof value !== "object") continue;
    const date = "date" in value && typeof value.date === "string" ? value.date : null;
    releases.push({ version: key, date });
  }
  return releases.sort((a, b) => {
    const left = parsePhpVersion(a.version);
    const right = parsePhpVersion(b.version);
    if (!left || !right) return 0;
    return compareVersions(left, right);
  });
}

async function mapPool<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function run(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index]);
    }
  }
  const workers = Array.from({ length: Math.min(limit, items.length) }, () => run());
  await Promise.all(workers);
  return results;
}

export type BranchSnapshot = {
  branches: PhpBranch[];
  warnings: string[];
};

export async function fetchPhpBranches(now = new Date()): Promise<BranchSnapshot> {
  const warnings: string[] = [];
  const [supportedHtml, eolHtml] = await Promise.all([
    fetchText("https://www.php.net/supported-versions.php", {}, { timeoutMs: 30_000 }),
    fetchText("https://www.php.net/eol.php", {}, { timeoutMs: 30_000 }),
  ]);
  const supported = parseSupportedVersionsHtml(supportedHtml);
  const eol = parseEolHtml(eolHtml);

  let overrides: Record<string, BranchOverride> = {};
  try {
    overrides = parseBranchOverrides(await fetchText(BRANCHES_INC, {}, { timeoutMs: 20_000, retries: 2 }));
  } catch {
    warnings.push("php.net branch overrides could not be read; support dates fall back to the published pages.");
  }

  const branchIds = [...new Set([...supported.map((item) => item.branch), ...eol.map((item) => item.branch)])].sort(
    (a, b) => Number(b.split(".")[0]) - Number(a.split(".")[0]) || Number(b.split(".")[1]) - Number(a.split(".")[1]),
  );

  const releaseLists = await mapPool(branchIds, 4, async (branch) => {
    try {
      const payload = await fetchJson<unknown>(
        `https://www.php.net/releases/index.php?json&version=${encodeURIComponent(branch)}&max=100`,
        {},
        { timeoutMs: 30_000, retries: 2 },
      );
      return parseReleaseIndex(payload);
    } catch {
      return [];
    }
  });

  const today = isoDate(now);
  const branches = branchIds.map((branch, index) =>
    buildBranch(branch, supported, eol, overrides, releaseLists[index] ?? [], today, warnings),
  );
  return { branches, warnings };
}

function buildBranch(
  branch: string,
  supported: PublishedBranch[],
  eol: PublishedBranch[],
  overrides: Record<string, BranchOverride>,
  releases: ReleaseRecord[],
  today: string,
  warnings: string[],
): PhpBranch {
  const published = supported.find((item) => item.branch === branch);
  const retired = eol.find((item) => item.branch === branch);
  const versions = releases.map((release) => release.version);
  const oldest = releases[0];
  const latest = releases.at(-1);
  const initialFromRelease = oldest?.date ? parsePublishedDate(oldest.date) : null;
  const override = overrides[branch] ?? {};
  const initialReleaseDate = override.date ?? published?.initialReleaseDate ?? initialFromRelease;

  let activeSupportEnd = published?.activeSupportEnd ?? null;
  let securitySupportEnd = published?.securitySupportEnd ?? retired?.securitySupportEnd ?? null;

  if (initialReleaseDate && (!activeSupportEnd || !securitySupportEnd)) {
    const computed = computeSupportDates(branch, initialReleaseDate, override, retired?.securitySupportEnd ?? null);
    activeSupportEnd = activeSupportEnd ?? computed.activeSupportEnd;
    securitySupportEnd = securitySupportEnd ?? computed.securitySupportEnd;
  }

  const state = published?.state ?? retired?.state ?? supportStateOn(today, { activeSupportEnd, securitySupportEnd });
  const latestPatch = latest?.version ?? retired?.latestPatch ?? null;
  if (!latestPatch) {
    warnings.push(`No release list was available for PHP ${branch}.`);
  }

  return {
    branch,
    initialReleaseDate,
    activeSupportEnd,
    securitySupportEnd,
    state,
    latestPatch,
    releases: versions.length > 0 ? versions : latestPatch ? [latestPatch] : [],
  };
}
