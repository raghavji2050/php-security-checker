#!/usr/bin/env node
// Smoke test for a production build: starts `next start` and checks the key
// pages and API responses that don't need live php.net/NVD data.
// Usage: npm run build && npm run smoke  (or SMOKE_BASE_URL=https://... npm run smoke)
import { spawn } from "node:child_process";

const port = process.env.SMOKE_PORT || "3123";
const external = process.env.SMOKE_BASE_URL;
const base = (external || `http://127.0.0.1:${port}`).replace(/\/$/, "");

const checks = [
  { path: "/", status: 200, contains: "PHP" },
  { path: "/how-it-works", status: 200, contains: "FAQPage" },
  { path: "/about", status: 200 },
  { path: "/php-v", status: 200, contains: "Paste php -v output" },
  { path: "/php-versions", status: 200, contains: "PHP versions support timeline" },
  { path: "/php-versions", status: 200, contains: "Branch risk scorecard" },
  { path: "/cves", status: 200, contains: "PHP CVE explorer" },
  { path: "/news", status: 200, contains: "PHP security news" },
  { path: "/composer", status: 200, contains: "composer.lock scanner" },
  { path: "/composer/php-constraint", status: 200, contains: "require.php constraint checker" },
  { path: "/php-ini", status: 200, contains: "php.ini audit" },
  { path: "/extensions", status: 200, contains: "PHP extension checker" },
  { path: "/laravel", status: 200, contains: "Laravel checker" },
  { path: "/symfony", status: 200, contains: "Symfony version checker" },
  { path: "/symfony/check/7.4.0", status: 200, contains: "Symfony 7.4.0 security check" },
  { path: "/wordpress", status: 200, contains: "WordPress core check" },
  { path: "/headers", status: 200, contains: "Security headers checker" },
  { path: "/docker", status: 200, contains: "Docker / PHP image check" },
  { path: "/.well-known/security.txt", status: 200, contains: "Contact:" },
  { path: "/8.1.12", status: 308, location: "/check/8.1.12" },
  { path: "/api/badge?v=nope", status: 400, contains: "invalid version" },
  { path: "/api/symfony/badge?v=nope", status: 400, contains: "invalid version" },
  { path: "/api/laravel", status: 400, json: (b) => b.code === "missing_version" },
  { path: "/api/symfony?v=7.4", status: 400, json: (b) => b.code === "invalid_version" },
  { path: "/api/wordpress?v=latest", status: 400, json: (b) => b.code === "invalid_version" },
  { path: "/api/docker-tag", status: 400, json: (b) => b.code === "missing_tag" },
  { path: "/api/composer-advisories", status: 400, json: (b) => b.code === "missing_packages" },
  { path: "/llms.txt", status: 200, contains: "/composer" },
  { path: "/openapi.json", status: 200, json: (b) => b.paths?.["/api/check"]?.get },
  { path: "/feeds/nope.xml", status: 404, contains: "Unknown feed" },
  { path: "/robots.txt", status: 200 },
  { path: "/sitemap.xml", status: 200, contains: "<urlset" },
  { path: "/sitemap.xml", status: 200, contains: "/cve/CVE-2026-109618" },
  { path: "/api/check", status: 400, json: (b) => b.code === "missing_version" },
  { path: "/api/check?v=8.1", status: 400, json: (b) => b.code === "invalid_version" },
  { path: "/api/health", status: 200, json: (b) => (b.status === "ok" || b.status === "degraded") && Array.isArray(b.sources) },
  // Unknown IDs render the not-found page inside the streamed response (soft 404, noindex), like /check/{bad}.
  { path: "/cve/not-a-cve", status: 200, contains: "Page not found" },
  { path: "/this-page-does-not-exist", status: 404, contains: "Page not found" },
  { path: "/", status: 200, contains: "Skip to content" },
];

async function waitForServer(timeoutMs = 60_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      await fetch(`${base}/robots.txt`);
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw new Error(`Server did not start at ${base}`);
}

let server;
if (!external) {
  // Own process group so the whole next-server tree can be stopped afterwards.
  server = spawn("npx", ["next", "start", "-p", port], { stdio: "ignore", detached: true, env: { ...process.env } });
}

let failed = 0;
try {
  await waitForServer();
  for (const check of checks) {
    const res = await fetch(`${base}${check.path}`, { redirect: "manual" });
    const text = await res.text();
    const problems = [];
    if (res.status !== check.status) problems.push(`status ${res.status}, expected ${check.status}`);
    if (check.contains && !text.includes(check.contains)) problems.push(`missing "${check.contains}"`);
    if (check.location && !(res.headers.get("location") || "").includes(check.location)) {
      problems.push(`location ${res.headers.get("location")}`);
    }
    if (check.json) {
      try {
        if (!check.json(JSON.parse(text))) problems.push("unexpected JSON body");
      } catch {
        problems.push("body is not JSON");
      }
    }
    if (problems.length) failed += 1;
    console.log(`${problems.length ? "FAIL" : "ok  "} ${check.path}${problems.length ? ` (${problems.join("; ")})` : ""}`);
  }
} catch (error) {
  failed += 1;
  console.error(error instanceof Error ? error.message : error);
} finally {
  if (server?.pid) {
    try {
      process.kill(-server.pid, "SIGTERM");
    } catch {
      server.kill("SIGTERM");
    }
  }
}

console.log(failed ? `\n${failed} smoke check(s) failed` : `\nAll ${checks.length} smoke checks passed`);
process.exit(failed ? 1 : 0);
