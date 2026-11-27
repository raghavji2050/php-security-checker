import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  COMMENT_MARKER as ACTION_MARKER,
  composerFixes,
  evaluate,
  exactVersion,
  parseLockPackages,
  renderComment,
  resolvePhpVersion,
  run,
  upsertPrComment,
} from "../../github-action/check.mjs";
import { badgeSnippets, buildWorkflowYaml, COMMENT_MARKER, normalizeActionPhpVersion, PR_COMMENT_SCRIPT } from "@/lib/github-action";

const SITE = "https://php-security-checker.vercel.app";

function vuln(cveId: string, severity: string, extra: Record<string, unknown> = {}) {
  return { id: cveId, cveId, verdict: "confirmed", severity, cvssScore: severity === "CRITICAL" ? 9.8 : 7.5, fixedVersion: "8.1.29", ...extra };
}

function phpResult(overrides: Record<string, unknown> = {}) {
  return {
    version: "8.1.2",
    supportStatus: "eol",
    support: { branch: "8.1", label: "End of life", latestPatch: "8.1.34", securitySupportEnd: "2025-12-31" },
    securityStatus: "vulnerable",
    securityStatusLabel: "Known vulnerabilities confirmed",
    vulnerabilities: [vuln("CVE-2024-4577", "CRITICAL"), vuln("CVE-2022-31626", "HIGH"), vuln("CVE-2099-0001", "LOW", { verdict: "potential" })],
    counts: { confirmed: 2, critical: 1, high: 1, medium: 0, low: 0 },
    minimumFixedVersion: "8.1.34",
    recommendedVersion: "8.6.0",
    ...overrides,
  };
}

function finding(pkg: string, severity: string, cve: string | null, fixed: string[]) {
  return {
    packageName: pkg,
    installedVersion: "v10.0.0",
    isDev: false,
    advisoryId: `PKSA-${pkg}-${cve}`,
    title: `Issue in ${pkg}`,
    link: "https://github.com/advisories/GHSA-xxxx",
    cve,
    severity,
    affectedVersions: "<10.48.23",
    suggestedFixedVersions: fixed,
    updateCommand: `composer update ${pkg}`,
  };
}

const composer = {
  packageCount: 40,
  findings: [
    finding("laravel/framework", "high", "CVE-2024-52301", ["10.48.23"]),
    finding("laravel/framework", "medium", "CVE-2025-27515", ["10.48.29"]),
    finding("guzzlehttp/psr7", "critical", "CVE-2023-29197", ["2.4.5"]),
  ],
};

describe("parseLockPackages", () => {
  it("reads packages and packages-dev, lowercases names and dedupes", () => {
    const text = JSON.stringify({
      packages: [{ name: "Laravel/Framework", version: "v10.0.0" }, { name: "laravel/framework", version: "v9.0.0" }, { name: "bad name", version: "1.0" }],
      "packages-dev": [{ name: "phpunit/phpunit", version: "10.5.0" }],
    });
    expect(parseLockPackages(text)).toEqual([
      { name: "laravel/framework", version: "v10.0.0", isDev: false },
      { name: "phpunit/phpunit", version: "10.5.0", isDev: true },
    ]);
  });
  it("rejects invalid JSON and bad shapes", () => {
    expect(() => parseLockPackages("{not json")).toThrow(/valid JSON/);
    expect(() => parseLockPackages(JSON.stringify({ packages: {} }))).toThrow(/must be an array/);
    expect(() => parseLockPackages("[]")).toThrow(/unexpected shape/);
  });
});

