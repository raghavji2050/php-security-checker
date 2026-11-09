import { getOrLoad } from "@/lib/cache";
import { fetchJson, HttpError } from "@/lib/http";
import { auditComposerPackages } from "@/lib/packagist-advisories";
import type { ComposerAuditResult } from "@/lib/composer-types";

export const SYMFONY_RELEASES_URL = "https://symfony.com/releases.json";
export const symfonyBranchUrl = (branch: string) => `https://symfony.com/releases/${branch}.json`;

export type SymfonyReleases = {
  lts: string | null;
  stable: string | null;
  supportedVersions: string[];
  maintainedVersions: string[];
  securityMaintainedVersions: string[];
  minPhp: Record<string, string>;
};

export type SymfonyBranch = {
  branch: string;
  releaseDate: string | null;
  latestPatch: string | null;
  isLts: boolean;
  eom: string | null;
  eol: string | null;
  isEomed: boolean;
  isEoled: boolean;
};

export type SymfonySupportState = "active" | "security" | "eol" | "unknown";

export { normalizeSymfonyVersion } from "@/lib/symfony-support-input";

export function symfonyBranchOf(version: string): string {
  const [major, minor] = version.split(".");
  return `${major}.${minor}`;
}

export function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/** symfony.com publishes month-level dates like "11/2028". Return "2028-11" or null; days are never guessed. */
export function parseSymfonyMonth(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const match = /^(\d{1,2})\/(\d{4})$/.exec(input.trim());
  if (!match) return null;
  const month = Number(match[1]);
  if (month < 1 || month > 12) return null;
  return `${match[2]}-${String(month).padStart(2, "0")}`;
}

const strings = (value: unknown): string[] => (Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : []);

export function parseSymfonyReleases(raw: unknown): SymfonyReleases {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const versions = (obj.symfony_versions ?? {}) as Record<string, unknown>;
  const minPhpRaw = (obj.min_php_requirements ?? {}) as Record<string, unknown>;
  const minPhp: Record<string, string> = {};
  for (const [branch, php] of Object.entries(minPhpRaw)) if (typeof php === "string") minPhp[branch] = php;
  const supportedVersions = strings(obj.supported_versions);
  if (supportedVersions.length === 0) throw new Error("symfony.com releases.json had no supported_versions");
  return {
    lts: typeof versions.lts === "string" ? versions.lts : null,
    stable: typeof versions.stable === "string" ? versions.stable : null,
    supportedVersions,
    maintainedVersions: strings(obj.maintained_versions),
    securityMaintainedVersions: strings(obj.security_maintained_versions),
    minPhp,
  };
}

export function parseSymfonyBranch(raw: unknown, branch: string): SymfonyBranch | null {
  const obj = (raw ?? {}) as Record<string, unknown>;
  if (typeof obj.branch !== "string" && typeof obj.version !== "string") return null;
  return {
    branch,
    releaseDate: parseSymfonyMonth(obj.release_date),
    latestPatch: typeof obj.latest_patch_version === "string" ? obj.latest_patch_version : null,
    isLts: obj.is_lts === true,
    eom: parseSymfonyMonth(obj.eom),
    eol: parseSymfonyMonth(obj.eol),
    isEomed: obj.is_eomed === true,
    isEoled: obj.is_eoled === true,
  };
}

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "2028-11" → "November 2028". */
export function formatSymfonyMonth(month: string | null): string {
  if (!month) return "an unpublished month";
  const [year, m] = month.split("-");
  return `${MONTH_NAMES[Number(m) - 1] ?? m} ${year}`;
}

/** Decide support from symfony.com's own flags and lists. Nothing is calculated from guessed days. */
export function symfonySupportState(
  branch: string,
  releases: SymfonyReleases | null,
  info: SymfonyBranch | null,
): { state: SymfonySupportState; detail: string } {
  if (info) {
    const eom = formatSymfonyMonth(info.eom);
    const eol = formatSymfonyMonth(info.eol);
    if (info.isEoled) return { state: "eol", detail: `symfony.com marks Symfony ${branch} as end of life (security fixes ended ${eol}).` };
    if (info.isEomed) return { state: "security", detail: `Bug fixes for Symfony ${branch} ended ${eom}. symfony.com lists security fixes until ${eol}.` };
    return { state: "active", detail: `Symfony ${branch} gets bug fixes until ${eom} and security fixes until ${eol}, per symfony.com.` };
  }
  if (releases) {
    if (releases.maintainedVersions.includes(branch) || releases.supportedVersions.includes(branch)) {
      return { state: "active", detail: `symfony.com lists Symfony ${branch} as maintained. Branch dates could not be loaded.` };
    }
    if (releases.securityMaintainedVersions.includes(branch)) {
      return { state: "security", detail: `symfony.com lists Symfony ${branch} as security-fixes only. Branch dates could not be loaded.` };
    }
    if (releases.minPhp[branch]) {
      return { state: "eol", detail: `Symfony ${branch} is a known branch that symfony.com no longer lists as maintained.` };
    }
  }
  return { state: "unknown", detail: `Symfony ${branch} was not found in symfony.com release data. No support date was guessed.` };
}

