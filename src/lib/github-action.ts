import { parsePhpVersion } from "@/lib/version";

export type FailOn = "any" | "critical" | "kev" | "eol";

export const FAIL_ON_OPTIONS: { value: FailOn; label: string; hint: string }[] = [
  { value: "any", label: "Any known issue", hint: "EOL PHP, any confirmed PHP CVE, or any Composer advisory" },
  { value: "critical", label: "Critical only", hint: "Confirmed CRITICAL PHP CVEs or critical Composer advisories" },
  { value: "kev", label: "Actively exploited (KEV)", hint: "CVEs listed in the CISA Known Exploited Vulnerabilities catalog" },
  { value: "eol", label: "End of life PHP", hint: "Only when the PHP branch no longer gets security fixes" },
];

export type WorkflowOptions = {
  /** Exact X.Y.Z, or empty for auto-detect. */
  phpVersion: string;
  scanComposer: boolean;
  composerLock?: string;
  failOn: FailOn;
  prComment: boolean;
  siteUrl: string;
};

export const WORKFLOW_PATH = ".github/workflows/php-security-check.yml";
export const COMMENT_MARKER = "<!-- php-security-checker-action -->";

/** github-script body: create or update the single marker comment. Kept separate so tests can run it. */
export const PR_COMMENT_SCRIPT = `const fs = require('fs');
const marker = '${COMMENT_MARKER}';
const path = process.env.REPORT_PATH;
if (!path || !fs.existsSync(path)) { core.warning('No PHP security report was generated.'); return; }
const body = fs.readFileSync(path, 'utf8');
const { owner, repo } = context.repo;
const issue_number = context.issue.number;
try {
  const comments = await github.paginate(github.rest.issues.listComments, { owner, repo, issue_number, per_page: 100 });
  const existing = comments.find((c) => c.body && c.body.includes(marker));
  if (existing) await github.rest.issues.updateComment({ owner, repo, comment_id: existing.id, body });
  else await github.rest.issues.createComment({ owner, repo, issue_number, body });
} catch (e) {
  core.warning('Could not write the PR comment (fork PRs get a read-only token): ' + e.message);
}`;

/** Normalise a user-typed PHP version to X.Y.Z, or null. */
export function normalizeActionPhpVersion(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 32) return null;
  return parsePhpVersion(trimmed)?.raw ?? null;
}

function yamlString(value: string): string {
  return JSON.stringify(value);
}

/** Copy-paste workflow that works in any repo today (downloads check.mjs from the public site). */
export function buildWorkflowYaml(opts: WorkflowOptions): string {
  const site = opts.siteUrl.replace(/\/+$/, "");
  const php = normalizeActionPhpVersion(opts.phpVersion);
  const lock = (opts.composerLock ?? "composer.lock").trim() || "composer.lock";
  const env = [
    php ? `          PSC_PHP_VERSION: ${yamlString(php)}` : `          # PHP version: auto-detected from .php-version, composer.json, or the runner's php`,
    `          PSC_SCAN_COMPOSER: ${yamlString(String(opts.scanComposer))}`,
    ...(opts.scanComposer ? [`          PSC_COMPOSER_LOCK: ${yamlString(lock)}`] : []),
    `          PSC_FAIL_ON: ${opts.failOn}`,
    `          PSC_COMMENT_ON_PR: "false"`,
    `          PSC_API_BASE: ${site}`,
    "          PSC_REPORT_PATH: ${{ runner.temp }}/php-security-report.md",
  ];
  const commentStep = opts.prComment
    ? [
        "      - name: Post or update PR comment",
        "        if: always() && github.event_name == 'pull_request'",
        "        uses: actions/github-script@v7",
        "        env:",
        "          REPORT_PATH: ${{ runner.temp }}/php-security-report.md",
        "        with:",
        "          script: |",
        ...PR_COMMENT_SCRIPT.split("\n").map((line) => `            ${line}`),
      ]
    : [];
  return [
    `# PHP Security Checker — ${site}/github-action`,
    "# Fails CI on a vulnerable/EOL PHP version or vulnerable composer.lock packages.",
    "# Only the PHP version and vendor/package@version pairs are sent; never code or the lock file.",
    "name: PHP Security Check",
    "on:",
    "  pull_request:",
    "  push:",
    "    branches: [main, master]",
    "  schedule:",
    '    - cron: "23 4 * * 1" # weekly: new CVEs land even when code does not change',
    "  workflow_dispatch:",
    "permissions:",
    "  contents: read",
    ...(opts.prComment ? ["  pull-requests: write"] : []),
    "jobs:",
    "  php-security:",
    "    runs-on: ubuntu-latest",
    "    steps:",
    "      - uses: actions/checkout@v4",
    "      - uses: actions/setup-node@v4",
    "        with:",
    "          node-version: 20",
    "      - name: Check PHP version and composer.lock",
    "        id: scan",
    "        continue-on-error: true",
    "        run: |",
    `          curl -fsSL ${site}/github-action/check.mjs -o "$RUNNER_TEMP/psc-check.mjs"`,
    '          node "$RUNNER_TEMP/psc-check.mjs"',
    "        env:",
    ...env,
    ...commentStep,
    "      - name: Fail if the security check failed",
    "        if: steps.scan.outcome == 'failure'",
    '        run: echo "PHP security check failed - see the job summary or PR comment." && exit 1',
    "",
  ].join("\n");
}

export type BadgeSnippets = { imageUrl: string; reportUrl: string; markdown: string; html: string };

/** README badge snippets that link back to the version report. */
export function badgeSnippets(version: string, siteUrl: string): BadgeSnippets | null {
  const v = normalizeActionPhpVersion(version);
  if (!v) return null;
  const site = siteUrl.replace(/\/+$/, "");
  const imageUrl = `${site}/api/badge?v=${v}`;
  const reportUrl = `${site}/check/${v}`;
  return {
    imageUrl,
    reportUrl,
    markdown: `[![PHP security status](${imageUrl})](${reportUrl})`,
    html: `<a href="${reportUrl}"><img src="${imageUrl}" alt="PHP ${v} security status"></a>`,
  };
}
