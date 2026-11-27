# PHP Security Checker — GitHub Action

Fails CI when your PHP version is vulnerable or end of life, or when `composer.lock` has packages with
known security advisories, and posts **one** PR comment (updated on every push) with exact fix commands.

Only the PHP version and `vendor/package@version` pairs are sent to
[php-security-checker.vercel.app](https://php-security-checker.vercel.app) — never code or the raw lock file.

## Use it today (copy-paste workflow)

Generate `.github/workflows/php-security-check.yml` at
<https://php-security-checker.vercel.app/github-action>. It downloads this same `check.mjs`
from the site, so it works in any public or private repo without a Marketplace listing.

## As a reusable action (once published to a public repo)

```yaml
- uses: actions/checkout@v4
- uses: <public-owner>/php-security-checker-action@v1
  with:
    php-version: "8.3.12"   # optional
    fail-on: any            # any | critical | kev | eol
```

The job needs `permissions: pull-requests: write` for the PR comment. On fork PRs the token is read-only,
so the report goes to the job summary instead.

| Input | Default | Notes |
| --- | --- | --- |
| `php-version` | auto | `.php-version` → `config.platform.php` → `require.php` (exact X.Y.Z) → runner `php` |
| `composer-lock` | `composer.lock` | skipped if missing |
| `fail-on` | `any` | `any`, `critical`, `kev` (CISA KEV), `eol` |
| `comment-on-pr` | `true` | idempotent marker `<!-- php-security-checker-action -->` |
| `api-base` | site URL | |
| `github-token` | `github.token` | |

If the API cannot be reached, the check **fails** with "Unable to verify" instead of passing.
