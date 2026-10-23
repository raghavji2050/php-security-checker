import { classifyRce } from "@/lib/rce";
import { formatRange, impliedFixOnBranch, versionInRange, type VersionRange } from "@/lib/ranges";
import { supportLabel } from "@/lib/lifecycle";
import { buildUpgradeAdvice, userBranchOf } from "@/lib/upgrade";
import {
  DISCLAIMER,
  type ChangelogIndex,
  type CvssMetric,
  type Finding,
  type FixedStatus,
  type NormalizedAdvisory,
  type NormalizedCve,
  type PhpBranch,
  type CheckResult,
  type SourceInfo,
} from "@/lib/types";
import { compareVersions, parsePhpVersion, versionBranch, type PhpVersion } from "@/lib/version";

export type EvaluationInput = {
  version: string;
  cves: NormalizedCve[];
  advisories: NormalizedAdvisory[];
  changelog: ChangelogIndex;
  branches: PhpBranch[];
  checkedAt: string;
  lastDataUpdate: string | null;
  stale: boolean;
  sources: SourceInfo[];
  warnings: string[];
};

const VERDICT_LABEL = {
  confirmed: "Confirmed vulnerable",
  potential: "Potentially affected — verification required",
} as const;

export function evaluateVersion(input: EvaluationInput): CheckResult {
  const parsed = parsePhpVersion(input.version);
  if (!parsed) {
    throw new Error("evaluateVersion requires a valid MAJOR.MINOR.PATCH version");
  }

  const branch = userBranchOf(parsed.raw, input.branches);
  const advisoriesByCve = new Map<string, NormalizedAdvisory[]>();
  const advisoriesByGhsa = new Map<string, NormalizedAdvisory>();
  for (const advisory of input.advisories) {
    advisoriesByGhsa.set(advisory.ghsaId, advisory);
    if (advisory.cveId) {
      const list = advisoriesByCve.get(advisory.cveId) ?? [];
      list.push(advisory);
      advisoriesByCve.set(advisory.cveId, list);
    }
  }

  const findings: Finding[] = [];
  const consumedGhsa = new Set<string>();

  for (const cve of input.cves) {
    const related = advisoriesByCve.get(cve.id) ?? [];
    for (const advisory of related) consumedGhsa.add(advisory.ghsaId);
    const finding = assessRecord({
      id: cve.id,
      cveId: cve.id,
      ghsaId: related[0]?.ghsaId ?? null,
      description: cve.description,
      published: cve.published,
      weaknesses: cve.weaknesses,
      cvss: cve.cvss,
      severityFallback: null,
      references: cve.references,
      prerequisites: cve.prerequisites,
      phpNetRanges: cve.phpNetRanges,
      phpNetUnaffected: cve.phpNetUnaffectedRanges,
      phpNetHasPrecise: cve.phpNetHasPrecise,
      cpeRanges: cve.cpeRanges,
      ghsaRanges: related.flatMap((advisory) => advisory.ranges),
      ghsaUrl: related[0]?.htmlUrl ?? null,
      version: parsed,
      releases: branch?.releases ?? [],
      changelog: input.changelog,
    });
    if (finding) findings.push(finding);
  }

  for (const advisory of input.advisories) {
    if (consumedGhsa.has(advisory.ghsaId)) continue;
    if (advisory.cveId && input.cves.some((cve) => cve.id === advisory.cveId)) continue;
    const finding = assessRecord({
      id: advisory.cveId ?? advisory.ghsaId,
      cveId: advisory.cveId,
      ghsaId: advisory.ghsaId,
      description: advisory.description || advisory.summary,
      published: null,
      weaknesses: advisory.cwes,
      cvss: advisory.cvss,
      severityFallback: advisory.severity,
      references: [{ url: advisory.htmlUrl, tags: ["Vendor Advisory"] }],
      prerequisites: [],
      phpNetRanges: [],
      phpNetUnaffected: [],
      phpNetHasPrecise: false,
      cpeRanges: [],
      ghsaRanges: advisory.ranges,
      ghsaUrl: advisory.htmlUrl,
      version: parsed,
      releases: branch?.releases ?? [],
      changelog: input.changelog,
    });
    if (finding) findings.push(finding);
  }

  findings.sort((a, b) => (b.cvssScore ?? -1) - (a.cvssScore ?? -1) || a.id.localeCompare(b.id));

  const confirmed = findings.filter((finding) => finding.verdict === "confirmed");
  const potential = findings.filter((finding) => finding.verdict === "potential");
  const rce = findings.filter((finding) => finding.rce);
  const upgrade = buildUpgradeAdvice(parsed.raw, branch, input.branches, confirmed);
  const supportState = branch?.state ?? "unknown";
  const { securityStatus, securityStatusLabel, statusExplanation } = statusFor({
    confirmed: confirmed.length,
    potential: potential.length,
    supportState,
    stale: input.stale,
  });

  const warnings = [...input.warnings];
  if (input.stale) {
    warnings.push(
      `Vulnerability data is stale. The last successful sync was ${input.lastDataUpdate ?? "unknown"}. It is not current.`,
    );
  }
  if (potential.length > 0) {
    warnings.push(
      `${potential.length} record${potential.length === 1 ? "" : "s"} matched only loosely, or trusted sources disagree. Those are marked potentially affected and need verification.`,
    );
  }

  return {
    version: parsed.raw,
    supportStatus: supportState,
    support: {
      branch: branch?.branch ?? versionBranch(parsed),
      state: supportState,
      label: supportLabel(supportState),
      initialReleaseDate: branch?.initialReleaseDate ?? null,
      activeSupportEnd: branch?.activeSupportEnd ?? null,
      securitySupportEnd: branch?.securitySupportEnd ?? null,
      latestPatch: branch?.latestPatch ?? null,
    },
    securityStatus,
    securityStatusLabel,
    statusExplanation,
    vulnerabilities: findings,
    rceVulnerabilities: rce,
    counts: {
      total: findings.length,
      confirmed: confirmed.length,
      potential: potential.length,
      critical: confirmed.filter((finding) => finding.severity === "CRITICAL").length,
      high: confirmed.filter((finding) => finding.severity === "HIGH").length,
      rce: rce.filter((finding) => finding.verdict === "confirmed").length,
    },
    ...upgrade,
    checkedAt: input.checkedAt,
    lastDataUpdate: input.lastDataUpdate,
    stale: input.stale,
    sources: input.sources,
    warnings,
    notes: [
      "Records that name the PHP runtime but publish no usable version range were excluded instead of guessed.",
      "GREEN means no matching CVE was confirmed in the data that could be checked, and the branch is still supported. It does not mean the installation is secure.",
    ],
    disclaimer: DISCLAIMER,
  };
}

