import { describe, expect, it } from "vitest";
import { evaluateVersion } from "@/lib/evaluate";
import { parseNvdCve } from "@/lib/nvd-parse";
import { makeRange, parseAffectedVersion, parsePhpRuntimeCpe } from "@/lib/ranges";
import type { NormalizedCve, PhpBranch } from "@/lib/types";
import { parsePhpVersion } from "@/lib/version";

const checkedAt = "2026-10-23T00:00:00.000Z";

function branch(overrides: Partial<PhpBranch> & Pick<PhpBranch, "branch" | "state">): PhpBranch {
  return {
    initialReleaseDate: "2024-11-21",
    activeSupportEnd: "2026-12-31",
    securitySupportEnd: "2028-12-31",
    latestPatch: null,
    releases: [],
    ...overrides,
  };
}

const supported: PhpBranch[] = [
  branch({
    branch: "8.1",
    state: "eol",
    initialReleaseDate: "2021-11-25",
    activeSupportEnd: "2023-11-25",
    securitySupportEnd: "2025-12-31",
    latestPatch: "8.1.34",
    releases: ["8.1.12", "8.1.29", "8.1.34"],
  }),
  branch({
    branch: "8.4",
    state: "active",
    latestPatch: "8.4.27",
    releases: ["8.4.26", "8.4.27"],
  }),
  branch({
    branch: "8.5",
    state: "active",
    initialReleaseDate: "2025-11-20",
    activeSupportEnd: "2027-12-31",
    securitySupportEnd: "2029-12-31",
    latestPatch: "8.5.12",
    releases: ["8.5.11", "8.5.12"],
  }),
];

function cve(overrides: Partial<NormalizedCve> & Pick<NormalizedCve, "id">): NormalizedCve {
  return {
    description: "Mock vulnerability used only in tests.",
    published: "2026-01-01T00:00:00.000Z",
    weaknesses: [],
    cvss: { score: 9.8, severity: "CRITICAL", version: "3.1", vector: "CVSS:3.1/AV:N" },
    references: [{ url: "https://example.test/advisory", tags: ["Vendor Advisory"] }],
    phpNetRanges: [],
    phpNetUnaffectedRanges: [],
    phpNetHasPrecise: false,
    cpeRanges: [],
    prerequisites: [],
    ...overrides,
  };
}

function baseInput(version: string, cves: NormalizedCve[], extra: Partial<Parameters<typeof evaluateVersion>[0]> = {}) {
  return {
    version,
    cves,
    advisories: [],
    changelog: {},
    branches: supported,
    checkedAt,
    lastDataUpdate: checkedAt,
    stale: false,
    sources: [],
    warnings: [],
    ...extra,
  };
}

