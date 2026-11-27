import type { Metadata } from "next";
import Link from "next/link";
import { BadgeGenerator, WorkflowGenerator } from "@/components/github-action-generator";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "PHP security GitHub Action + README badge",
  description:
    "Free GitHub Actions workflow that fails CI on a vulnerable or end-of-life PHP version or vulnerable composer.lock packages and comments exact fix commands on the PR. Plus a copyable README security badge.",
  alternates: { canonical: new URL("/github-action", SITE_URL).toString() },
};

const EXAMPLE_COMMENT = `## ❌ PHP Security Check failed

Threshold: \`fail-on: any\`
- ❌ PHP 8.1.2 is end of life (no security fixes).
- ❌ PHP 8.1.2 has 44 confirmed known vulnerabilities.
- ❌ 1 Composer package(s) have 8 security advisories.

### PHP runtime
PHP 8.1.2 — Known vulnerabilities confirmed; support: End of life

| CVE            | Severity | CVSS | KEV    | Fixed in |
| CVE-2024-4577  | CRITICAL | 9.8  | 🔥 yes | 8.1.29   |
| CVE-2021-21708 | CRITICAL | 9.8  | —      | 8.1.3    |
…

Fix:
- Upgrade PHP 8.1.2 → 8.1.34 (minimum fixed release).
- PHP 8.1 is end of life — plan a move to PHP 8.6.0.

### Composer packages
| laravel/framework | v10.0.0 | Environment manipulation via query string | high | CVE-2024-52301 | 10.48.23 |
…

Fix (copy-paste):
composer update laravel/framework --with-all-dependencies`;

export default function GithubActionPage() {
  return (
    <main className="mx-auto w-full min-w-0 max-w-4xl px-4 py-10">
      <p className="text-sm font-medium uppercase tracking-[0.18em] text-primary">Tools</p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight">PHP security GitHub Action + README badge</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        Block vulnerable PHP before it ships. This free workflow checks your PHP version and <code>composer.lock</code> on
        every pull request, fails CI on the threshold you pick, and leaves one PR comment (updated on each push) with the
        exact <code>composer update</code> and PHP upgrade commands. No sign-up, no API key, no source code leaves the
        runner: only the PHP version and <code>vendor/package@version</code> pairs are sent.
      </p>

      <h2 className="mt-8 text-xl font-semibold">1. Generate the workflow</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Save it as <code>.github/workflows/php-security-check.yml</code>. It works today in public and private repos. If the
        checker cannot be reached the job fails with &quot;Unable to verify&quot; instead of passing.
      </p>
      <div className="mt-3">
        <WorkflowGenerator siteUrl={SITE_URL} />
      </div>

      <h2 className="mt-10 text-xl font-semibold">2. What the PR comment looks like</h2>
      <pre className="mt-3 overflow-x-auto rounded-lg border bg-muted/40 p-4 text-xs" data-testid="gha-example">
        <code>{EXAMPLE_COMMENT}</code>
      </pre>
      <p className="mt-2 text-sm text-muted-foreground">
        Data comes from php.net, NVD, Packagist security advisories and the CISA KEV catalog, the same sources as the{" "}
        <Link className="underline" href="/">version checker</Link> and the <Link className="underline" href="/composer">composer.lock scanner</Link>.
      </p>

      <h2 className="mt-10 text-xl font-semibold">3. Add a README security badge</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        A live badge that turns red when new CVEs affect your PHP version. It links to the full report so visitors and
        reviewers can see the details.
      </p>
      <div className="mt-3">
        <BadgeGenerator siteUrl={SITE_URL} />
      </div>

      <h2 className="mt-10 text-xl font-semibold">Thresholds</h2>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
        <li><strong>any</strong>: end-of-life PHP, any confirmed PHP CVE, or any Composer advisory.</li>
        <li><strong>critical</strong>: confirmed CRITICAL PHP CVEs or critical Composer advisories.</li>
        <li><strong>kev</strong>: CVEs in the CISA Known Exploited Vulnerabilities catalog (actively exploited).</li>
        <li><strong>eol</strong>: only when the PHP branch no longer gets security fixes.</li>
      </ul>
      <p className="mt-8 text-sm text-muted-foreground">
        A version check is not a full audit: SAPI, extensions and configuration change whether a bug is reachable. See{" "}
        <Link className="underline" href="/how-it-works">how it works</Link>.
      </p>
    </main>
  );
}