describe("resolvePhpVersion", () => {
  it("prefers explicit input, then .php-version, platform, require.php, runner", () => {
    expect(resolvePhpVersion({ input: "8.3.12", phpVersionFile: "8.2.1", composerJson: null, runnerPhp: "8.4.0" })).toEqual({ version: "8.3.12", source: "php-version input" });
    expect(resolvePhpVersion({ input: "", phpVersionFile: "8.2.1\n", composerJson: null, runnerPhp: null }).source).toBe(".php-version");
    expect(resolvePhpVersion({ input: "", phpVersionFile: null, composerJson: { config: { platform: { php: "8.2.20" } }, require: { php: "^8.1" } }, runnerPhp: "8.4.0" })).toEqual({ version: "8.2.20", source: "composer.json config.platform.php" });
    expect(resolvePhpVersion({ input: "", phpVersionFile: null, composerJson: { require: { php: "^8.1" } }, runnerPhp: "8.3.6" })).toEqual({ version: "8.3.6", source: "runner php binary" });
    expect(resolvePhpVersion({ input: "", phpVersionFile: null, composerJson: { require: { php: ">=8.2.4" } }, runnerPhp: null }).version).toBe("8.2.4");
    expect(resolvePhpVersion({ input: "", phpVersionFile: null, composerJson: null, runnerPhp: null })).toEqual({ version: null, source: null });
  });
  it("exactVersion only accepts full releases", () => {
    expect(exactVersion("v8.1.02")).toBe("8.1.2");
    expect(exactVersion("8.1")).toBeNull();
  });
});

describe("evaluate fail-on thresholds", () => {
  const kev = new Set(["CVE-2024-4577"]);
  it("any: fails on EOL, confirmed CVEs and composer advisories", () => {
    const r = evaluate({ php: phpResult(), composer, kevIds: kev, failOn: "any" });
    expect(r.failed).toBe(true);
    expect(r.reasons.join(" ")).toMatch(/end of life/);
    expect(r.reasons.join(" ")).toMatch(/2 confirmed/);
    expect(r.reasons.join(" ")).toMatch(/2 Composer package\(s\) have 3/);
  });
  it("critical: ignores high/medium, fails on CRITICAL", () => {
    const php = phpResult({ supportStatus: "security", vulnerabilities: [vuln("CVE-2022-31626", "HIGH")] });
    expect(evaluate({ php, composer: { packageCount: 1, findings: [] }, kevIds: kev, failOn: "critical" }).failed).toBe(false);
    expect(evaluate({ php, composer, kevIds: kev, failOn: "critical" }).reasons).toEqual(["1 CRITICAL Composer advisories."]);
  });
  it("kev: fails only on actively exploited CVEs and when KEV cannot load", () => {
    const r = evaluate({ php: phpResult(), composer, kevIds: kev, failOn: "kev" });
    expect(r.failed).toBe(true);
    expect(r.phpKev).toEqual(["CVE-2024-4577"]);
    expect(evaluate({ php: phpResult({ vulnerabilities: [vuln("CVE-2022-31626", "HIGH")] }), composer, kevIds: kev, failOn: "kev" }).failed).toBe(false);
    expect(evaluate({ php: null, composer: null, kevIds: null, failOn: "kev" }).reasons[0]).toMatch(/KEV catalog could not be loaded/);
  });
  it("eol: only the support status matters", () => {
    expect(evaluate({ php: phpResult(), composer, kevIds: kev, failOn: "eol" }).reasons).toEqual(["PHP 8.1.2 is end of life (no security fixes)."]);
    expect(evaluate({ php: phpResult({ supportStatus: "active" }), composer, kevIds: kev, failOn: "eol" }).failed).toBe(false);
  });
  it("never passes when data could not be verified", () => {
    expect(evaluate({ php: null, composer: null, kevIds: null, failOn: "eol", errors: ["PHP check: HTTP 503"] }).failed).toBe(true);
    expect(evaluate({ php: phpResult({ securityStatus: "unable_to_verify", supportStatus: "unknown", vulnerabilities: [] }), composer: null, kevIds: null, failOn: "critical" }).failed).toBe(true);
  });
  it("rejects unknown thresholds", () => {
    expect(() => evaluate({ php: null, composer: null, kevIds: null, failOn: "high" })).toThrow(/fail-on/);
  });
});

