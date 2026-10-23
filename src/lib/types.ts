import type { VersionRange } from "@/lib/ranges";

export type SupportState = "active" | "security" | "eol" | "unknown";

export type SecurityStatus = "vulnerable" | "caution" | "no_known_issues" | "unable_to_verify";

export type FindingVerdict = "confirmed" | "potential";

export type FixedStatus = "verified" | "not_verified";

export type CvssMetric = {
  score: number;
  severity: string | null;
  version: string;
  vector: string | null;
};

export type ReferenceLink = {
  url: string;
  tags: string[];
};

export type NormalizedCve = {
  id: string;
  description: string;
  published: string | null;
  weaknesses: string[];
  cvss: CvssMetric | null;
  references: ReferenceLink[];
  phpNetRanges: VersionRange[];
  phpNetUnaffectedRanges: VersionRange[];
  phpNetHasPrecise: boolean;
  cpeRanges: VersionRange[];
  prerequisites: string[];
};

export type NormalizedAdvisory = {
  ghsaId: string;
  cveId: string | null;
  summary: string;
  description: string;
  severity: string | null;
  cvss: CvssMetric | null;
  htmlUrl: string;
  cwes: string[];
  ranges: VersionRange[];
};

export type ChangelogIndex = Record<string, string[]>;

export type PhpBranch = {
  branch: string;
  initialReleaseDate: string | null;
  activeSupportEnd: string | null;
  securitySupportEnd: string | null;
  state: SupportState;
  latestPatch: string | null;
  releases: string[];
};

export type SourceInfo = {
  name: string;
  url: string;
  retrievedAt: string | null;
  stale: boolean;
};

export type RceBasis = {
  kind: "cwe" | "description";
  detail: string;
};

export type RceClassification = {
  categories: string[];
  basis: RceBasis[];
};

export type Finding = {
  id: string;
  cveId: string | null;
  ghsaId: string | null;
  description: string;
  verdict: FindingVerdict;
  verdictLabel: string;
  severity: string | null;
  cvssScore: number | null;
  cvssVersion: string | null;
  cvssVector: string | null;
  affectedVersions: string;
  fixedVersion: string | null;
  fixedVersionStatus: FixedStatus;
  fixedVersionNote: string;
  prerequisites: string[];
  advisoryUrl: string | null;
  references: ReferenceLink[];
  sources: { name: string; url: string }[];
  conflictNotes: string[];
  rce: RceClassification | null;
  published: string | null;
};

export type CheckResult = {
  version: string;
  supportStatus: SupportState;
  support: {
    branch: string;
    state: SupportState;
    label: string;
    initialReleaseDate: string | null;
    activeSupportEnd: string | null;
    securitySupportEnd: string | null;
    latestPatch: string | null;
  };
  securityStatus: SecurityStatus;
  securityStatusLabel: string;
  statusExplanation: string;
  vulnerabilities: Finding[];
  rceVulnerabilities: Finding[];
  counts: {
    total: number;
    confirmed: number;
    potential: number;
    critical: number;
    high: number;
    rce: number;
  };
  minimumFixedVersion: string | null;
  minimumFixedStatus: FixedStatus | "unavailable";
  minimumFixedNote: string;
  recommendedVersion: string | null;
  recommendedNote: string;
  compatibilityNotes: string[];
  checkedAt: string;
  lastDataUpdate: string | null;
  stale: boolean;
  sources: SourceInfo[];
  warnings: string[];
  notes: string[];
  disclaimer: string;
};

export const DISCLAIMER =
  "A version-only check cannot prove that a deployment is exploitable or safe. The SAPI, operating system, web server, loaded extensions, and configuration all change whether a bug can be reached. This report is not a substitute for a full security audit, and a green result is not a guarantee that the runtime is secure.";
