import { describe, expect, it } from "vitest";
import { badgeMessage } from "@/lib/badge";
import { countConfirmedSeverities } from "@/lib/evaluate";
import { buildVersionReport } from "@/lib/report";
import { upgradeCommands } from "@/lib/upgrade-commands";
import type { CheckResult, Finding } from "@/lib/types";

const finding = (severity: string | null, verdict: Finding["verdict"] = "confirmed") =>
  ({ severity, verdict }) as Finding;

describe("version report export", () => {
  it("counts confirmed severities and ignores potential rows", () => {
    expect(countConfirmedSeverities([
      finding("CRITICAL"),
      finding("HIGH"),
      finding("MEDIUM"),
      finding("LOW"),
      finding(null),
      finding("HIGH", "potential"),
    ])).toEqual({ critical: 1, high: 1, medium: 1, low: 1, unrated: 1 });
  });

  it("wraps the existing result and does not add vulnerability records", () => {
    const result = {
      version: "8.2.10",
      securityStatus: "no_known_issues",
      securityStatusLabel: "No known issues confirmed",
      counts: { total: 0, confirmed: 0, potential: 0, critical: 0, high: 0, medium: 0, low: 0, unrated: 0, rce: 0 },
      minimumFixedVersion: null,
      recommendedVersion: "8.4.12",
      support: { latestPatch: "8.2.30" },
      sources: [],
      disclaimer: "Not a full audit.",
      vulnerabilities: [],
    } as unknown as CheckResult;
    const report = buildVersionReport(result, new Date("2026-11-08T00:00:00.000Z"));
    expect(report.reportType).toBe("php-version-check");
    expect(report.result).toBe(result);
    expect(report.disclaimer).toBe(result.disclaimer);
    expect(JSON.stringify(report)).not.toMatch(/CVE-\d{4}-\d+/);
    expect(upgradeCommands({ recommended: "8.4.12", minimumFixed: null, branchLatest: null }).some((item) => item.command.includes("8.4.12"))).toBe(true);
  });

  it("escapes badge text", () => {
    expect(badgeMessage("PHP <8>", "a&b")).not.toContain("<8>");
    expect(badgeMessage("PHP <8>", "a&b")).toContain("&lt;8&gt;");
  });
});