describe("evaluateVersion", () => {
  it("confirms a precise php.net range and does not recommend an end-of-life branch", () => {
    const range = parseAffectedVersion({ version: "8.1.*", lessThan: "8.1.29", status: "affected" })[0];
    const result = evaluateVersion(
      baseInput("8.1.12", [
        cve({
          id: "CVE-2099-1000",
          phpNetRanges: [range],
          phpNetHasPrecise: true,
          weaknesses: ["CWE-78"],
          description: "Mock command injection in the PHP runtime used by tests.",
          prerequisites: ["Platform: Windows", "Module: CGI"],
        }),
      ]),
    );

    expect(result.supportStatus).toBe("eol");
    expect(result.securityStatus).toBe("vulnerable");
    expect(result.vulnerabilities).toHaveLength(1);
    expect(result.vulnerabilities[0].verdict).toBe("confirmed");
    expect(result.vulnerabilities[0].fixedVersion).toBe("8.1.29");
    expect(result.vulnerabilities[0].fixedVersionStatus).toBe("verified");
    expect(result.rceVulnerabilities[0].rce?.basis.some((item) => item.kind === "cwe")).toBe(true);
    expect(result.minimumFixedVersion).toBe("8.1.29");
    expect(result.recommendedVersion).toBe("8.5.12");
    expect(result.recommendedVersion).not.toBe("8.1.34");
  });

  it("marks conflicting changelog and php.net data as needing verification", () => {
    const range = parseAffectedVersion({ version: "8.4.*", lessThan: "8.4.27", status: "affected" })[0];
    const result = evaluateVersion(
      baseInput(
        "8.4.26",
        [cve({ id: "CVE-2099-2000", phpNetRanges: [range], phpNetHasPrecise: true, cvss: { score: 7.5, severity: "HIGH", version: "3.1", vector: null } })],
        { changelog: { "CVE-2099-2000": ["8.4.20"] } },
      ),
    );
    expect(result.vulnerabilities[0].verdict).toBe("potential");
    expect(result.vulnerabilities[0].verdictLabel).toContain("verification required");
    expect(result.securityStatus).toBe("caution");
    expect(result.minimumFixedVersion).toBeNull();
  });

  it("leaves the fixed release unverified when the next release is not published", () => {
    const end = parsePhpVersion("8.4.26")!;
    const range = makeRange({ version: parsePhpVersion("8.4.0")!, inclusive: true }, { version: end, inclusive: true }, null, "precise");
    const stuck = branch({
      branch: "8.4",
      state: "active",
      latestPatch: "8.4.26",
      releases: ["8.4.0", "8.4.26"],
    });
    const result = evaluateVersion(
      baseInput(
        "8.4.26",
        [
          cve({
            id: "CVE-2099-3000",
            cpeRanges: [range],
          }),
        ],
        { branches: [stuck, supported[2]] },
      ),
    );
    expect(result.vulnerabilities[0].verdict).toBe("confirmed");
    expect(result.vulnerabilities[0].fixedVersion).toBeNull();
    expect(result.vulnerabilities[0].fixedVersionStatus).toBe("not_verified");
    expect(result.minimumFixedStatus).toBe("not_verified");
  });

  it("returns green only when a supported branch has no confirmed or potential matches", () => {
    const result = evaluateVersion(baseInput("8.5.12", []));
    expect(result.securityStatus).toBe("no_known_issues");
    expect(result.counts.confirmed).toBe(0);
    expect(result.statusExplanation.toLowerCase()).toContain("does not mean");
  });

  it("turns a clean supported version yellow when the dataset is stale", () => {
    const result = evaluateVersion(baseInput("8.5.12", [], { stale: true, lastDataUpdate: "2026-01-01T00:00:00.000Z" }));
    expect(result.securityStatus).toBe("caution");
    expect(result.warnings.some((warning) => warning.toLowerCase().includes("stale"))).toBe(true);
  });

  it("turns an end-of-life branch yellow when nothing matches", () => {
    const result = evaluateVersion(baseInput("8.1.34", []));
    expect(result.supportStatus).toBe("eol");
    expect(result.securityStatus).toBe("caution");
    expect(result.recommendedVersion).toBe("8.5.12");
  });

  it("uses the later published bound when sources name two fixes on the same branch", () => {
    const earlier = makeRange(
      { version: parsePhpVersion("8.4.0")!, inclusive: true },
      { version: parsePhpVersion("8.4.27")!, inclusive: false },
      "8.4",
      "precise",
    );
    const later = makeRange(
      { version: parsePhpVersion("8.4.0")!, inclusive: true },
      { version: parsePhpVersion("8.4.28")!, inclusive: false },
      null,
      "precise",
    );
    const branch84 = branch({
      branch: "8.4",
      state: "active",
      latestPatch: "8.4.28",
      releases: ["8.4.26", "8.4.27", "8.4.28"],
    });
    const result = evaluateVersion(
      baseInput(
        "8.4.26",
        [cve({ id: "CVE-2099-7000", phpNetRanges: [earlier], phpNetHasPrecise: true, cpeRanges: [later] })],
        { branches: [branch84, supported[2]] },
      ),
    );
    expect(result.vulnerabilities[0].verdict).toBe("confirmed");
    expect(result.vulnerabilities[0].fixedVersion).toBe("8.4.28");
    expect(result.vulnerabilities[0].fixedVersionStatus).toBe("verified");
    expect(result.minimumFixedVersion).toBe("8.4.28");
  });

  it("does not turn a changelog mention into a finding without a structured range", () => {
    const result = evaluateVersion(
      baseInput("8.4.26", [cve({ id: "CVE-2099-6000" })], {
        changelog: { "CVE-2099-6000": ["8.4.27"] },
      }),
    );
    expect(result.vulnerabilities).toHaveLength(0);
  });

  it("does not confirm a version the php.net range excludes, even if a loose CPE exists", () => {
    const phpNet = parseAffectedVersion({ version: "8.4.*", lessThan: "8.4.27", status: "affected" });
    const loose = parsePhpRuntimeCpe({
      vulnerable: true,
      criteria: "cpe:2.3:a:php:php:*:*:*:*:*:*:*:*",
      versionEndExcluding: "8.4.27",
    });
    const result = evaluateVersion(
      baseInput("8.1.12", [
        cve({
          id: "CVE-2099-4000",
          phpNetRanges: phpNet,
          phpNetHasPrecise: true,
          cpeRanges: loose ? [loose] : [],
        }),
      ]),
    );
    expect(result.vulnerabilities).toHaveLength(0);
    expect(result.securityStatus).toBe("caution");
  });
});

describe("parseNvdCve", () => {
  it("drops records that are not the PHP runtime and records with no version range", () => {
    expect(
      parseNvdCve({
        cve: {
          id: "CVE-2099-5000",
          descriptions: [{ lang: "en", value: "Unrelated application written in PHP." }],
          configurations: [
            {
              nodes: [
                {
                  cpeMatch: [{ vulnerable: true, criteria: "cpe:2.3:a:php:phpmyadmin:5.2.1:*:*:*:*:*:*:*" }],
                },
              ],
            },
          ],
        },
      }),
    ).toBeNull();

    expect(
      parseNvdCve({
        cve: {
          id: "CVE-2099-5001",
          descriptions: [{ lang: "en", value: "Wildcard with no bounds." }],
          configurations: [
            {
              nodes: [
                {
                  cpeMatch: [{ vulnerable: true, criteria: "cpe:2.3:a:php:php:*:*:*:*:*:*:*:*" }],
                },
              ],
            },
          ],
        },
      }),
    ).toBeNull();
  });
});
