import { describe, expect, it } from "vitest";
import { buildCatalog } from "@/lib/catalog";
import { makeRange } from "@/lib/ranges";
import type { NormalizedAdvisory, NormalizedCve, PhpBranch } from "@/lib/types";
import { parsePhpVersion } from "@/lib/version";

// Synthetic fixtures only (CVE-0000-* / GHSA-0000-*), never real vulnerability data.
const v = (raw: string) => parsePhpVersion(raw)!;

const cve = (overrides: Partial<NormalizedCve>): NormalizedCve => ({
  id: "CVE-0000-0001",
  description: "Synthetic issue.",
  published: "2026-01-01T00:00:00.000",
  weaknesses: [],
  cvss: { score: 9.8, severity: "CRITICAL", version: "3.1", vector: null },
  references: [],
  phpNetRanges: [],
  phpNetUnaffectedRanges: [],
  phpNetHasPrecise: false,
  cpeRanges: [],
  prerequisites: [],
  ...overrides,
});

const branches: PhpBranch[] = [
  {
    branch: "8.1",
    initialReleaseDate: null,
    activeSupportEnd: null,
    securitySupportEnd: null,
    state: "security",
    latestPatch: "8.1.30",
    releases: ["8.1.28", "8.1.29", "8.1.30"],
  },
];

describe("buildCatalog", () => {
  it("marks a precise php.net range confirmed and verifies the fix against php.net releases", () => {
    const range = makeRange({ version: v("8.1.0"), inclusive: true }, { version: v("8.1.29"), inclusive: false }, "8.1", "precise");
    const [row] = buildCatalog({ cves: [cve({ phpNetRanges: [range], phpNetHasPrecise: true })], advisories: [], branches });
    expect(row.status).toBe("confirmed");
    expect(row.fixedVersions).toEqual(["8.1.29"]);
    expect(row.severity).toBe("CRITICAL");
  });

  it("does not verify a fix that php.net has not published", () => {
    const range = makeRange(null, { version: v("8.1.99"), inclusive: false }, "8.1", "precise");
    const [row] = buildCatalog({ cves: [cve({ cpeRanges: [range] })], advisories: [], branches });
    expect(row.status).toBe("confirmed");
    expect(row.fixedVersions).toEqual([]);
  });

  it("keeps broad-only ranges as potentially affected and empty records as not verified", () => {
    const broad = makeRange({ version: v("8.1.0"), inclusive: true }, null, null, "broad");
    const rows = buildCatalog({
      cves: [cve({ id: "CVE-0000-0002", cpeRanges: [broad] }), cve({ id: "CVE-0000-0003", published: "2025-01-01" })],
      advisories: [],
      branches,
    });
    expect(rows.map((row) => [row.id, row.status])).toEqual([
      ["CVE-0000-0002", "potential"],
      ["CVE-0000-0003", "not_verified"],
    ]);
  });

  it("adds GitHub-only advisories once and skips ones already covered by NVD", () => {
    const advisory = (id: string, cveId: string | null): NormalizedAdvisory => ({
      ghsaId: id,
      cveId,
      summary: "Synthetic advisory",
      description: "",
      severity: "high",
      cvss: null,
      htmlUrl: `https://github.com/php/php-src/security/advisories/${id}`,
      cwes: [],
      ranges: [],
    });
    const rows = buildCatalog({
      cves: [cve({})],
      advisories: [advisory("GHSA-0000-0001", "CVE-0000-0001"), advisory("GHSA-0000-0002", null)],
      branches,
    });
    expect(rows).toHaveLength(2);
    expect(rows[0].ghsaId).toBe("GHSA-0000-0001");
    expect(rows[1]).toMatchObject({ id: "GHSA-0000-0002", severity: "HIGH", status: "not_verified" });
  });
});
