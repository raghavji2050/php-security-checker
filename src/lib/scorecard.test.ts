import { describe, expect, it } from "vitest";
import type { ExplorerRow } from "@/lib/cve-explorer";
import { buildScorecard, recommendedBranch, riskFor } from "@/lib/scorecard";
import type { PhpBranch } from "@/lib/types";

// Synthetic fixtures only (not real php.net dates or real CVEs).
const branch = (b: string, init: string | null, sec: string | null, state: PhpBranch["state"]): PhpBranch => ({
  branch: b,
  initialReleaseDate: init,
  activeSupportEnd: null,
  securitySupportEnd: sec,
  state,
  latestPatch: `${b}.9`,
  releases: [],
});

const cve = (id: string, severity: ExplorerRow["severity"], branches: string[]): ExplorerRow => ({
  id,
  year: 2025,
  published: "2025-01-01",
  description: "",
  severity,
  score: null,
  cvssVersion: null,
  branches,
  checkVersions: [],
});

const branches = [
  branch("1.0", "2010-01-01", "2013-01-01", "eol"),
  branch("2.0", "2020-01-01", "2024-01-01", "eol"),
  branch("3.0", "2022-01-01", "2026-03-01", "security"),
  branch("4.0", "2024-01-01", "2028-01-01", "active"),
  branch("5.0", null, null, "unknown"),
];
const cves = [cve("X-1", "CRITICAL", ["2.0", "3.0"]), cve("X-2", "MEDIUM", ["3.0"]), cve("X-3", "HIGH", ["2.0"])];

describe("buildScorecard", () => {
  it("keeps dated recent branches newest first with CVE counts", () => {
    const rows = buildScorecard(branches, cves, "2026-01-01");
    expect(rows.map((r) => r.branch)).toEqual(["4.0", "3.0", "2.0"]);
    expect(rows.find((r) => r.branch === "3.0")).toMatchObject({ cveCount: 2, criticalHighCount: 1, daysOfSecuritySupportLeft: 59, risk: "moderate" });
    expect(rows.find((r) => r.branch === "2.0")).toMatchObject({ cveCount: 2, criticalHighCount: 2, risk: "high" });
    expect(rows.find((r) => r.branch === "4.0")).toMatchObject({ cveCount: 0, risk: "lower" });
  });

  it("leaves counts null when NVD data is unavailable", () => {
    const rows = buildScorecard(branches, null, "2026-01-01");
    expect(rows.every((r) => r.cveCount === null && r.criticalHighCount === null)).toBe(true);
  });
});

describe("riskFor", () => {
  it("maps support state to a risk level", () => {
    expect(riskFor("active", 500)).toBe("lower");
    expect(riskFor("security", 30)).toBe("moderate");
    expect(riskFor("security", -1)).toBe("high");
    expect(riskFor("eol", null)).toBe("high");
    expect(riskFor("unknown", null)).toBe("unknown");
  });
});

describe("recommendedBranch", () => {
  it("prefers the newest active branch, then the newest security-only branch", () => {
    expect(recommendedBranch(buildScorecard(branches, null, "2026-01-01"))).toBe("4.0");
    expect(recommendedBranch([{ branch: "3.0", state: "security" }, { branch: "2.0", state: "eol" }])).toBe("3.0");
    expect(recommendedBranch([{ branch: "2.0", state: "eol" }])).toBeNull();
  });
});
