#!/usr/bin/env node
// PHP Security Checker GitHub Action — zero dependencies, Node 20+ (built-in fetch).
// Checks the project's PHP version and composer.lock packages against
// https://php-security-checker.vercel.app, fails CI on the chosen threshold and
// writes (or updates) one PR comment with exact fix commands.
//
// Only "vendor/package@version" pairs and the PHP version leave the runner — never
// source code or the raw composer.lock.
import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const COMMENT_MARKER = "<!-- php-security-checker-action -->";
export const DEFAULT_API_BASE = "https://php-security-checker.vercel.app";
export const FAIL_ON = ["any", "critical", "kev", "eol"];
export const KEV_URL = "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json";
const MAX_PACKAGES = 1500;
const MAX_ROWS = 25;
const PACKAGE_NAME = /^[a-z0-9]([_.-]?[a-z0-9]+)*\/[a-z0-9](([_.]|-{1,2})?[a-z0-9]+)*$/;
const FULL_VERSION = /(\d+)\.(\d+)\.(\d+)/;

/** Parse composer.lock text into [{ name, version, isDev }]. Throws on invalid input. */
export function parseLockPackages(text) {
  let lock;
  try {
    lock = JSON.parse(text);
  } catch {
    throw new Error("composer.lock is not valid JSON.");
  }
  if (!lock || typeof lock !== "object" || Array.isArray(lock)) throw new Error("composer.lock has an unexpected shape.");
  const out = [];
  const seen = new Set();
  for (const [key, isDev] of [["packages", false], ["packages-dev", true]]) {
    const list = lock[key];
    if (list === undefined || list === null) continue;
    if (!Array.isArray(list)) throw new Error(`composer.lock "${key}" must be an array.`);
    for (const item of list) {
      if (!item || typeof item.name !== "string" || typeof item.version !== "string") continue;
      const name = item.name.trim().toLowerCase();
      const version = item.version.trim();
      if (!PACKAGE_NAME.test(name) || !version || version.length > 64 || seen.has(name)) continue;
      seen.add(name);
      out.push({ name, version, isDev });
    }
  }
  if (out.length > MAX_PACKAGES) throw new Error(`Too many packages in composer.lock (${out.length}; max ${MAX_PACKAGES}).`);
  return out;
}

/** First exact X.Y.Z in a string ("8.3.12", ">=8.2.4", "v8.1.0"), else null. */
export function exactVersion(value) {
  if (typeof value !== "string") return null;
  const m = value.match(FULL_VERSION);
  return m ? `${Number(m[1])}.${Number(m[2])}.${Number(m[3])}` : null;
}

/**
 * Pick the PHP version to check. Order: explicit input, .php-version,
 * composer.json config.platform.php, composer.json require.php (exact X.Y.Z only),
 * then the runner's `php` binary. Returns { version, source } or { version: null, source: null }.
 */
export function resolvePhpVersion({ input, phpVersionFile, composerJson, runnerPhp }) {
  const candidates = [
    [input, "php-version input"],
    [phpVersionFile, ".php-version"],
    [composerJson?.config?.platform?.php, "composer.json config.platform.php"],
    [composerJson?.require?.php, "composer.json require.php"],
    [runnerPhp, "runner php binary"],
  ];
  for (const [value, source] of candidates) {
    const version = exactVersion(typeof value === "string" ? value.trim() : "");
    if (version) return { version, source };
  }
  return { version: null, source: null };
}

