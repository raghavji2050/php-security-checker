import { describe, expect, it } from "vitest";
import { parseNvdCve } from "@/lib/nvd-parse";
import { versionInRange } from "@/lib/ranges";
import { parsePhpVersion } from "@/lib/version";

// These fixtures are synthetic records shaped like NVD API 2.0 responses.
// The CVE ids use the reserved-looking CVE-0000-* prefix on purpose so they
// can never be mistaken for real vulnerability data.

const version = (raw: string) => parsePhpVersion(raw)!;

const phpCpe = (extra: Record<string, unknown> = {}) => ({
  vulnerable: true,
  criteria: "cpe:2.3:a:php:php:*:*:*:*:*:*:*:*",
  ...extra,
});

describe("parseNvdCve", () => {
  it("returns null for junk input", () => {
    expect(parseNvdCve(null)).toBeNull();
    expect(parseNvdCve("CVE-0000-0001")).toBeNull();
    expect(parseNvdCve({})).toBeNull();
    expect(parseNvdCve({ cve: { id: "GHSA-xxxx" } })).toBeNull();
  });

  it("skips rejected records", () => {
    const raw = {
      cve: {
        id: "CVE-0000-0001",
        vulnStatus: "Rejected",
        configurations: [{ nodes: [{ cpeMatch: [phpCpe({ versionEndExcluding: "8.1.29" })] }] }],
      },
    };
    expect(parseNvdCve(raw)).toBeNull();
  });

  it("skips records that do not touch the PHP runtime", () => {
    const raw = {
      cve: {
        id: "CVE-0000-0002",
        configurations: [
          { nodes: [{ cpeMatch: [{ vulnerable: true, criteria: "cpe:2.3:a:php:pear:*:*:*:*:*:*:*:*" }] }] },
        ],
      },
    };
    expect(parseNvdCve(raw)).toBeNull();
  });

  it("accepts both the wrapped and the bare record shape", () => {
    const inner = {
      id: "CVE-0000-0003",
      configurations: [{ nodes: [{ cpeMatch: [phpCpe({ versionEndExcluding: "8.1.29" })] }] }],
    };
    expect(parseNvdCve({ cve: inner })?.id).toBe("CVE-0000-0003");
    expect(parseNvdCve(inner)?.id).toBe("CVE-0000-0003");
  });

  it("parses CPE ranges, the English description, and deduplicated CWEs", () => {
    const parsed = parseNvdCve({
      cve: {
        id: "CVE-0000-0004",
        published: "2026-01-01T00:00:00.000",
        descriptions: [
          { lang: "es", value: "Descripción" },
          { lang: "en", value: "English description" },
        ],
        weaknesses: [
          { description: [{ lang: "en", value: "cwe-787" }, { lang: "en", value: "NVD-CWE-Other" }] },
          { description: [{ lang: "en", value: "CWE-787" }] },
        ],
        configurations: [
          {
            nodes: [
              {
                cpeMatch: [phpCpe({ versionStartIncluding: "8.1.0", versionEndExcluding: "8.1.29" })],
              },
            ],
          },
        ],
      },
    });
    expect(parsed).not.toBeNull();
    expect(parsed!.description).toBe("English description");
    expect(parsed!.published).toBe("2026-01-01T00:00:00.000");
    expect(parsed!.weaknesses).toEqual(["CWE-787"]);
    expect(parsed!.cpeRanges).toHaveLength(1);
    const range = parsed!.cpeRanges[0];
    expect(range.precision).toBe("precise");
    expect(versionInRange(version("8.1.28"), range)).toBe(true);
    expect(versionInRange(version("8.1.29"), range)).toBe(false);
  });

  it("ignores negated nodes and non-vulnerable CPE matches", () => {
    const parsed = parseNvdCve({
      cve: {
        id: "CVE-0000-0005",
        configurations: [
          {
            nodes: [
              { negate: true, cpeMatch: [phpCpe({ versionEndExcluding: "7.4.0" })] },
              { cpeMatch: [phpCpe({ vulnerable: false, versionEndExcluding: "7.3.0" })] },
              { cpeMatch: [phpCpe({ versionEndExcluding: "8.2.20" })] },
            ],
          },
        ],
      },
    });
    expect(parsed!.cpeRanges).toHaveLength(1);
    expect(versionInRange(version("8.2.19"), parsed!.cpeRanges[0])).toBe(true);
  });

  it("records extra requirements from AND configurations as prerequisites", () => {
    const parsed = parseNvdCve({
      cve: {
        id: "CVE-0000-0006",
        configurations: [
          {
            operator: "AND",
            nodes: [
              { cpeMatch: [phpCpe({ versionEndExcluding: "8.3.8" })] },
              { cpeMatch: [{ vulnerable: false, criteria: "cpe:2.3:o:microsoft:windows:-:*:*:*:*:*:*:*" }] },
            ],
          },
        ],
      },
    });
    expect(parsed!.prerequisites).toEqual([
      "NVD configuration also requires cpe:2.3:o:microsoft:windows:-:*:*:*:*:*:*:*",
    ]);
  });

  it("reads php.net CNA affected data, including unaffected ranges and modules", () => {
    const parsed = parseNvdCve({
      cve: {
        id: "CVE-0000-0007",
        affected: [
          {
            source: "security@php.net",
            affectedData: [
              {
                vendor: "PHP Group",
                product: "PHP",
                modules: ["filter"],
                versions: [
                  { version: "8.1.*", lessThan: "8.1.30", status: "affected" },
                  { version: "8.1.30", status: "unaffected" },
                ],
              },
            ],
          },
          {
            source: "someone-else@example.com",
            affectedData: [{ vendor: "PHP Group", product: "PHP", versions: [{ version: "1.0.0" }] }],
          },
        ],
      },
    });
    expect(parsed).not.toBeNull();
    expect(parsed!.phpNetRanges).toHaveLength(1);
    expect(parsed!.phpNetHasPrecise).toBe(true);
    expect(parsed!.phpNetUnaffectedRanges).toHaveLength(1);
    expect(parsed!.prerequisites).toContain("Module: filter");
    expect(versionInRange(version("8.1.29"), parsed!.phpNetRanges[0])).toBe(true);
    expect(versionInRange(version("8.1.30"), parsed!.phpNetRanges[0])).toBe(false);
  });

  it("prefers the newest CVSS version and the Primary metric", () => {
    const parsed = parseNvdCve({
      cve: {
        id: "CVE-0000-0008",
        metrics: {
          cvssMetricV2: [{ type: "Primary", cvssData: { version: "2.0", baseScore: 5 } }],
          cvssMetricV31: [
            { type: "Secondary", cvssData: { version: "3.1", baseScore: 6.1, baseSeverity: "MEDIUM" } },
            {
              type: "Primary",
              cvssData: { version: "3.1", baseScore: 9.8, baseSeverity: "CRITICAL", vectorString: "CVSS:3.1/AV:N" },
            },
          ],
        },
        configurations: [{ nodes: [{ cpeMatch: [phpCpe({ versionEndExcluding: "8.0.30" })] }] }],
      },
    });
    expect(parsed!.cvss).toEqual({ score: 9.8, severity: "CRITICAL", version: "3.1", vector: "CVSS:3.1/AV:N" });
  });

  it("ranks vendor and php.net references first and caps the list at 12", () => {
    const references = [
      ...Array.from({ length: 14 }, (_, i) => ({ url: `https://example.com/${i}` })),
      { url: "https://www.php.net/ChangeLog-8.php", tags: ["Release Notes"] },
      { url: "https://github.com/php/php-src/security/advisories/x", tags: ["Vendor Advisory"] },
      { tags: ["Patch"] },
    ];
    const parsed = parseNvdCve({
      cve: {
        id: "CVE-0000-0009",
        references,
        configurations: [{ nodes: [{ cpeMatch: [phpCpe({ versionEndExcluding: "8.0.30" })] }] }],
      },
    });
    expect(parsed!.references).toHaveLength(12);
    expect(parsed!.references[0].url).toBe("https://github.com/php/php-src/security/advisories/x");
    expect(parsed!.references[1].url).toBe("https://www.php.net/ChangeLog-8.php");
  });
});
