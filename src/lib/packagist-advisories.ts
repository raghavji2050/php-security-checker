import { createHash } from "node:crypto";
import { getOrLoad, CacheMissError } from "@/lib/cache";
import { suggestedFixedVersions, versionSatisfies } from "@/lib/composer-constraint";
import { isValidPackageName } from "@/lib/composer-lock";
import { fetchWithRetry } from "@/lib/http";
import { log } from "@/lib/log";
import type { AffectedFinding, ComposerAuditResult } from "@/lib/composer-types";

export type { AffectedFinding, ComposerAuditResult } from "@/lib/composer-types";

const PACKAGIST_URL = "https://packagist.org/api/security-advisories/";
const USER_AGENT = "PHP-Security-Checker/1.0 (+https://php-security-checker.vercel.app; mailto=raghavji2050@gmail.com)";
const BATCH_SIZE = 40;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
export const MAX_API_PACKAGES = 1500;

export type PackagistAdvisory = {
  advisoryId: string;
  packageName: string;
  title: string;
  link: string | null;
  cve: string | null;
  affectedVersions: string;
  severity: string | null;
  reportedAt: string | null;
  sources: { name: string; remoteId: string }[];
};

type PackagistResponse = {
  advisories?: Record<string, PackagistAdvisory[] | undefined>;
};

function batchKey(names: string[]): string {
  const hash = createHash("sha256").update(names.slice().sort().join("\n")).digest("hex").slice(0, 24);
  return `packagist-advisories:${hash}`;
}

async function fetchPackagistBatch(names: string[]): Promise<Record<string, PackagistAdvisory[]>> {
  const body = new URLSearchParams();
  for (const name of names) body.append("packages[]", name);

  const response = await fetchWithRetry(
    PACKAGIST_URL,
    {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "user-agent": USER_AGENT,
        accept: "application/json",
      },
      body: body.toString(),
    },
    { timeoutMs: 20_000, retries: 2, deadlineMs: 35_000 },
  );

  if (!response.ok) {
    throw new Error(`Packagist security-advisories returned HTTP ${response.status}`);
  }

  const json = (await response.json()) as PackagistResponse;
  const out: Record<string, PackagistAdvisory[]> = {};
  if (!json.advisories || typeof json.advisories !== "object") return out;

  for (const [name, list] of Object.entries(json.advisories)) {
    if (!Array.isArray(list)) {
      out[name] = [];
      continue;
    }
    out[name] = list
      .filter((item) => item && typeof item === "object" && typeof item.advisoryId === "string")
      .map((item) => ({
        advisoryId: item.advisoryId,
        packageName: typeof item.packageName === "string" ? item.packageName : name,
        title: typeof item.title === "string" ? item.title : item.advisoryId,
        link: typeof item.link === "string" ? item.link : null,
        cve: typeof item.cve === "string" && item.cve ? item.cve : null,
        affectedVersions: typeof item.affectedVersions === "string" ? item.affectedVersions : "",
        severity: typeof item.severity === "string" && item.severity ? item.severity : null,
        reportedAt: typeof item.reportedAt === "string" ? item.reportedAt : null,
        sources: Array.isArray(item.sources)
          ? item.sources
              .filter((s) => s && typeof s.name === "string")
              .map((s) => ({ name: s.name, remoteId: typeof s.remoteId === "string" ? s.remoteId : "" }))
          : [],
      }));
  }
  return out;
}

/** Load advisories for a set of package names (chunked + cached per chunk). */
export async function loadAdvisoriesForPackages(
  packageNames: string[],
): Promise<{ advisories: Record<string, PackagistAdvisory[]>; stale: boolean }> {
  const unique = [...new Set(packageNames.filter(isValidPackageName))];
  const advisories: Record<string, PackagistAdvisory[]> = {};
  let stale = false;

  for (let i = 0; i < unique.length; i += BATCH_SIZE) {
    const chunk = unique.slice(i, i + BATCH_SIZE);
    const key = batchKey(chunk);
    try {
      const loaded = await getOrLoad({
        key,
        ttlMs: CACHE_TTL_MS,
        allowStale: true,
        load: () => fetchPackagistBatch(chunk),
      });
      Object.assign(advisories, loaded.data);
      if (loaded.stale) stale = true;
    } catch (error) {
      if (error instanceof CacheMissError) throw error;
      log.error("packagist.advisories.failed", { error, chunkSize: chunk.length });
      throw error;
    }
  }

  return { advisories, stale };
}

export type PackageInput = {
  name: string;
  version: string;
  isDev?: boolean;
};

function cveUrl(cve: string | null): string | null {
  if (!cve) return null;
  return `https://nvd.nist.gov/vuln/detail/${encodeURIComponent(cve)}`;
}

function severityRank(severity: string | null): number {
  const s = (severity ?? "").toLowerCase();
  if (s === "critical") return 4;
  if (s === "high") return 3;
  if (s === "medium" || s === "moderate") return 2;
  if (s === "low") return 1;
  return 0;
}

/** Match installed versions against Packagist advisories. Never invents advisories. */
export async function auditComposerPackages(packages: PackageInput[]): Promise<ComposerAuditResult> {
  if (packages.length > MAX_API_PACKAGES) {
    throw new RangeError(`Too many packages (max ${MAX_API_PACKAGES})`);
  }

  const cleaned: PackageInput[] = [];
  const seen = new Set<string>();
  for (const pkg of packages) {
    if (!pkg || typeof pkg.name !== "string" || typeof pkg.version !== "string") continue;
    const name = pkg.name.trim();
    const version = pkg.version.trim();
    if (!isValidPackageName(name) || !version || version.length > 64) continue;
    if (seen.has(name)) continue;
    seen.add(name);
    cleaned.push({ name, version, isDev: pkg.isDev === true });
  }

  const { advisories, stale } = await loadAdvisoriesForPackages(cleaned.map((p) => p.name));
  const findings: AffectedFinding[] = [];

  for (const pkg of cleaned) {
    const list = advisories[pkg.name];
    if (!list || list.length === 0) continue;
    for (const advisory of list) {
      if (!advisory.affectedVersions) continue;
      if (!versionSatisfies(pkg.version, advisory.affectedVersions)) continue;
      findings.push({
        packageName: pkg.name,
        installedVersion: pkg.version,
        isDev: pkg.isDev ?? null,
        advisoryId: advisory.advisoryId,
        title: advisory.title,
        link: advisory.link,
        cve: advisory.cve,
        cveUrl: cveUrl(advisory.cve),
        severity: advisory.severity,
        affectedVersions: advisory.affectedVersions,
        suggestedFixedVersions: suggestedFixedVersions(pkg.version, advisory.affectedVersions),
        reportedAt: advisory.reportedAt,
        updateCommand: `composer update ${pkg.name}`,
      });
    }
  }

  findings.sort((a, b) => {
    const sev = severityRank(b.severity) - severityRank(a.severity);
    if (sev !== 0) return sev;
    return a.packageName.localeCompare(b.packageName) || a.advisoryId.localeCompare(b.advisoryId);
  });

  const affectedNames = [...new Set(findings.map((f) => f.packageName))];
  return {
    checkedAt: new Date().toISOString(),
    packageCount: cleaned.length,
    affectedCount: affectedNames.length,
    advisoryCount: findings.length,
    findings,
    updateCommands: affectedNames.map((name) => `composer update ${name}`),
    stale,
    source: "packagist",
  };
}
