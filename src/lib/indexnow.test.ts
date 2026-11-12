import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildIndexNowPayload, INDEXNOW_KEY, INDEXNOW_MAX_URLS, sitemapUrls } from "@/lib/indexnow";

const SITE = "https://php-security-checker.vercel.app";

describe("sitemapUrls", () => {
  it("reads <loc> entries and decodes entities", () => {
    const xml = `<urlset><url><loc>${SITE}/</loc></url><url><loc> ${SITE}/changes?from=8.3.1&amp;to=8.3.2 </loc></url></urlset>`;
    expect(sitemapUrls(xml)).toEqual([`${SITE}/`, `${SITE}/changes?from=8.3.1&to=8.3.2`]);
  });
});

describe("buildIndexNowPayload", () => {
  it("builds the spec payload for our host only", () => {
    const p = buildIndexNowPayload(SITE, [`${SITE}/cves`, `${SITE}/cves#x`, "https://evil.example/cves", `http://php-security-checker.vercel.app/x`, "not a url", `${SITE}/php-v`]);
    expect(p).toEqual({
      host: "php-security-checker.vercel.app",
      key: INDEXNOW_KEY,
      keyLocation: `${SITE}/${INDEXNOW_KEY}.txt`,
      urlList: [`${SITE}/cves`, `${SITE}/php-v`],
    });
  });
  it("caps at the spec limit", () => {
    const urls = Array.from({ length: INDEXNOW_MAX_URLS + 5 }, (_, i) => `${SITE}/check/8.3.${i}`);
    expect(buildIndexNowPayload(SITE, urls).urlList).toHaveLength(INDEXNOW_MAX_URLS);
  });
  it("rejects bad keys and non-https sites", () => {
    expect(() => buildIndexNowPayload(SITE, [], "short")).toThrow();
    expect(() => buildIndexNowPayload("http://example.test", [])).toThrow();
  });
  it("has a committed key-location file whose content is exactly the key", () => {
    const file = path.resolve(__dirname, `../../public/${INDEXNOW_KEY}.txt`);
    expect(readFileSync(file, "utf8")).toBe(INDEXNOW_KEY);
  });
});
