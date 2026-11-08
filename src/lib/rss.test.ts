import { describe, expect, it } from "vitest";
import { parseFeedItems, resolveFeedUrl, toIsoStamp, unwrapXmlText } from "@/lib/rss";

const ATOM = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Example Atom</title>
  <entry>
    <title>Synthetic PHP 9.9.9 released!</title>
    <id>https://example.test/releases/9_9_9.php</id>
    <published>2026-03-01T12:00:00+00:00</published>
    <updated>2026-03-01T12:00:00+00:00</updated>
    <link href="https://example.test/releases/9.9.9" rel="alternate" type="text/html"/>
    <link rel="enclosure" href="https://example.test/dist/php-9.9.9.tar.gz"/>
    <summary type="html"><![CDATA[<p>COPY_ME_NOT atom summary that must not appear</p>]]></summary>
    <content type="html"><p>COPY_ME_NOT atom content body</p></content>
  </entry>
  <entry>
    <title></title>
    <link rel="alternate" href="https://example.test/empty-title"/>
  </entry>
  <entry>
    <title>Missing link entry</title>
  </entry>
</feed>`;

const ATOM_CONTENT_SRC = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <title>PHP 9.8.7 released!</title>
    <id>http://example.test/releases/9_8_7.php</id>
    <published>2026-02-15T00:00:00+00:00</published>
    <link rel="enclosure" title="tarball" href="/distributions/php-9.8.7.tar.gz"/>
    <content src="http://example.test/releases/9_8_7.php" type="application/xhtml+xml"/>
  </entry>
</feed>`;

const RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title><![CDATA[Example RSS]]></title>
    <item>
      <title><![CDATA[Synthetic advisory: CVE-2099-0001 patched]]></title>
      <link>https://example.test/blog/cve-2099-0001</link>
      <pubDate>Mon, 02 Mar 2026 08:30:00 +0000</pubDate>
      <description><![CDATA[COPY_ME_NOT rss description HTML]]></description>
      <content:encoded><![CDATA[<p>COPY_ME_NOT encoded article</p>]]></content:encoded>
    </item>
    <item>
      <title>Relative link item</title>
      <link>/news/relative</link>
      <pubDate>not-a-real-date</pubDate>
    </item>
    <item>
      <title>No URL here</title>
      <guid isPermaLink="false">local-only-id</guid>
    </item>
  </channel>
</rss>`;

describe("parseFeedItems", () => {
  it("parses Atom title, alternate link and date and ignores content HTML", () => {
    const items = parseFeedItems(ATOM);
    expect(items).toHaveLength(1);
    expect(items[0]).toEqual({
      title: "Synthetic PHP 9.9.9 released!",
      url: "https://example.test/releases/9.9.9",
      publishedAt: "2026-03-01T12:00:00.000Z",
    });
    expect(JSON.stringify(items)).not.toContain("COPY_ME_NOT");
    expect(items[0]).not.toHaveProperty("description");
    expect(items[0]).not.toHaveProperty("content");
    expect(items[0]).not.toHaveProperty("summary");
  });

  it("uses content src or id when Atom has only enclosure links", () => {
    const items = parseFeedItems(ATOM_CONTENT_SRC);
    expect(items).toHaveLength(1);
    expect(items[0].url).toBe("http://example.test/releases/9_8_7.php");
    expect(items[0].title).toBe("PHP 9.8.7 released!");
  });

  it("parses RSS CDATA titles and skips description HTML", () => {
    const items = parseFeedItems(RSS, "https://example.test/feed");
    expect(items.map((item) => item.title)).toEqual([
      "Synthetic advisory: CVE-2099-0001 patched",
      "Relative link item",
    ]);
    expect(items[0].url).toBe("https://example.test/blog/cve-2099-0001");
    expect(items[0].publishedAt).toBe("2026-03-02T08:30:00.000Z");
    expect(items[1].url).toBe("https://example.test/news/relative");
    expect(items[1].publishedAt).toBeNull();
    expect(JSON.stringify(items)).not.toContain("COPY_ME_NOT");
  });

  it("skips malformed items and does not invent fields", () => {
    const items = parseFeedItems(ATOM + RSS);
    for (const item of items) {
      expect(Object.keys(item).sort()).toEqual(["publishedAt", "title", "url"]);
      expect(item.title.length).toBeGreaterThan(0);
      expect(item.url.startsWith("http")).toBe(true);
    }
  });
});

describe("feed helpers", () => {
  it("resolves relative URLs and rejects non-http schemes", () => {
    expect(resolveFeedUrl("/x", "https://example.test/feed")).toBe("https://example.test/x");
    expect(resolveFeedUrl("javascript:alert(1)", "https://example.test")).toBeNull();
  });

  it("returns null for invalid dates", () => {
    expect(toIsoStamp("not-a-date")).toBeNull();
    expect(toIsoStamp("2026-04-01")).toBe("2026-04-01T00:00:00.000Z");
  });

  it("unwraps entities and CDATA without leaving tags", () => {
    expect(unwrapXmlText("<![CDATA[Foo &amp; bar]]>")).toBe("Foo & bar");
    expect(unwrapXmlText("A <b>bold</b> title")).toBe("A bold title");
  });
});