describe("fix commands and PR comment", () => {
  it("groups composer fixes per package with the highest fixed version", () => {
    const fixes = composerFixes(composer.findings);
    expect(fixes.map((f: { update: string }) => f.update)).toEqual([
      "composer update guzzlehttp/psr7 --with-all-dependencies",
      "composer update laravel/framework --with-all-dependencies",
    ]);
    expect(fixes[1].require).toBe('composer require "laravel/framework:^10.48.29" --with-all-dependencies');
  });
  it("renders marker, KEV flag, PHP upgrade target and copy-paste commands", () => {
    const kevIds = new Set(["CVE-2024-4577"]);
    const php = phpResult();
    const result = evaluate({ php, composer, kevIds, failOn: "any" });
    const md = renderComment({ php, phpSource: ".php-version", composer, kevIds, result, failOn: "any", apiBase: SITE });
    expect(md.startsWith(ACTION_MARKER)).toBe(true);
    expect(ACTION_MARKER).toBe(COMMENT_MARKER);
    expect(md).toContain("## ❌ PHP Security Check failed");
    expect(md).toContain(`| [CVE-2024-4577](${SITE}/cve/CVE-2024-4577) | CRITICAL | 9.8 | 🔥 yes | 8.1.29 |`);
    expect(md).not.toContain("CVE-2099-0001");
    expect(md).toContain("Upgrade PHP 8.1.2 → **8.1.34**");
    expect(md).toContain("plan a move to **PHP 8.6.0**");
    expect(md).toContain("```bash\ncomposer update guzzlehttp/psr7 --with-all-dependencies\ncomposer update laravel/framework --with-all-dependencies\n```");
    expect(md).toContain(`${SITE}/github-action`);
  });
  it("renders a passing comment and skipped composer scan", () => {
    const php = phpResult({ supportStatus: "active", securityStatus: "no_known_issues", securityStatusLabel: "No known issues", vulnerabilities: [], counts: { confirmed: 0 } });
    const result = evaluate({ php, composer: null, kevIds: new Set(), failOn: "any" });
    const md = renderComment({ php, phpSource: "php-version input", composer: null, composerSkipped: "No `composer.lock` found — Composer scan skipped.", kevIds: new Set(), result });
    expect(md).toContain("## ✅ PHP Security Check passed");
    expect(md).toContain("Composer scan skipped");
    expect(md).not.toContain("**Fix:**");
  });
});