function statusFor(input: {
  confirmed: number;
  potential: number;
  supportState: PhpBranch["state"];
  stale: boolean;
}): Pick<CheckResult, "securityStatus" | "securityStatusLabel" | "statusExplanation"> {
  if (input.confirmed > 0) {
    return {
      securityStatus: "vulnerable",
      securityStatusLabel: "Known vulnerabilities confirmed",
      statusExplanation:
        "At least one CVE has a structured PHP runtime range that contains this version, and trusted sources do not disagree. Red means confirmed issues in the data, not that every deployment can be exploited.",
    };
  }
  if (input.potential > 0 || input.stale || input.supportState === "eol" || input.supportState === "unknown") {
    const reasons: string[] = [];
    if (input.potential > 0) reasons.push("one or more records need verification");
    if (input.stale) reasons.push("the dataset is stale");
    if (input.supportState === "eol") reasons.push("the branch is end of life");
    if (input.supportState === "unknown") reasons.push("php.net did not publish support dates for this branch");
    return {
      securityStatus: "caution",
      securityStatusLabel: "Verification required",
      statusExplanation: `No confirmed match was found, but ${reasons.join(", ")}. Yellow is not a clean bill of health.`,
    };
  }
  return {
    securityStatus: "no_known_issues",
    securityStatusLabel: "No known matching vulnerabilities",
    statusExplanation:
      "No confirmed or unresolved PHP runtime CVE in the current data contains this version, and php.net still supports the branch. Green does not mean the version is guaranteed secure.",
  };
}

