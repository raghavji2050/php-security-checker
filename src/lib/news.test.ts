import { describe, expect, it } from "vitest";
import { formatStampWithZone } from "@/lib/format";
import {
  dedupeNewsItems,
  firstCveId,
  isLampRelevant,
  looksSecurityRelated,
  parseApacheHttpdVulns,
  parseCisaKev,
  parseGithubComposerAdvisories,
  parsePhpReleaseFeed,
  parseSourceFilter,
  presentNewsItems,
  sortNewsItems,
  type NewsItem,
} from "@/lib/news";

const item = (overrides: Partial<NewsItem>): NewsItem => ({
  title: "Example",
  url: "https://example.test/a",
  sourceId: "php",
  sourceName: "php.net news",
  publishedAt: "2026-01-01T00:00:00.000Z",
  summary: null,
  official: true,
  ...overrides,
});

describe("looksSecurityRelated and filters", () => {
  it("keeps security or release-like titles", () => {
    expect(looksSecurityRelated("PHP 8.5.12 released!")).toBe(true);
    expect(looksSecurityRelated("Critical vulnerability response")).toBe(true);
    expect(looksSecurityRelated("Security advisory for CVE-2099-1")).toBe(true);
    expect(looksSecurityRelated("PHP 9.0.0 RC5 available")).toBe(true);
    expect(looksSecurityRelated("How to deploy WordPress on a VPS")).toBe(false);
  });

  it("parses known source query values only", () => {
    expect(parseSourceFilter("php")).toBe("php");
    expect(parseSourceFilter(["cisa"])).toBe("cisa");
    expect(parseSourceFilter("reddit")).toBeNull();
    expect(parseSourceFilter(undefined)).toBeNull();
  });
});

describe("CISA LAMP allowlist", () => {
  it("accepts LAMP-relevant vendor/product pairs and rejects lookalikes", () => {
    expect(isLampRelevant("PHP Group", "PHP")).toBe(true);
    expect(isLampRelevant("WordPress", "WordPress Core")).toBe(true);
    expect(isLampRelevant("Laravel", "Laravel Framework")).toBe(true);
    expect(isLampRelevant("Apache", "HTTP Server")).toBe(true);
    expect(isLampRelevant("Oracle", "MySQL")).toBe(true);
    expect(isLampRelevant("MariaDB", "MariaDB Server")).toBe(true);
    expect(isLampRelevant("Apache", "Struts")).toBe(false);
    expect(isLampRelevant("Apache", "Tomcat")).toBe(false);
    expect(isLampRelevant("Nostromo", "nhttpd")).toBe(false);
    expect(isLampRelevant("ThinkPHP", "ThinkPHP")).toBe(false);
    expect(isLampRelevant("SonicWall", "SonicOS")).toBe(false);
  });

  it("keeps only allowlisted KEV rows and does not surface descriptions", () => {
    const items = parseCisaKev({
      vulnerabilities: [
        {
          cveID: "CVE-2099-1111",
          vendorProject: "PHP Group",
          product: "PHP",
          vulnerabilityName: "Synthetic PHP test vulnerability",
          dateAdded: "2026-05-01",
          shortDescription: "COPY_ME_NOT kev description",
        },
        {
          cveID: "CVE-2099-2222",
          vendorProject: "Apache",
          product: "Struts",
          vulnerabilityName: "Synthetic Struts issue",
          dateAdded: "2026-05-02",
          shortDescription: "COPY_ME_NOT struts",
        },
        {
          cveID: "not-a-cve",
          vendorProject: "PHP",
          product: "PHP",
          vulnerabilityName: "Malformed id",
        },
        {
          cveID: "CVE-2099-3333",
          vendorProject: "Apache",
          product: "HTTP Server",
          vulnerabilityName: "Synthetic httpd issue",
          dateAdded: "2026-04-15",
        },
      ],
    });
    expect(items.map((row) => row.title)).toEqual(["Synthetic PHP test vulnerability", "Synthetic httpd issue"]);
    expect(items[0].url).toBe("https://nvd.nist.gov/vuln/detail/CVE-2099-1111");
    expect(items[0].sourceId).toBe("cisa");
    expect(items[0].official).toBe(true);
    expect(items[0].summary).toBe("CISA Known Exploited Vulnerability CVE-2099-1111 affecting PHP Group PHP.");
    expect(JSON.stringify(items)).not.toContain("COPY_ME_NOT");
    expect(items[0].publishedAt).toBe("2026-05-01T00:00:00.000Z");
  });
});

