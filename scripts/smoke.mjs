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
  { path: "/llms.txt", status: 200, contains: "/api/check" },
  { path: "/openapi.json", status: 200, json: (b) => b.paths?.["/api/check"]?.get },
  { path: "/robots.txt", status: 200 },
  { path: "/sitemap.xml", status: 200, contains: "<urlset" },
  { path: "/api/check", status: 400, json: (b) => b.code === "missing_version" },
  { path: "/api/check?v=8.1", status: 400, json: (b) => b.code === "invalid_version" },
  { path: "/api/health", status: 200, json: (b) => (b.status === "ok" || b.status === "degraded") && Array.isArray(b.sources) },
  { path: "/this-page-does-not-exist", status: 404 },
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
