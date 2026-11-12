import { describe, expect, it } from "vitest";
import type { ComposerAuditResult } from "@/lib/composer-types";
import { composerReportMarkdown, mdCell, versionReportMarkdown } from "@/lib/markdown-report";
import type { CheckResult, Finding } from "@/lib/types";

const finding = (id: string, verdict: Finding["verdict"]): Finding => ({
  id, cveId: id, ghsaId: null, description: "x", verdict, verdictLabel: verdict, severity: "HIGH", cvssScore: 7.5,
  cvssVersion: "3.1", cvssVector: null, affectedVersions: "<8.1.29", fixedVersion: "8.1.29", fixedVersionStatus: "verified",
  fixedVersionNote: "", prerequisites: [], advisoryUrl: null, references: [], sources: [], conflictNotes: [], rce: null, published: null,
});

const result = {
  version: "8.1.12",
  support: { label: "End of life", securitySupportEnd: "2025-12-31" },
  securityStatusLabel: "Vulnerable",
  counts: { confirmed: 1, critical: 0, high: 1, medium: 0, low: 0, unrated: 0 },
  minimumFixedVersion: "8.1.33",
  recommendedVersion: "8.5.12",
  vulnerabilities: [finding("CVE-2024-4577", "confirmed"), finding("CVE-2099-0001", "potential")],
  lastDataUpdate: "2026-11-12T05:00:00Z",
  stale: false,
  sources: [{ name: "NVD" }, { name: "php.net" }],
} as unknown as CheckResult;

describe("mdCell", () => {
  it("escapes pipes and newlines and fills empties", () => {
    expect(mdCell("a|b\nc")).toBe("a\\|b c");
    expect(mdCell(null)).toBe("—");
  });
});

describe("versionReportMarkdown", () => {
  it("lists confirmed findings only, with links back to the site", () => {
    const md = versionReportMarkdown(result, "https://example.test/");
    expect(md).toContain("## PHP 8.1.12 security check");
    expect(md).toContain("| [CVE-2024-4577](https://example.test/cve/CVE-2024-4577) | HIGH | 7.5 | 8.1.29 |");
    expect(md).not.toContain("CVE-2099-0001");
    expect(md).toContain("Full report: https://example.test/check/8.1.12");
  });
});

describe("composerReportMarkdown", () => {
  const base: ComposerAuditResult = { checkedAt: "2026-11-12T05:00:00Z", packageCount: 3, affectedCount: 0, advisoryCount: 0, findings: [], updateCommands: [], stale: false, source: "packagist" };
  it("says clean when there are no findings", () => {
    expect(composerReportMarkdown(base, "https://example.test")).toContain("No known advisories");
  });
  it("renders a table and update commands", () => {
    const md = composerReportMarkdown(
      {
        ...base, affectedCount: 1, advisoryCount: 1, updateCommands: ["composer update laravel/framework"],
        findings: [{ packageName: "laravel/framework", installedVersion: "12.0.0", isDev: false, advisoryId: "PKSA-1", title: "t", link: null,
          cve: "CVE-2026-114509", cveUrl: null, severity: "critical", affectedVersions: "<12.68.0", suggestedFixedVersions: ["12.68.0"], reportedAt: null, updateCommand: "" }],
      },
      "https://example.test",
    );
    expect(md).toContain("| laravel/framework | 12.0.0 | [CVE-2026-114509](https://nvd.nist.gov/vuln/detail/CVE-2026-114509) | critical | 12.68.0 |");
    expect(md).toContain("```sh\ncomposer update laravel/framework\n```");
  });
});

describe("symfonyReportMarkdown", () => {
  it("says Unavailable instead of 0 when Packagist failed", async () => {
    const { symfonyReportMarkdown } = await import("@/lib/markdown-report");
    const md = symfonyReportMarkdown(
      { version: "7.4.0", branch: "7.4", support: { state: "active" }, branchInfo: null, latestPatch: null, patchBehind: null, advisories: null, upgradeCommand: "composer update" } as never,
      "https://example.test",
    );
    expect(md).toContain("symfony/symfony 7.4.0:** Unavailable");
    expect(md).toContain("Latest 7.4 patch:** Unavailable");
    expect(md).toContain("https://example.test/symfony/check/7.4.0");
  });
});