describe("parsePhpReleaseFeed", () => {
  it("reads official title/link/date and a metadata summary, not the feed body", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:php="http://php.net/ns/releases">
  <entry>
    <title>PHP 9.9.9 released!</title>
    <id>http://example.test/releases/9_9_9.php</id>
    <php:version>9.9.9</php:version>
    <published>2026-03-01T00:00:00+00:00</published>
    <summary type="html">COPY_ME_NOT release summary</summary>
    <php:tag>security</php:tag>
    <content src="http://example.test/releases/9_9_9.php" type="application/xhtml+xml"/>
  </entry>
</feed>`;
    const items = parsePhpReleaseFeed(xml, "https://www.php.net/releases/feed.php");
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("PHP 9.9.9 released!");
    expect(items[0].url).toBe("http://example.test/releases/9_9_9.php");
    expect(items[0].summary).toBe("Official PHP 9.9.9 security release.");
    expect(items[0].official).toBe(true);
    expect(JSON.stringify(items)).not.toContain("COPY_ME_NOT");
  });
});

describe("parseGithubComposerAdvisories", () => {
  it("uses the official summary as the headline and skips withdrawn or malformed rows", () => {
    const items = parseGithubComposerAdvisories([
      {
        ghsa_id: "GHSA-aaaa-bbbb-cccc",
        cve_id: "CVE-2099-4444",
        html_url: "https://github.com/advisories/GHSA-aaaa-bbbb-cccc",
        summary: "Synthetic package advisory title",
        description: "COPY_ME_NOT long advisory write-up",
        published_at: "2026-06-01T10:00:00Z",
        withdrawn_at: null,
      },
      {
        ghsa_id: "GHSA-dddd-eeee-ffff",
        html_url: "https://github.com/advisories/GHSA-dddd-eeee-ffff",
        summary: "Withdrawn item",
        withdrawn_at: "2026-06-02T00:00:00Z",
      },
      { summary: "Missing identifiers", description: "nope" },
    ]);
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("Synthetic package advisory title");
    expect(items[0].summary).toBe("Composer ecosystem advisory GHSA-aaaa-bbbb-cccc (CVE-2099-4444).");
    expect(items[0].sourceId).toBe("composer");
    expect(JSON.stringify(items)).not.toContain("COPY_ME_NOT");
  });
});

describe("parseApacheHttpdVulns", () => {
  it("extracts CVE ids and short titles only, not the write-up", () => {
    const html = `
      <h1 id="2.4.99">Fixed in Apache HTTP Server 2.4.99</h1>
      <p class="cve-summary">Released <time datetime="2026-07-01">2026-07-01</time></p>
      <dl class="cve-list">
        <dt><h3 id="CVE-2099-5555"><a href="https://www.cve.org/CVERecord?id=CVE-2099-5555">CVE-2099-5555</a> (low): <name name="CVE-2099-5555">mod_example test overflow</name></h3></dt>
        <dd><p>COPY_ME_NOT apache write-up that must not be copied onto the page.</p></dd>
      </dl>`;
    const items = parseApacheHttpdVulns(html, "https://httpd.apache.org/security/vulnerabilities_24.html");
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("CVE-2099-5555: mod_example test overflow");
    expect(items[0].url).toBe("https://httpd.apache.org/security/vulnerabilities_24.html#CVE-2099-5555");
    expect(items[0].publishedAt).toBe("2026-07-01T00:00:00.000Z");
    expect(items[0].summary).toBe("Official Apache HTTP Server advisory for CVE-2099-5555.");
    expect(JSON.stringify(items)).not.toContain("COPY_ME_NOT");
  });
});

describe("dedupe, sort and present", () => {
  it("dedupes by normalized URL or source+title and sorts newest first", () => {
    const items = sortNewsItems(
      dedupeNewsItems([
        item({ title: "Same story", url: "https://example.test/post/", publishedAt: "2026-01-01T00:00:00.000Z" }),
        item({ title: "Same story", url: "https://EXAMPLE.test/post", publishedAt: "2026-02-01T00:00:00.000Z" }),
        item({ title: "Later", url: "https://example.test/later", publishedAt: "2026-03-01T00:00:00.000Z" }),
        item({ title: "Undated", url: "https://example.test/undated", publishedAt: null }),
      ]),
    );
    expect(items.map((row) => row.title)).toEqual(["Later", "Same story", "Undated"]);
  });

  it("filters by source and caps the page", () => {
    const items = [
      item({ title: "PHP one", url: "https://example.test/1", sourceId: "php" }),
      item({ title: "CISA one", url: "https://example.test/2", sourceId: "cisa" }),
    ];
    expect(presentNewsItems(items, "cisa").map((row) => row.title)).toEqual(["CISA one"]);
    expect(presentNewsItems(items, null)).toHaveLength(2);
  });
});

describe("formatting", () => {
  it("formats timestamps in IST without throwing", () => {
    const formatted = formatStampWithZone("2026-03-01T12:00:00.000Z", "Asia/Calcutta");
    expect(formatted).not.toBe("Not available");
    expect(formatted.toLowerCase()).toMatch(/ist|gmt\+0?5:30|india/);
    expect(firstCveId("Advisory for cve-2099-0001 today")).toBe("CVE-2099-0001");
  });
});
