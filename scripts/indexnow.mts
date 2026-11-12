#!/usr/bin/env node
// Ping IndexNow (Bing, Yandex, Seznam, Naver…) with our own sitemap URLs after a successful
// production deploy + smoke. Usage: npm run indexnow   (INDEXNOW_DRY_RUN=1 to print only)
// Always exits 0 so it can never break a deploy; read the logged status instead.
import { buildIndexNowPayload, INDEXNOW_ENDPOINT, sitemapUrls } from "../src/lib/indexnow.ts";

const SITE = "https://php-security-checker.vercel.app";

async function main() {
  const keyFile = await fetch(new URL(`/${buildIndexNowPayload(SITE, []).key}.txt`, SITE), { signal: AbortSignal.timeout(20_000) });
  if (!keyFile.ok) throw new Error(`key file not live yet (HTTP ${keyFile.status})`);
  const sitemap = await fetch(`${SITE}/sitemap.xml`, { signal: AbortSignal.timeout(30_000) });
  if (!sitemap.ok) throw new Error(`sitemap HTTP ${sitemap.status}`);
  const payload = buildIndexNowPayload(SITE, sitemapUrls(await sitemap.text()));
  console.log(`indexnow: ${payload.urlList.length} URLs for ${payload.host}`);
  if (payload.urlList.length === 0) return;
  if (process.env.INDEXNOW_DRY_RUN) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }
  const res = await fetch(INDEXNOW_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30_000),
  });
  const body = (await res.text()).slice(0, 300);
  console.log(`indexnow: HTTP ${res.status} ${res.statusText}${body ? ` — ${body}` : ""}`);
  console.log(res.status === 200 || res.status === 202 ? "indexnow: accepted" : "indexnow: not accepted (deploy unaffected)");
}

main().catch((error) => {
  console.log(`indexnow: skipped — ${error instanceof Error ? error.message : String(error)} (deploy unaffected)`);
});
