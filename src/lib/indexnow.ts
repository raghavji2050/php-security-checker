/**
 * IndexNow (https://www.indexnow.org/documentation) payload helpers. The key is public by
 * design: search engines verify it by fetching https://{host}/{key}.txt, which is committed
 * in public/. No secret is involved. Kept free of imports and TS-only runtime syntax so
 * scripts/indexnow.mts can run it with plain Node type stripping.
 */
export const INDEXNOW_KEY = "b4ffe2722d6124db514be3758af6ea2b";
export const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";
/** Spec limit per POST. */
export const INDEXNOW_MAX_URLS = 10_000;

export type IndexNowPayload = { host: string; key: string; keyLocation: string; urlList: string[] };

const KEY_RE = /^[a-zA-Z0-9-]{8,128}$/;

/** URLs from a sitemap.xml body (<loc> entries), XML entities decoded. */
export function sitemapUrls(xml: string): string[] {
  const out: string[] = [];
  for (const m of xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)) {
    out.push(m[1].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'"));
  }
  return out;
}

/**
 * Build one IndexNow batch for our own site only: drops URLs on any other host or scheme,
 * removes duplicates and caps at the spec limit.
 */
export function buildIndexNowPayload(siteUrl: string, urls: string[], key: string = INDEXNOW_KEY): IndexNowPayload {
  if (!KEY_RE.test(key)) throw new Error("IndexNow key must be 8-128 characters of a-z, A-Z, 0-9 or -");
  const site = new URL(siteUrl);
  if (site.protocol !== "https:") throw new Error("IndexNow site must be https");
  const seen = new Set<string>();
  const urlList: string[] = [];
  for (const raw of urls) {
    let u: URL;
    try {
      u = new URL(raw);
    } catch {
      continue;
    }
    if (u.protocol !== "https:" || u.host !== site.host) continue;
    u.hash = "";
    const href = u.toString();
    if (seen.has(href)) continue;
    seen.add(href);
    urlList.push(href);
    if (urlList.length >= INDEXNOW_MAX_URLS) break;
  }
  return { host: site.host, key, keyLocation: `https://${site.host}/${key}.txt`, urlList };
}
