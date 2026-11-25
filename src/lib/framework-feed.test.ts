import { describe, expect, it } from "vitest";
import {
  buildFrameworkFeed,
  frameworkFeedHref,
  parseFrameworkFilter,
  severityVariant,
  splitAffectedRanges,
  toIsoUtc,
} from "@/lib/framework-feed";
import type { PackagistAdvisory } from "@/lib/packagist-advisories";

function adv(partial: Partial<PackagistAdvisory> & { advisoryId: string }): PackagistAdvisory {
  return {
    packageName: "laravel/framework",
    title: "Example",
    link: "https://github.com/advisories/GHSA-xxxx-xxxx-xxxx",
    cve: null,
    affectedVersions: ">=1.0.0,<1.2.0",
    severity: "high",
    reportedAt: "2026-11-01 10:00:00",
    sources: [],
    ...partial,
  };
}

describe("buildFrameworkFeed", () => {
  const data = {
    "laravel/framework": [
      adv({ advisoryId: "PKSA-a", reportedAt: "2026-11-13 18:54:31", cve: "CVE-2026-1234", severity: "LOW" }),
      adv({ advisoryId: "PKSA-b", reportedAt: "2026-10-23 21:50:27", affectedVersions: "<10.50.4|>=11.0.0,<11.56.1" }),
    ],
    "symfony/symfony": [
      adv({ advisoryId: "PKSA-c", packageName: "symfony/symfony", reportedAt: "2026-11-04 11:26:51", severity: null }),
      adv({ advisoryId: "PKSA-a", packageName: "symfony/symfony" }),
    ],
    "unrelated/pkg": [adv({ advisoryId: "PKSA-z", reportedAt: "2026-12-01 00:00:00" })],
  };

  it("sorts newest first, drops duplicates and unknown packages", () => {
    const feed = buildFrameworkFeed(data);
    expect(feed.map((i) => i.advisoryId)).toEqual(["PKSA-a", "PKSA-c", "PKSA-b"]);
    expect(feed[0].severity).toBe("low");
    expect(feed[0].cveUrl).toBe("https://nvd.nist.gov/vuln/detail/CVE-2026-1234");
    expect(feed[0].reportedAt).toBe("2026-11-13T18:54:31.000Z");
  });

  it("keeps unknown severity null and gives the right composer command", () => {
    const symfony = buildFrameworkFeed(data, { framework: "symfony" });
    const c = symfony.find((i) => i.advisoryId === "PKSA-c");
    expect(symfony.every((i) => i.framework === "symfony")).toBe(true);
    expect(c?.severity).toBeNull();
    expect(c?.updateCommand).toBe('composer update "symfony/*" --with-all-dependencies');
    const laravel = buildFrameworkFeed(data, { framework: "laravel" });
    expect(laravel[1].affectedRanges).toEqual(["<10.50.4", ">=11.0.0,<11.56.1"]);
    expect(laravel[1].updateCommand).toBe("composer update laravel/framework --with-all-dependencies");
  });

  it("respects the limit and rejects non-https links and bad CVE ids", () => {
    const feed = buildFrameworkFeed(
      { "laravel/framework": [adv({ advisoryId: "x", link: "javascript:alert(1)", cve: "nope" }), adv({ advisoryId: "y" })] },
      { limit: 1 },
    );
    expect(feed).toHaveLength(1);
    const all = buildFrameworkFeed({ "laravel/framework": [adv({ advisoryId: "x", link: "javascript:alert(1)", cve: "nope" })] });
    expect(all[0].link).toBeNull();
    expect(all[0].cve).toBeNull();
  });
});

describe("helpers", () => {
  it("parses filters", () => {
    expect(parseFrameworkFilter("Laravel")).toBe("laravel");
    expect(parseFrameworkFilter(["symfony"])).toBe("symfony");
    expect(parseFrameworkFilter("rails")).toBeNull();
    expect(parseFrameworkFilter(undefined)).toBeNull();
    expect(frameworkFeedHref(null)).toBe("/framework-cves");
    expect(frameworkFeedHref("laravel")).toBe("/framework-cves?framework=laravel");
  });

  it("splits ranges, converts dates and maps severity", () => {
    expect(splitAffectedRanges(" <1.0 | >=2.0,<2.1 |")).toEqual(["<1.0", ">=2.0,<2.1"]);
    expect(toIsoUtc(null)).toBeNull();
    expect(toIsoUtc("garbage")).toBeNull();
    expect(severityVariant("critical")).toBe("danger");
    expect(severityVariant("moderate")).toBe("warning");
    expect(severityVariant(null)).toBe("outline");
  });
});
