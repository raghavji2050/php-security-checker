import { describe, expect, it } from "vitest";
import type { ExplorerRow } from "@/lib/cve-explorer";
import { buildOpenData, NVD_NOTICE } from "@/lib/open-data";

const row = (id: string, published: string | null): ExplorerRow => ({
  id, year: 2024, published, description: "Bug", severity: "HIGH", score: 7.5, cvssVersion: "3.1", branches: ["8.3"], checkVersions: ["8.3.1"],
});
const sources = [
  { name: "NIST NVD API 2.0", url: "https://services.nvd.nist.gov/rest/json/cves/2.0", retrievedAt: "2026-11-28T00:00:00Z", stale: false },
  { name: "PHP ChangeLog", url: "https://www.php.net/ChangeLog-8.php", retrievedAt: null, stale: false },
];

describe("buildOpenData", () => {
  const doc = buildOpenData({
    rows: [row("CVE-2024-0001", "2024-01-01"), row("CVE-2024-0002", "2024-06-01"), row("CVE-2024-0003", null)],
    siteUrl: "https://example.test/",
    retrievedAt: "2026-11-28T00:00:00Z",
    stale: false,
    sources,
  });

  it("sorts newest first and keeps undated rows last", () => {
    expect(doc.cves.map((c) => c.id)).toEqual(["CVE-2024-0002", "CVE-2024-0001", "CVE-2024-0003"]);
    expect(doc.count).toBe(3);
  });

  it("links to our page and NVD without trailing-slash doubling", () => {
    expect(doc.cves[0].url).toBe("https://example.test/cve/CVE-2024-0002");
    expect(doc.cves[0].nvdUrl).toBe("https://nvd.nist.gov/vuln/detail/CVE-2024-0002");
    expect(doc.generatedFrom).toBe("https://example.test/cves");
  });

  it("carries the NVD notice and only NVD sources", () => {
    expect(doc.attribution.notice).toBe(NVD_NOTICE);
    expect(doc.attribution.sources.map((s) => s.name)).toEqual(["NIST NVD API 2.0"]);
    expect(doc.lastDataUpdate).toBe("2026-11-28T00:00:00Z");
  });

  it("documents every field and drops internal-only data", () => {
    expect(Object.keys(doc.fields).sort()).toEqual(Object.keys(doc.cves[0]).sort());
    expect(doc.cves[0]).not.toHaveProperty("checkVersions");
  });
});
