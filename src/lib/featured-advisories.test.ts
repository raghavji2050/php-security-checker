import { describe, expect, it } from "vitest";
import { FEATURED_CVES } from "@/lib/cve-page";
import { FEATURED_ADVISORIES, featuredAdvisory } from "@/lib/featured-advisories";
import { parsePhpVersion } from "@/lib/version";

describe("featured advisories", () => {
  it("are keyed by their own CVE ID and are in the sitemap list", () => {
    for (const [id, a] of Object.entries(FEATURED_ADVISORIES)) {
      expect(a.cveId).toBe(id);
      expect(FEATURED_CVES as readonly string[]).toContain(id);
      for (const v of a.fixedIn) expect(parsePhpVersion(v)).not.toBeNull();
      expect(a.ghsaUrl).toBe(`https://github.com/php/php-src/security/advisories/${a.ghsaId}`);
    }
  });
  it("looks up case-insensitively and returns null for others", () => {
    expect(featuredAdvisory("cve-2026-109618")?.ghsaId).toBe("GHSA-w8hw-w9fx-j79w");
    expect(featuredAdvisory("CVE-2024-4577")).toBeNull();
  });
});