function compareVersions(a, b) {
  const pa = String(a).replace(/^v/i, "").split(/[.-]/).map((n) => parseInt(n, 10) || 0);
  const pb = String(b).replace(/^v/i, "").split(/[.-]/).map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

/** Group composer findings per package with the highest suggested fixed version. */
export function composerFixes(findings) {
  const byPkg = new Map();
  for (const f of findings ?? []) {
    const cur = byPkg.get(f.packageName) ?? { name: f.packageName, installed: f.installedVersion, fixed: null, count: 0, isDev: f.isDev === true };
    cur.count += 1;
    for (const v of f.suggestedFixedVersions ?? []) {
      if (!cur.fixed || compareVersions(v, cur.fixed) > 0) cur.fixed = v;
    }
    byPkg.set(f.packageName, cur);
  }
  return [...byPkg.values()]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((p) => ({
      ...p,
      update: `composer update ${p.name} --with-all-dependencies`,
      require: p.fixed ? `composer require "${p.name}:^${p.fixed}" --with-all-dependencies${p.isDev ? " --dev" : ""}` : null,
    }));
}

function isKev(cve, kevIds) {
  return Boolean(cve && kevIds && kevIds.has(cve.toUpperCase()));
}

/**
 * @typedef {{ php?: any, composer?: any, kevIds?: Set<string> | null, failOn?: string, errors?: string[] }} EvaluateArgs
 */

/**
 * Decide pass/fail. Any data error (API down, rate limited, unable_to_verify) fails:
 * a security gate must never turn green because it could not look.
 * @param {EvaluateArgs} args
 */
export function evaluate({ php, composer, kevIds, failOn = "any", errors = [] }) {
  if (!FAIL_ON.includes(failOn)) throw new Error(`fail-on must be one of: ${FAIL_ON.join(", ")}`);
  const reasons = [];
  const notes = [];
  for (const e of errors) reasons.push(`Unable to verify: ${e}`);

  const confirmed = (php?.vulnerabilities ?? []).filter((v) => v.verdict === "confirmed");
  const phpEol = php?.supportStatus === "eol";
  const phpKev = confirmed.filter((v) => isKev(v.cveId, kevIds));
  const phpCritical = confirmed.filter((v) => String(v.severity ?? "").toUpperCase() === "CRITICAL");
  const findings = composer?.findings ?? [];
  const composerKev = findings.filter((f) => isKev(f.cve, kevIds));
  const composerCritical = findings.filter((f) => String(f.severity ?? "").toLowerCase() === "critical");

  if (php?.securityStatus === "unable_to_verify") reasons.push(`Unable to verify PHP ${php.version}.`);
  if (failOn === "kev" && !kevIds) reasons.push("Unable to verify: CISA KEV catalog could not be loaded.");

  const pv = php ? `PHP ${php.version}` : "PHP";
  if (failOn === "any") {
    if (phpEol) reasons.push(`${pv} is end of life (no security fixes).`);
    if (confirmed.length) reasons.push(`${pv} has ${confirmed.length} confirmed known vulnerabilities.`);
    if (findings.length) reasons.push(`${new Set(findings.map((f) => f.packageName)).size} Composer package(s) have ${findings.length} security advisories.`);
  } else if (failOn === "critical") {
    if (phpCritical.length) reasons.push(`${pv} has ${phpCritical.length} confirmed CRITICAL vulnerabilities.`);
    if (composerCritical.length) reasons.push(`${composerCritical.length} CRITICAL Composer advisories.`);
  } else if (failOn === "kev") {
    if (phpKev.length) reasons.push(`${pv} has ${phpKev.length} CVEs in CISA KEV (actively exploited).`);
    if (composerKev.length) reasons.push(`${composerKev.length} Composer advisories are in CISA KEV (actively exploited).`);
  } else if (failOn === "eol" && phpEol) {
    reasons.push(`${pv} is end of life (no security fixes).`);
  }

  if (failOn !== "any") {
    if (phpEol && failOn !== "eol") notes.push(`${pv} is end of life.`);
    if (confirmed.length) notes.push(`${pv}: ${confirmed.length} confirmed CVEs in total (all severities).`);
    if (findings.length) notes.push(`${findings.length} Composer advisories in total (all severities).`);
  }
  if (php?.securityStatus === "caution") notes.push(`${pv} has potential (unconfirmed) matches only.`);

  return { failed: reasons.length > 0, reasons, notes, phpKev: phpKev.map((v) => v.cveId), composerKev: composerKev.map((f) => f.cve) };
}

function cell(value) {
  return String(value ?? "—").replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

const SEVERITY_RANK = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };

/**
 * Markdown for the PR comment / job summary. Starts with the idempotent marker.
 * @param {{ php?: any, phpSource?: string | null, composer?: any, composerSkipped?: string | null, kevIds?: Set<string> | null, result: { failed: boolean, reasons: string[], notes: string[] }, failOn?: string, apiBase?: string }} args
 */
export function renderComment({ php, phpSource, composer, composerSkipped, kevIds, result, failOn = "any", apiBase = DEFAULT_API_BASE }) {
  const base = apiBase.replace(/\/+$/, "");
  const lines = [COMMENT_MARKER];
  lines.push(result.failed ? "## ❌ PHP Security Check failed" : "## ✅ PHP Security Check passed");
  lines.push("");
  lines.push(`Threshold: \`fail-on: ${failOn}\``);
  for (const r of result.reasons) lines.push(`- ❌ ${r}`);
  for (const n of result.notes) lines.push(`- ⚠️ ${n}`);
  lines.push("");

  lines.push("### PHP runtime");
  if (!php) {
    lines.push("PHP version not checked: set the `php-version` input, a `.php-version` file, or `config.platform.php` in composer.json.");
  } else {
    const c = php.counts ?? {};
    lines.push(`**PHP ${php.version}** (from ${phpSource ?? "input"}) — ${php.securityStatusLabel ?? php.securityStatus}; support: **${php.support?.label ?? php.supportStatus}**${php.support?.securitySupportEnd ? ` (security support ends ${php.support.securitySupportEnd})` : ""}.`);
    lines.push(`Confirmed CVEs: ${c.confirmed ?? 0} (${c.critical ?? 0} critical, ${c.high ?? 0} high, ${c.medium ?? 0} medium, ${c.low ?? 0} low). [Full report](${base}/check/${php.version})`);
    const confirmed = (php.vulnerabilities ?? [])
      .filter((v) => v.verdict === "confirmed")
      .sort((a, b) => (isKev(b.cveId, kevIds) - isKev(a.cveId, kevIds)) || ((SEVERITY_RANK[String(b.severity).toUpperCase()] ?? 0) - (SEVERITY_RANK[String(a.severity).toUpperCase()] ?? 0)) || ((b.cvssScore ?? 0) - (a.cvssScore ?? 0)));
    if (confirmed.length) {
      lines.push("");
      lines.push("| CVE | Severity | CVSS | KEV | Fixed in |");
      lines.push("| --- | --- | --- | --- | --- |");
      for (const v of confirmed.slice(0, MAX_ROWS)) {
        const id = v.cveId ? `[${v.cveId}](${base}/cve/${v.cveId})` : cell(v.id);
        lines.push(`| ${id} | ${cell(v.severity)} | ${cell(v.cvssScore)} | ${isKev(v.cveId, kevIds) ? "🔥 yes" : "—"} | ${cell(v.fixedVersion)} |`);
      }
      if (confirmed.length > MAX_ROWS) lines.push(`\n…and ${confirmed.length - MAX_ROWS} more in the [full report](${base}/check/${php.version}).`);
    }
    const target = php.minimumFixedVersion ?? php.support?.latestPatch;
    if (confirmed.length || php.supportStatus === "eol") {
      lines.push("");
      lines.push("**Fix:**");
      if (target && compareVersions(target, php.version) > 0) lines.push(`- Upgrade PHP ${php.version} → **${target}** (minimum fixed release${php.support?.latestPatch && php.support.latestPatch !== target ? `; latest ${php.support.branch} patch is ${php.support.latestPatch}` : ""}).`);
      if (php.supportStatus === "eol" && php.recommendedVersion) lines.push(`- PHP ${php.support?.branch ?? php.version} is end of life — plan a move to **PHP ${php.recommendedVersion}**.`);
      const dockerTag = php.supportStatus === "eol" && php.recommendedVersion ? php.recommendedVersion : target;
      if (dockerTag) lines.push(`- Docker: \`FROM php:${dockerTag}-fpm\` · composer.json: \`"config": { "platform": { "php": "${dockerTag}" } }\``);
    }
  }
  lines.push("");

  lines.push("### Composer packages");
  if (composerSkipped) {
    lines.push(composerSkipped);
  } else if (composer) {
    const fixes = composerFixes(composer.findings);
    if (!fixes.length) {
      lines.push(`No known advisories for ${composer.packageCount} packages (Packagist security advisories).`);
    } else {
      lines.push(`${fixes.length} of ${composer.packageCount} packages have ${composer.findings.length} advisories.`);
      lines.push("");
      lines.push("| Package | Installed | Advisory | Severity | CVE | Fixed in |");
      lines.push("| --- | --- | --- | --- | --- | --- |");
      const seenRows = new Set();
      const unique = composer.findings.filter((f) => {
        const key = `${f.packageName}|${f.title}|${f.cve ?? ""}`;
        if (seenRows.has(key)) return false;
        seenRows.add(key);
        return true;
      });
      const rows = unique.sort((a, b) => (isKev(b.cve, kevIds) - isKev(a.cve, kevIds)) || ((SEVERITY_RANK[String(b.severity).toUpperCase()] ?? 0) - (SEVERITY_RANK[String(a.severity).toUpperCase()] ?? 0)));
      for (const f of rows.slice(0, MAX_ROWS)) {
        const title = f.link ? `[${cell(f.title)}](${f.link})` : cell(f.title);
        const cve = f.cve ? `${f.cve}${isKev(f.cve, kevIds) ? " 🔥 KEV" : ""}` : "—";
        lines.push(`| \`${f.packageName}\` | ${cell(f.installedVersion)} | ${title} | ${cell(f.severity)} | ${cve} | ${cell((f.suggestedFixedVersions ?? []).join(", ") || null)} |`);
      }
      if (rows.length > MAX_ROWS) lines.push(`\n…and ${rows.length - MAX_ROWS} more advisories.`);
      lines.push("");
      lines.push("**Fix (copy-paste):**");
      lines.push("```bash");
      for (const f of fixes) lines.push(f.update);
      lines.push("```");
      const pinned = fixes.filter((f) => f.require);
      if (pinned.length) {
        lines.push("If your version constraint blocks the update:");
        lines.push("```bash");
        for (const f of pinned) lines.push(f.require);
        lines.push("```");
      }
    }
  }
  lines.push("");
  lines.push(`<sub>Checked ${new Date().toISOString().slice(0, 10)} by [PHP Security Checker](${base}/github-action) · data: php.net, NVD, Packagist, CISA KEV. A version check is not a full audit.</sub>`);
  return lines.join("\n");
}

async function getJson(url, init, label) {
  let res;
  try {
    res = await fetch(url, { ...init, signal: AbortSignal.timeout(60_000) });
  } catch (e) {
    throw new Error(`${label}: request failed (${e?.message ?? e}).`);
  }
  let body = null;
  try {
    body = await res.json();
  } catch {
    /* non-JSON */
  }
  if (!res.ok) throw new Error(`${label}: HTTP ${res.status}${body?.error ? ` — ${typeof body.error === "string" ? body.error : body.error.message ?? ""}` : ""}`);
  return body;
}

/**
 * Run the full check. `io` is injectable for tests.
 * @param {{ phpVersion?: string, composerLock?: string, scanComposer?: boolean, failOn?: string, apiBase?: string }} opts
 * @param {{ read?: (p: string) => string | null, runnerPhp?: string | null, kevUrl?: string }} [io]
 */
export async function run(opts, io = {}) {
  const apiBase = (opts.apiBase || DEFAULT_API_BASE).replace(/\/+$/, "");
  const failOn = (opts.failOn || "any").trim().toLowerCase();
  const read = io.read ?? ((p) => (existsSync(p) ? readFileSync(p, "utf8") : null));
  const errors = [];

  let composerJson = null;
  try {
    const raw = read("composer.json");
    composerJson = raw ? JSON.parse(raw) : null;
  } catch {
    composerJson = null;
  }
  let runnerPhp = null;
  if (!opts.phpVersion && io.runnerPhp !== null) {
    try {
      runnerPhp = io.runnerPhp ?? execFileSync("php", ["-r", "echo PHP_VERSION;"], { encoding: "utf8", timeout: 10_000 });
    } catch {
      runnerPhp = null;
    }
  }
  const { version, source } = resolvePhpVersion({ input: opts.phpVersion, phpVersionFile: read(".php-version"), composerJson, runnerPhp });
  if (opts.phpVersion && !version) errors.push(`php-version "${opts.phpVersion}" is not an exact X.Y.Z release.`);

  let php = null;
  if (version) {
    try {
      php = await getJson(`${apiBase}/api/check?v=${encodeURIComponent(version)}`, { headers: { accept: "application/json" } }, "PHP check");
    } catch (e) {
      errors.push(e.message);
    }
  }

  let composer = null;
  let composerSkipped = null;
  if (opts.scanComposer === false) {
    composerSkipped = "Composer scan disabled.";
  } else {
    const lockPath = opts.composerLock || "composer.lock";
    const text = read(lockPath);
    if (text === null) {
      composerSkipped = `No \`${lockPath}\` found — Composer scan skipped.`;
    } else {
      try {
        const packages = parseLockPackages(text);
        if (!packages.length) composerSkipped = `\`${lockPath}\` has no packages.`;
        else {
          composer = await getJson(`${apiBase}/api/composer-advisories`, { method: "POST", headers: { "content-type": "application/json", accept: "application/json" }, body: JSON.stringify({ packages }) }, "Composer advisories");
        }
      } catch (e) {
        errors.push(e.message);
        composerSkipped = `Composer scan failed: ${e.message}`;
      }
    }
  }

  let kevIds = null;
  try {
    const kev = await getJson(io.kevUrl ?? KEV_URL, { headers: { accept: "application/json" } }, "CISA KEV");
    kevIds = new Set((kev?.vulnerabilities ?? []).map((v) => String(v.cveID).toUpperCase()));
  } catch (e) {
    if (failOn === "kev") errors.push(e.message);
  }

  const result = evaluate({ php, composer, kevIds, failOn, errors });
  const markdown = renderComment({ php, phpSource: source, composer, composerSkipped, kevIds, result, failOn, apiBase });
  return { result, markdown, php, composer };
}

/** Create or update the single marker comment on a PR via the GitHub REST API. */
export async function upsertPrComment({ token, repo, prNumber, body, apiUrl = "https://api.github.com" }) {
  const headers = { authorization: `Bearer ${token}`, accept: "application/vnd.github+json", "content-type": "application/json", "x-github-api-version": "2022-11-28" };
  const list = await getJson(`${apiUrl}/repos/${repo}/issues/${prNumber}/comments?per_page=100`, { headers }, "List PR comments");
  const existing = (list ?? []).find((c) => typeof c.body === "string" && c.body.includes(COMMENT_MARKER));
  if (existing) {
    await getJson(`${apiUrl}/repos/${repo}/issues/comments/${existing.id}`, { method: "PATCH", headers, body: JSON.stringify({ body }) }, "Update PR comment");
    return "updated";
  }
  await getJson(`${apiUrl}/repos/${repo}/issues/${prNumber}/comments`, { method: "POST", headers, body: JSON.stringify({ body }) }, "Create PR comment");
  return "created";
}

function input(name, fallback = "") {
  const v = process.env[`PSC_${name.replace(/-/g, "_").toUpperCase()}`];
  return v === undefined || v === "" ? fallback : v.trim();
}

async function main() {
  const failOn = input("fail-on", "any").toLowerCase();
  if (!FAIL_ON.includes(failOn)) {
    console.log(`::error::fail-on must be one of: ${FAIL_ON.join(", ")}`);
    process.exit(1);
  }
  const { result, markdown } = await run({
    phpVersion: input("php-version"),
    composerLock: input("composer-lock", "composer.lock"),
    scanComposer: input("scan-composer", "true") !== "false",
    failOn,
    apiBase: input("api-base", DEFAULT_API_BASE),
  });
  const reportPath = input("report-path", "php-security-report.md");
  writeFileSync(reportPath, markdown);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${markdown}\n`);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `status=${result.failed ? "failed" : "passed"}\nreport-path=${reportPath}\n`);
  console.log(markdown);

  if (input("comment-on-pr", "true") === "true") {
    const token = input("github-token");
    let prNumber = null;
    try {
      const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH ?? "", "utf8"));
      prNumber = event?.pull_request?.number ?? null;
    } catch {
      prNumber = null;
    }
    if (prNumber && token && process.env.GITHUB_REPOSITORY) {
      try {
        const how = await upsertPrComment({ token, repo: process.env.GITHUB_REPOSITORY, prNumber, body: markdown, apiUrl: process.env.GITHUB_API_URL });
        console.log(`PR comment ${how}.`);
      } catch (e) {
        // Fork PRs get a read-only token; the job summary still has the report.
        console.log(`::warning::Could not write the PR comment: ${e.message}`);
      }
    }
  }

  for (const r of result.reasons) console.log(`::error::${r}`);
  if (result.failed) process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.log(`::error::PHP Security Checker failed: ${e?.message ?? e}`);
    process.exit(1);
  });
}
