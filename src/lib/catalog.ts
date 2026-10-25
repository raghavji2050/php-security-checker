import { formatRange, impliedFixOnBranch, type VersionRange } from "@/lib/ranges";
import type { NormalizedAdvisory, NormalizedCve, PhpBranch } from "@/lib/types";
import { compareVersions, parsePhpVersion, versionBranch } from "@/lib/version";

export type CatalogStatus = "confirmed" | "potential" | "not_verified";

export const CATALOG_STATUS_LABEL: Record<CatalogStatus, string> = {
  confirmed: "Confirmed",
  potential: "Potentially affected",
  not_verified: "Not verified",
};

export type CatalogRow = {
  id: string;
  cveId: string | null;
  ghsaId: string | null;
  summary: string;
  severity: string | null;
  cvssScore: number | null;
  published: string | null;
  affected: string[];
  fixedVersions: string[];
  status: CatalogStatus;
  url: string;
};

const SEVERITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "NONE"];

function normalizeSeverity(value: string | null | undefined): string | null {
  if (!value) return null;
  const upper = value.toUpperCase();
  return SEVERITIES.includes(upper) ? upper : null;
}

function summarize(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > 220 ? `${clean.slice(0, 217)}…` : clean;
}

/**
 * Fixed releases implied by the published ranges. A release is listed only when it is
 * present in the php.net release index for that branch; anything else stays "Not verified".
 */
function verifiedFixes(ranges: VersionRange[], branches: PhpBranch[]): string[] {
  const fixes = new Set<string>();
  for (const range of ranges) {
    if (!range.end) continue;
    const branch = versionBranch(range.end.version);
    const releases = branches.find((item) => item.branch === branch)?.releases ?? [];
    const fix = impliedFixOnBranch(range, branch, releases);
    if (fix && releases.includes(fix)) fixes.add(fix);
  }
  return [...fixes].sort((left, right) => {
    const a = parsePhpVersion(left);
    const b = parsePhpVersion(right);
    return a && b ? compareVersions(b, a) : right.localeCompare(left);
  });
}

/**
 * Status for the catalog (not for a specific installed version):
 * - confirmed: at least one precise affected range, and php.net does not leave it ambiguous
 * - potential: only open-ended/broad ranges, or NVD CPE/GitHub ranges that php.net's own list does not back up
 * - not_verified: no usable affected range at all
 */
function catalogStatus(input: {
  phpNet: VersionRange[];
  phpNetHasPrecise: boolean;
  others: VersionRange[];
}): CatalogStatus {
  const phpNetPrecise = input.phpNet.some((range) => range.precision === "precise");
  const otherPrecise = input.others.some((range) => range.precision === "precise");
  if (phpNetPrecise || (otherPrecise && !input.phpNetHasPrecise && input.phpNet.length === 0)) return "confirmed";
  if (input.phpNet.length > 0 || input.others.length > 0) return "potential";
  return "not_verified";
}

export function buildCatalog(input: {
  cves: NormalizedCve[];
  advisories: NormalizedAdvisory[];
  branches: PhpBranch[];
}): CatalogRow[] {
  const advisoriesByCve = new Map<string, NormalizedAdvisory[]>();
  for (const advisory of input.advisories) {
    if (!advisory.cveId) continue;
    const list = advisoriesByCve.get(advisory.cveId) ?? [];
    list.push(advisory);
    advisoriesByCve.set(advisory.cveId, list);
  }

  const rows: CatalogRow[] = [];
  const cveIds = new Set(input.cves.map((cve) => cve.id));

  for (const cve of input.cves) {
    const related = advisoriesByCve.get(cve.id) ?? [];
    const others = [...cve.cpeRanges, ...related.flatMap((advisory) => advisory.ranges)];
    const ranges = cve.phpNetRanges.length > 0 ? cve.phpNetRanges : others;
    rows.push({
      id: cve.id,
      cveId: cve.id,
      ghsaId: related[0]?.ghsaId ?? null,
      summary: summarize(cve.description),
      severity: normalizeSeverity(cve.cvss?.severity) ?? normalizeSeverity(related[0]?.severity),
      cvssScore: cve.cvss?.score ?? related[0]?.cvss?.score ?? null,
      published: cve.published,
      affected: [...new Set(ranges.map((range) => formatRange(range)))],
      fixedVersions: verifiedFixes(ranges, input.branches),
      status: catalogStatus({ phpNet: cve.phpNetRanges, phpNetHasPrecise: cve.phpNetHasPrecise, others }),
      url: `https://nvd.nist.gov/vuln/detail/${cve.id}`,
    });
  }

  for (const advisory of input.advisories) {
    if (advisory.cveId && cveIds.has(advisory.cveId)) continue;
    rows.push({
      id: advisory.cveId ?? advisory.ghsaId,
      cveId: advisory.cveId,
      ghsaId: advisory.ghsaId,
      summary: summarize(advisory.summary || advisory.description),
      severity: normalizeSeverity(advisory.cvss?.severity) ?? normalizeSeverity(advisory.severity),
      cvssScore: advisory.cvss?.score ?? null,
      published: null,
      affected: [...new Set(advisory.ranges.map((range) => formatRange(range)))],
      fixedVersions: verifiedFixes(advisory.ranges, input.branches),
      status: catalogStatus({ phpNet: [], phpNetHasPrecise: false, others: advisory.ranges }),
      url: advisory.htmlUrl,
    });
  }

  rows.sort((a, b) => (b.published ?? "").localeCompare(a.published ?? "") || b.id.localeCompare(a.id));
  return rows;
}