describe("run (mocked network)", () => {
  it("calls /api/check and /api/composer-advisories and fails on API errors", async () => {
    const calls: string[] = [];
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push(`${init?.method ?? "GET"} ${url}`);
      if (url.includes("/api/check")) return Response.json(phpResult());
      if (url.includes("/api/composer-advisories")) {
        expect(JSON.parse(String(init?.body)).packages).toEqual([{ name: "laravel/framework", version: "v10.0.0", isDev: false }]);
        return Response.json({ error: "Packagist down" }, { status: 503 });
      }
      return Response.json({ vulnerabilities: [{ cveID: "CVE-2024-4577" }] });
    });
    vi.stubGlobal("fetch", fetchMock);
    try {
      const files: Record<string, string> = { "composer.lock": JSON.stringify({ packages: [{ name: "laravel/framework", version: "v10.0.0" }] }) };
      const out = await run({ phpVersion: "8.1.2", failOn: "eol", apiBase: `${SITE}/` }, { read: (p: string) => files[p] ?? null, runnerPhp: null, kevUrl: "https://kev.test/kev.json" });
      expect(calls).toEqual([`GET ${SITE}/api/check?v=8.1.2`, `POST ${SITE}/api/composer-advisories`, "GET https://kev.test/kev.json"]);
      expect(out.result.failed).toBe(true);
      expect(out.result.reasons.join(" ")).toMatch(/Unable to verify: Composer advisories: HTTP 503 — Packagist down/);
      expect(out.markdown).toContain("🔥 yes");
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it("upserts one marker comment (update when present)", async () => {
    const seen: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      seen.push(`${init?.method ?? "GET"} ${url}`);
      if (!init?.method) return Response.json([{ id: 1, body: "hi" }, { id: 7, body: `${COMMENT_MARKER}\nold` }]);
      return Response.json({});
    }));
    try {
      expect(await upsertPrComment({ token: "t", repo: "o/r", prNumber: 5, body: "new" })).toBe("updated");
      expect(seen[1]).toBe("PATCH https://api.github.com/repos/o/r/issues/comments/7");
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("workflow + badge generators", () => {
  it("builds a pinned-version workflow with PR comment step", () => {
    const yaml = buildWorkflowYaml({ phpVersion: " 8.3.12 ", scanComposer: true, failOn: "kev", prComment: true, siteUrl: `${SITE}/` });
    expect(yaml).toContain('PSC_PHP_VERSION: "8.3.12"');
    expect(yaml).toContain("PSC_FAIL_ON: kev");
    expect(yaml).toContain('PSC_COMPOSER_LOCK: "composer.lock"');
    expect(yaml).toContain(`curl -fsSL ${SITE}/github-action/check.mjs`);
    expect(yaml).toContain("uses: actions/github-script@v7");
    expect(yaml).toContain("  pull-requests: write");
    expect(yaml).toContain("continue-on-error: true");
    expect(yaml).toContain("if: steps.scan.outcome == 'failure'");
    expect(yaml).not.toMatch(/\t/);
  });
  it("auto-detect omits the version; no comment step or write permission when disabled", () => {
    const yaml = buildWorkflowYaml({ phpVersion: "", scanComposer: false, failOn: "any", prComment: false, siteUrl: SITE });
    expect(yaml).not.toContain("PSC_PHP_VERSION:");
    expect(yaml).toContain("auto-detected");
    expect(yaml).toContain('PSC_SCAN_COMPOSER: "false"');
    expect(yaml).not.toContain("PSC_COMPOSER_LOCK");
    expect(yaml).not.toContain("github-script");
    expect(yaml).not.toContain("pull-requests: write");
  });
  it("the github-script body creates, then updates, the marker comment", async () => {
    const fn = new Function("require", "github", "context", "core", "process", `return (async () => {${PR_COMMENT_SCRIPT}})();`);
    const store: { id: number; body: string }[] = [];
    const github = {
      paginate: async () => store,
      rest: {
        issues: {
          listComments: () => undefined,
          createComment: async ({ body }: { body: string }) => store.push({ id: store.length + 1, body }),
          updateComment: async ({ comment_id, body }: { comment_id: number; body: string }) => {
            store.find((c) => c.id === comment_id)!.body = body;
          },
        },
      },
    };
    const files: Record<string, string> = { "/tmp/r.md": `${COMMENT_MARKER}\nfirst` };
    const fakeRequire = () => ({ existsSync: (p: string) => p in files, readFileSync: (p: string) => files[p] });
    const context = { repo: { owner: "o", repo: "r" }, issue: { number: 3 } };
    const core = { warning: vi.fn() };
    const proc = { env: { REPORT_PATH: "/tmp/r.md" } };
    await fn(fakeRequire, github, context, core, proc);
    files["/tmp/r.md"] = `${COMMENT_MARKER}\nsecond`;
    await fn(fakeRequire, github, context, core, proc);
    expect(store).toEqual([{ id: 1, body: `${COMMENT_MARKER}\nsecond` }]);
    expect(core.warning).not.toHaveBeenCalled();
  });
  it("badge snippets link back to the version report", () => {
    expect(badgeSnippets("8.3.12", `${SITE}/`)).toEqual({
      imageUrl: `${SITE}/api/badge?v=8.3.12`,
      reportUrl: `${SITE}/check/8.3.12`,
      markdown: `[![PHP security status](${SITE}/api/badge?v=8.3.12)](${SITE}/check/8.3.12)`,
      html: `<a href="${SITE}/check/8.3.12"><img src="${SITE}/api/badge?v=8.3.12" alt="PHP 8.3.12 security status"></a>`,
    });
    expect(badgeSnippets("8.3", SITE)).toBeNull();
    expect(normalizeActionPhpVersion("x".repeat(40))).toBeNull();
  });
  it("the downloadable public/github-action/check.mjs matches github-action/check.mjs", () => {
    const root = path.resolve(__dirname, "../..");
    expect(readFileSync(path.join(root, "public/github-action/check.mjs"), "utf8")).toBe(readFileSync(path.join(root, "github-action/check.mjs"), "utf8"));
  });
});