const TTL = 12 * 60 * 60 * 1000;
const FETCH = { timeoutMs: 15_000, retries: 1, deadlineMs: 20_000 };

export async function loadSymfonyReleases() {
  const loaded = await getOrLoad({
    key: "symfony-releases-json",
    ttlMs: TTL,
    allowStale: true,
    load: async () => parseSymfonyReleases(await fetchJson<unknown>(SYMFONY_RELEASES_URL, {}, FETCH)),
  });
  return { data: loaded.data, retrievedAt: loaded.storedAt, stale: loaded.stale };
}

/** Returns null when symfony.com has no page for that branch (404). */
export async function loadSymfonyBranch(branch: string): Promise<SymfonyBranch | null> {
  if (!/^\d{1,2}\.\d{1,2}$/.test(branch)) return null;
  const loaded = await getOrLoad({
    key: `symfony-branch-${branch}`,
    ttlMs: TTL,
    allowStale: true,
    load: async () => {
      try {
        return { info: parseSymfonyBranch(await fetchJson<unknown>(symfonyBranchUrl(branch), {}, FETCH), branch) };
      } catch (error) {
        if (error instanceof HttpError && error.status === 404) return { info: null };
        throw error;
      }
    },
  });
  return loaded.data.info;
}

export type SymfonyCheck = {
  version: string;
  branch: string;
  package: "symfony/symfony";
  support: { state: SymfonySupportState; detail: string };
  branchInfo: SymfonyBranch | null;
  minPhp: string | null;
  latestPatch: string | null;
  patchBehind: boolean | null;
  lts: string | null;
  stable: string | null;
  releasesRetrievedAt: string | null;
  releasesStale: boolean;
  supportError: string | null;
  advisories: ComposerAuditResult | null;
  advisoryError: string | null;
  upgradeCommand: string;
  sources: { releases: string; branch: string; advisories: string };
  limitation: string;
};

export async function checkSymfony(version: string): Promise<SymfonyCheck> {
  const branch = symfonyBranchOf(version);
  const [releasesResult, branchResult, auditResult] = await Promise.allSettled([
    loadSymfonyReleases(),
    loadSymfonyBranch(branch),
    auditComposerPackages([{ name: "symfony/symfony", version }]),
  ]);
  const releases = releasesResult.status === "fulfilled" ? releasesResult.value : null;
  const info = branchResult.status === "fulfilled" ? branchResult.value : null;
  const supportFailed = releasesResult.status === "rejected" && branchResult.status === "rejected";
  const latestPatch = info?.latestPatch ?? null;
  return {
    version,
    branch,
    package: "symfony/symfony",
    support: supportFailed
      ? { state: "unknown", detail: "symfony.com release data could not be loaded, so support is not shown." }
      : symfonySupportState(branch, releases?.data ?? null, info),
    branchInfo: info,
    minPhp: releases?.data.minPhp[branch] ?? null,
    latestPatch,
    patchBehind: latestPatch ? compareVersions(version, latestPatch) < 0 : null,
    lts: releases?.data.lts ?? null,
    stable: releases?.data.stable ?? null,
    releasesRetrievedAt: releases?.retrievedAt ?? null,
    releasesStale: releases?.stale ?? false,
    supportError: supportFailed ? "symfony.com release data could not be loaded." : null,
    advisories: auditResult.status === "fulfilled" ? auditResult.value : null,
    advisoryError: auditResult.status === "rejected" ? "Packagist advisories could not be loaded." : null,
    upgradeCommand: `composer update "symfony/*" --with-all-dependencies`,
    sources: { releases: SYMFONY_RELEASES_URL, branch: symfonyBranchUrl(branch), advisories: "https://packagist.org/api/security-advisories/" },
    limitation:
      "This checks the version you entered against symfony.com release data and Packagist advisories recorded for symfony/symfony. Apps that install individual symfony/* components should scan composer.lock instead, because component advisories are listed per package.",
  };
}