type AssessInput = {
  id: string;
  cveId: string | null;
  ghsaId: string | null;
  description: string;
  published: string | null;
  weaknesses: string[];
  cvss: CvssMetric | null;
  severityFallback: string | null;
  references: Finding["references"];
  prerequisites: string[];
  phpNetRanges: VersionRange[];
  phpNetUnaffected: VersionRange[];
  phpNetHasPrecise: boolean;
  cpeRanges: VersionRange[];
  ghsaRanges: VersionRange[];
  ghsaUrl: string | null;
  version: PhpVersion;
  releases: string[];
  changelog: ChangelogIndex;
};

function assessRecord(input: AssessInput): Finding | null {
  const inUnaffected = input.phpNetUnaffected.some((range) => versionInRange(input.version, range));
  const phpNetHit = !inUnaffected && input.phpNetRanges.some((range) => range.precision === "precise" && versionInRange(input.version, range));
  const phpNetBroad = !inUnaffected && input.phpNetRanges.some((range) => range.precision === "broad" && versionInRange(input.version, range));
  const phpNetMiss = inUnaffected || (input.phpNetHasPrecise && !phpNetHit);
  const cpePrecise = input.cpeRanges.some((range) => range.precision === "precise" && versionInRange(input.version, range));
  const cpeBroad = input.cpeRanges.some((range) => range.precision === "broad" && versionInRange(input.version, range));
  const ghsaPrecise = input.ghsaRanges.some((range) => range.precision === "precise" && versionInRange(input.version, range));
  const ghsaBroad = input.ghsaRanges.some((range) => range.precision === "broad" && versionInRange(input.version, range));

  const changelogFixes = changelogFixesFor(input).filter((fix) => versionBranchOf(fix) === versionBranch(input.version));
  const earliestChangelogFix = earliestVersion(changelogFixes);
  const changelogSaysFixed = earliestChangelogFix
    ? compareVersions(input.version, earliestChangelogFix) >= 0
    : false;

  const affectedVotes = [phpNetHit, cpePrecise, ghsaPrecise].some(Boolean);
  const unaffectedVotes = Boolean(phpNetMiss) || changelogSaysFixed;
  const broadOnly = !affectedVotes && (phpNetBroad || cpeBroad || ghsaBroad);

  if (!affectedVotes && !broadOnly) return null;

  const conflict = affectedVotes && unaffectedVotes;
  const verdict = !affectedVotes || conflict ? "potential" : "confirmed";
  const conflictNotes: string[] = [];
  if (phpNetHit && changelogSaysFixed) {
    conflictNotes.push("php.net's affected range contains this version, but the PHP changelog lists an earlier or equal fix.");
  }
  if (phpNetMiss && (cpePrecise || ghsaPrecise)) {
    conflictNotes.push("A CPE or GitHub range contains this version, but the php.net affected list does not.");
  }
  if (!phpNetHit && !phpNetMiss && cpePrecise && changelogSaysFixed) {
    conflictNotes.push("The NVD CPE range contains this version, but the PHP changelog lists it as already fixed.");
  }

  const matchingRanges = [
    ...input.phpNetRanges.filter((range) => versionInRange(input.version, range)),
    ...input.cpeRanges.filter((range) => versionInRange(input.version, range)),
    ...input.ghsaRanges.filter((range) => versionInRange(input.version, range)),
  ];
  const affectedLabels = [...new Set(matchingRanges.map((range) => formatRange(range)))];
  const branch = versionBranch(input.version);
  const fixCandidates = new Set<string>();
  for (const range of matchingRanges) {
    const fix = impliedFixOnBranch(range, branch, input.releases);
    if (fix) fixCandidates.add(fix);
  }
  if (fixCandidates.size === 0 && earliestChangelogFix) fixCandidates.add(earliestChangelogFix.raw);

  let fixedVersion: string | null = null;
  let fixedVersionStatus: FixedStatus = "not_verified";
  let fixedVersionNote = "Not verified. No single fixed release could be confirmed from the structured ranges and the php.net release list.";
  const orderedFixes = [...fixCandidates].sort((left, right) => {
    const a = parsePhpVersion(left);
    const b = parsePhpVersion(right);
    if (!a || !b) return left.localeCompare(right);
    return compareVersions(a, b);
  });
  const publishedFixes = orderedFixes.filter((candidate) => input.releases.includes(candidate));
  const unpublishedFixes = orderedFixes.filter((candidate) => !input.releases.includes(candidate));
  if (verdict === "confirmed" && publishedFixes.length > 0 && unpublishedFixes.length === 0) {
    fixedVersion = publishedFixes[publishedFixes.length - 1];
    fixedVersionStatus = "verified";
    fixedVersionNote =
      publishedFixes.length === 1
        ? `${fixedVersion} is the fixed release named by the matching range and it is published on php.net.`
        : `Sources name ${publishedFixes.join(", ")}. ${fixedVersion} is the later bound, so it covers every stated fix, and it is published on php.net.`;
  } else if (orderedFixes.length > 0) {
    fixedVersionNote = `Sources name ${orderedFixes.join(", ")}, but that release was not found in the php.net release list used for this check. Fixed version: not verified.`;
  } else if (matchingRanges.some((range) => !range.end)) {
    fixedVersionNote = "The matching range has no upper bound, so the fixed release is not verified.";
  }

  const sources: Finding["sources"] = [];
  if (phpNetHit || phpNetMiss || phpNetBroad) {
    sources.push({ name: "php.net via NVD affected data", url: "https://www.php.net/releases/" });
  }
  if (cpePrecise || cpeBroad) {
    sources.push({ name: "NVD CPE configuration", url: `https://nvd.nist.gov/vuln/detail/${input.cveId ?? input.id}` });
  }
  if ((ghsaPrecise || ghsaBroad) && input.ghsaUrl) {
    sources.push({ name: "GitHub Security Advisory", url: input.ghsaUrl });
  }
  if (changelogFixes.length > 0) {
    const major = input.version.major >= 8 ? "8" : input.version.major >= 7 ? "7" : "5";
    sources.push({ name: "PHP ChangeLog", url: `https://www.php.net/ChangeLog-${major}.php` });
  }

  const advisoryUrl =
    input.ghsaUrl ??
    input.references.find((item) => item.tags.includes("Vendor Advisory") || item.url.includes("php.net") || item.url.includes("github.com/php/php-src"))?.url ??
    (input.cveId ? `https://nvd.nist.gov/vuln/detail/${input.cveId}` : null);

  const severity = input.cvss?.severity ?? normalizeSeverity(input.severityFallback);

  return {
    id: input.id,
    cveId: input.cveId,
    ghsaId: input.ghsaId,
    description: input.description,
    verdict,
    verdictLabel: VERDICT_LABEL[verdict],
    severity,
    cvssScore: input.cvss?.score ?? null,
    cvssVersion: input.cvss?.version ?? null,
    cvssVector: input.cvss?.vector ?? null,
    affectedVersions: affectedLabels.length > 0 ? affectedLabels.join("; ") : "Not provided",
    fixedVersion,
    fixedVersionStatus,
    fixedVersionNote,
    prerequisites: input.prerequisites,
    advisoryUrl,
    references: input.references,
    sources,
    conflictNotes,
    rce: classifyRce(input.weaknesses, input.description),
    published: input.published,
  };
}

function changelogFixesFor(input: AssessInput): string[] {
  const ids = [input.cveId, input.ghsaId].filter((id): id is string => Boolean(id));
  const versions = new Set<string>();
  for (const id of ids) {
    for (const version of input.changelog[id] ?? []) versions.add(version);
  }
  return [...versions];
}

function versionBranchOf(raw: string): string | null {
  const parsed = parsePhpVersion(raw);
  return parsed ? versionBranch(parsed) : null;
}

function earliestVersion(rawVersions: string[]): PhpVersion | null {
  let earliest: PhpVersion | null = null;
  for (const raw of rawVersions) {
    const parsed = parsePhpVersion(raw);
    if (!parsed) continue;
    if (!earliest || compareVersions(parsed, earliest) < 0) earliest = parsed;
  }
  return earliest;
}

function normalizeSeverity(value: string | null): string | null {
  if (!value) return null;
  const upper = value.toUpperCase();
  if (["CRITICAL", "HIGH", "MEDIUM", "LOW", "NONE"].includes(upper)) return upper;
  return null;
}
