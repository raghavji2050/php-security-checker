# PHP Security Checker

Check an installed PHP release (`MAJOR.MINOR.PATCH`) against known vulnerabilities in the PHP runtime, then see the official support window and a real upgrade path.

The app reads NIST NVD, php.net, and GitHub. It does not ship a database of CVEs, CVSS scores, or fixed versions. A green result means nothing in the data that was checked confirmed a match. It does not mean the installation is secure.

## Architecture

Next.js (App Router, TypeScript, Tailwind) with server-rendered pages and route handlers; no database.

| Layer | Where | Notes |
| --- | --- | --- |
| Pages | `src/app` | Home checker, `/check/[version]` (server-rendered, shareable, in the sitemap), `/vulnerabilities`, `/cves`, `/news`, `/versions`, `/php-versions`, `/composer`, `/php-ini`, `/extensions`, `/laravel`, `/wordpress`, `/headers`, `/docker`, `/password-hashing`, `/how-it-works`, `/about`, branded 404 and error pages. |
| API | `src/app/api` | Route handlers listed below, with CORS and JSON errors (`src/lib/api.ts`). |
| Data loading | `src/lib/dataset.ts`, `nvd.ts`, `php-releases.ts`, `changelog.ts`, `advisories.ts` | Fetches NVD CVE 2.0, php.net releases/branches/ChangeLog and GitHub php/php-src advisories, with retries and a total time budget (`src/lib/http.ts`). |
| Matching | `src/lib/version.ts`, `ranges.ts`, `evaluate.ts`, `check.ts`, `rce.ts`, `upgrade.ts`, `lifecycle.ts` | Numeric version parsing, range evaluation, source agreement, RCE classification and upgrade path. |
| Caching | `src/lib/cache.ts`, `shared-cache.ts` | In-memory + disk cache per instance, plus a gzipped Vercel Runtime Cache tier shared across instances. Stale data is only a labelled fallback. |
| Hardening | `src/lib/rate-limit.ts`, `next.config.ts`, `src/lib/log.ts` | Bounded sliding-window rate limiter, CSP/HSTS/COOP and other headers, structured JSON logs with secret-looking keys redacted. |

### Data sources

