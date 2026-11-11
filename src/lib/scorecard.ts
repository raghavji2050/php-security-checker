import type { ExplorerRow } from "@/lib/cve-explorer";
import { compareBranches } from "@/lib/version";
import type { PhpBranch, SupportState } from "@/lib/types";

export type RiskLevel = "lower" | "moderate" | "high" | "unknown";

export type ScorecardRow = {
  branch: string;
  state: SupportState;
  latestPatch: string | null;
  /** Whole days until security support ends (negative once ended). Null when php.net gives no date. */
  daysOfSecuritySupportLeft: number | null;
  /** NVD CVEs whose configuration ranges map to this branch. Null when NVD data is unavailable. */
  cveCount: number | null;
  /** Of those, CVEs rated CRITICAL or HIGH. Null when NVD data is unavailable. */
  criticalHighCount: number | null;
  risk: RiskLevel;
};

export const RISK_LABEL: Record<RiskLevel, string> = {
  lower: "Lower risk",
  moderate: "Plan upgrade",
  high: "Upgrade now",
  unknown: "Unknown",
};

function daysBetween(from: string, to: string): number {
  const toUtc = (iso: string) => {
    const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((toUtc(to) - toUtc(from)) / 86_400_000);
}

/**
 * Risk comes from the official support state only, so the label never depends on guessed data:
 * active support is lower risk, security-only means plan an upgrade (sooner when under 180 days remain),
 * and end of life means upgrade now. CVE counts are context, not part of the label.
 */
export function riskFor(state: SupportState, daysLeft: number | null): RiskLevel {
  if (state === "active") return "lower";
  if (state === "eol") return "high";
  if (state === "security") return daysLeft !== null && daysLeft < 0 ? "high" : "moderate";
  return "unknown";
}

/**
 * One row per branch shown on the timeline, newest first. `cveRows` is null when NVD could not be loaded,
 * in which case counts stay null rather than showing a misleading zero.
 */
export function buildScorecard(branches: PhpBranch[], cveRows: ExplorerRow[] | null, today: string, sinceYear = 2015): ScorecardRow[] {
  return branches
    .filter((b) => b.initialReleaseDate && (!b.securitySupportEnd || Number(b.securitySupportEnd.slice(0, 4)) >= sinceYear))
    .sort((a, b) => compareBranches(b.branch, a.branch))
    .map((b) => {
      const daysLeft = b.securitySupportEnd ? daysBetween(today, b.securitySupportEnd) : null;
      const matching = cveRows?.filter((row) => row.branches.includes(b.branch)) ?? null;
      return {
        branch: b.branch,
        state: b.state,
        latestPatch: b.latestPatch,
        daysOfSecuritySupportLeft: daysLeft,
        cveCount: matching ? matching.length : null,
        criticalHighCount: matching ? matching.filter((r) => r.severity === "CRITICAL" || r.severity === "HIGH").length : null,
        risk: riskFor(b.state, daysLeft),
      };
    });
}

/** Newest branch still in active support, else newest security-only branch: the suggested upgrade target. */
export function recommendedBranch(rows: Pick<ScorecardRow, "branch" | "state">[]): string | null {
  const sorted = [...rows].sort((a, b) => compareBranches(b.branch, a.branch));
  return (sorted.find((r) => r.state === "active") ?? sorted.find((r) => r.state === "security"))?.branch ?? null;
}