| Source | Used for |
| --- | --- |
| [NIST NVD CVE API 2.0](https://nvd.nist.gov/developers/vulnerabilities) | PHP runtime CVEs, CVSS, CPE ranges, CWE |
| [php.net releases and supported versions](https://www.php.net/supported-versions.php) | Release list, branch support dates, latest patches |
| [php.net ChangeLogs](https://www.php.net/ChangeLog-8.php) | CVE/GHSA cross-checks |
| [GitHub Security Advisories for php/php-src](https://github.com/php/php-src/security/advisories) | Affected and patched versions |
| Official project feeds and APIs (php.net releases and news, [Laravel blog](https://laravel.com/feed), [WordPress.org news](https://wordpress.org/news/feed/) and [security](https://wordpress.org/news/category/security/feed/), [GitHub Security Advisories for Composer](https://docs.github.com/en/rest/security-advisories/global-advisories), [Apache HTTP Server vulnerabilities](https://httpd.apache.org/security/vulnerabilities_24.html), [MariaDB.org](https://mariadb.org/feed/), [MySQL GitHub releases](https://github.com/mysql/mysql-server/releases.atom), [CISA KEV](https://www.cisa.gov/known-exploited-vulnerabilities-catalog)) | Headlines and original links on `/news` (articles are not republished) |
| [Laravel release notes](https://github.com/laravel/docs) | Support table on `/laravel`. Non-day values such as “Q3 2027” are not turned into a date. |
| [Packagist security advisories](https://packagist.org/api/security-advisories/) | `laravel/framework` on `/laravel`, and composer.lock packages |
| [WordPress.org stable-check](https://api.wordpress.org/core/stable-check/1.0/) | Core status labels only. No plugin or theme data and no CVE list. |
| [docker-library/php versions.json](https://github.com/docker-library/php/blob/master/versions.json) | Current patch for an official `php` image tag |

Nothing is hand-typed: no CVE, score or fixed version ships in the repo.

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000 and enter a version such as `8.1.12`.

## Test

```bash
npm run lint
npm test          # Vitest unit and end-to-end tests with fake upstreams (no network)
npm run build
npm run smoke     # starts the production build and checks key pages and API responses
SMOKE_BASE_URL=https://php-security-checker.vercel.app npm run smoke   # same checks against a live deployment
npm run test:e2e  # Playwright browser tests of the checker flow (needs `npx playwright install chromium` once)
```

GitHub Actions (`.github/workflows/ci.yml`) runs lint, test, build and smoke on every pull request and push to `master`.

## NVD API key

Request a free key at <https://nvd.nist.gov/developers/request-an-api-key> and set `NVD_API_KEY` in `.env.local`.

Without a key, NVD allows about 5 requests every 30 seconds. The first check pages through the PHP runtime CVE set and can take several minutes. Later checks use the server cache and return quickly. `GITHUB_TOKEN` is optional and only raises the GitHub rate limit for php/php-src advisories.

| Variable | Purpose |
| --- | --- |
| `NVD_API_KEY` | NVD API 2.0 key. Sent as a header, never returned to the browser. |
| `GITHUB_TOKEN` | Optional token for GitHub Security Advisories. |
| `NVD_CACHE_TTL_SECONDS` | How long a successful NVD sync is treated as fresh. Default 6 hours. |
| `PHP_CACHE_TTL_SECONDS` | How long php.net release and changelog data stays fresh. Default 12 hours. |
| `CACHE_DIR` | Optional cache directory. Defaults to the system temp directory. |

If a refresh fails and a previous sync exists, the API serves that copy and marks it stale, with the timestamp of the last success. It does not present stale data as current. If NVD has never succeeded, the check returns **unable to verify**.

## API

Full spec: [`/openapi.json`](https://php-security-checker.vercel.app/openapi.json) (OpenAPI 3.1). All JSON routes allow cross-origin `GET` and are rate limited per IP. No login and no server credentials are needed.

| Route | What it returns |
| --- | --- |
| `GET /api/check?v=8.1.12` | `version`, `supportStatus`, `securityStatus`, `vulnerabilities`, `rceVulnerabilities`, `minimumFixedVersion`, `recommendedVersion`, `checkedAt`, `sources`, `warnings`. The legacy `?version=` parameter still works. |
| `GET /api/php-versions` | Branch, initial release, active support end, security support end, end-of-life status and latest patch, from php.net. |
| `GET /api/vulnerabilities` | The PHP runtime CVE catalog used by the CVE list page. |
| `GET /api/health` | App uptime, shared-cache status and per-source data age. Reads the cache only and never calls upstream. `ok` when NVD data is fresh, otherwise `degraded`. |
| `GET /api/laravel?v=11.31.0` | Laravel support row from the official release notes, plus Packagist advisories for `laravel/framework`. |
| `GET /api/wordpress?v=6.4.2` | WordPress.org stable-check status (`latest`, `outdated`, or `insecure`). No CVE list. |
| `GET /api/docker-tag?tag=php:8.3-fpm` | Official `docker-library/php` versions.json mapping for a php image tag. |
| `POST /api/headers` | Response-header review for one public URL. Private and metadata targets are refused. |
| `POST /api/extensions` | `php -m` names classified against the PHP manual list and NVD description phrases. |
| `GET /api/badge?v=8.3.12` | SVG status badge using the same version check. |

Versions must be `MAJOR.MINOR.PATCH`; `8.1` is rejected. Errors are JSON with a `code`:

| Status | `code` |
| --- | --- |
| 400 | `missing_version`, `invalid_version` |
| 429 | `rate_limited` (with `Retry-After`, plus `X-RateLimit-Limit` / `X-RateLimit-Remaining` on every response) |
| 503 | `data_unavailable` (NVD has never synced and no cached copy exists) |
| 500 | `internal_error` (no internal details are returned) |

Machine-readable site summary for AI assistants: [`/llms.txt`](https://php-security-checker.vercel.app/llms.txt).

## How a match is decided

1. The version is parsed as three numbers. String sorting is not used.
2. NVD CVE 2.0 is queried with `cpe:2.3:a:php:php` and paginated.
3. Records are kept only when they describe the PHP runtime, not another product written in PHP.
4. Affected ranges keep inclusive and exclusive bounds from NVD CPE data and from php.net's affected entries (`versionStartIncluding` / `versionEndExcluding`, `lessThan`, and the same fields on GitHub advisories).
5. A precise range that contains the version is **Confirmed vulnerable** when php.net, NVD, GitHub, and the ChangeLog do not disagree.
6. A one-sided range, or sources that disagree, is **Potentially affected — verification required**.
7. No structured match is not reported as a vulnerability. A wildcard CPE with no bounds is ignored.
8. The fixed release is the bound named by those sources, and it has to exist in the php.net release list. Otherwise the fix is **Not verified**.

Remote code execution and shell risk are classified from CWE-78, CWE-77, CWE-88, and CWE-94, plus the published description. The classification basis is shown on each row. The version cannot prove the bug is reachable: SAPI, operating system, web server, and extensions still matter. The app never runs exploits or shell commands.

Red means at least one confirmed match. Yellow means the branch is unsupported, the data is stale or incomplete, or a match still needs verification. Green means no confirmed or unresolved match and the branch is still on php.net's supported list.

The long-term recommendation is the latest patch on the newest branch php.net still supports. A newer patch on an end-of-life branch can be named as the minimum fix on that branch, and it is not recommended as the place to stay.

## Deploy

### Vercel

Import the repository, set `NVD_API_KEY`, and deploy. The first check calls NVD, so the function timeout needs to allow that download. On a short timeout, retry after the cache has been filled, or run one check from a longer-lived environment first.

### IndexNow ping after a production deploy

After `vercel --prod` and a passing production smoke run, notify IndexNow engines (Bing, Yandex, Seznam, Naver…) about our sitemap URLs:

```sh
npm run indexnow                    # POSTs every https://php-security-checker.vercel.app sitemap URL in one batch
INDEXNOW_DRY_RUN=1 npm run indexnow # print the payload only
```

The key is public by design and lives in `public/b4ffe2722d6124db514be3758af6ea2b.txt` (the key-location file). There is no secret and nothing in CI. The script only sends URLs on our own host, caps the batch at the 10,000-URL spec limit, logs the HTTP status (200/202 = accepted) and always exits 0, so it never breaks a deploy. Needs Node 22.18+ (type stripping).

### Railway

Railway can build the `Dockerfile` or run `npm install`, `npm run build`, and `npm start`. `npm start` listens on `PORT`. Set `NVD_API_KEY` in the service variables. The cache lives on the local disk of the instance and is empty after a new deploy.

## Data limits

- NVD sometimes publishes an open-ended CPE such as "before 8.2.35" for a bug php.net limits to specific branches. Those rows do not override a precise php.net range.
- Some older records only exist as prose. Unparsed prose is skipped instead of being treated as every version.
- GitHub advisories that only say `<8.4.27` are not applied to older branches unless the advisory lists a cap per branch.
- ChangeLog cross-checks use CVE and GHSA identifiers in the PHP 5, 7, and 8 changelogs. A mention is not, by itself, enough to confirm a vulnerability.
- Support dates for current branches come from the php.net pages. Dates the end-of-life page does not publish are filled with the schedule in php.net's `branches.inc`.
