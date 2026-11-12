# Improvement log

One small improvement per day. Each entry lists the area so topics rotate and nothing repeats.

| Date | Area | Change | PR |
| --- | --- | --- | --- |
| 2026-10-25 | Tests | Unit tests for the NVD record parser (`src/lib/nvd-parse.ts`): rejected/irrelevant records, CPE ranges, negated nodes, AND-config prerequisites, php.net CNA data, CVSS preference, reference ranking. Synthetic fixtures only. | improve/2026-10-25 |
| 2026-10-25 | CI | GitHub Actions workflow (`.github/workflows/ci.yml`): npm ci, lint, test, build on every PR and push to master. | #3 |
| 2026-10-25 | UX / SEO | Raghav's 7 improvements: short shared footer note (full disclaimer on About), `/vulnerabilities` CVE list with search + severity filter, `/how-it-works` explainer with server-rendered source/outage FAQ, homepage H1 + tagline, input hint and friendly format error, shareable `/?v=` links with Copy link + Download JSON, loading/error/Retry states and "Data last updated", per-page titles/descriptions, sitemap + robots, mobile overflow fix. | improve/2026-10-25-ux |
| 2026-10-26 | Accessibility / SEO | Priority (a): `/how-it-works` Matching, RCE and Status colors sections are now plain server-rendered sections with headings and an in-page anchor nav (readable without JavaScript, all text in the HTML). Removed the unused accordion component and `@radix-ui/react-accordion`. | improve/2026-10-26 |
| 2026-10-27 | SEO | Priority (b): server-rendered result pages at `/check/[version]` (e.g. `/check/8.1.12`) with the full report in the HTML, a unique title, meta description and canonical URL per version, cached for hours via `use cache`. Sitemap now lists `/check/` pages for the latest patch of every PHP branch (php.net data, refreshed daily). Invalid versions get a not-found page with noindex. | improve/2026-10-27 |

## Production plan (7 days, started 2026-10-28)

| Day | Date | Change | PR |
| --- | --- | --- | --- |
| 1 | 2026-10-28 | Public JSON API `GET /api/check?v=X.Y.Z` (legacy `?version=` still works): strict MAJOR.MINOR.PATCH validation, JSON errors with `code` (`missing_version`, `invalid_version`, `rate_limited`, `data_unavailable`, `internal_error`) and matching status codes (400/429/503/500), CORS for GET plus OPTIONS preflight. OpenAPI 3.1 spec at `/openapi.json`. Route + spec tests in `src/lib/api.test.ts`. | improve/2026-10-28 |
| 2 | 2026-10-29 | `/llms.txt` (site summary, `/check/{version}`, `/api/check`, `/openapi.json`, quick answers). "Quick answers" section on `/how-it-works` with matching FAQPage JSON-LD (shared text in `src/lib/faq.ts`). Upstream calls now have a total time budget (`deadlineMs`, default 45s; NVD 90s, ChangeLog 75s): no new attempt or Retry-After wait starts past it, so a slow php.net/NVD falls back to the cached copy instead of hanging the page. Tests in `src/lib/http.test.ts` and `src/lib/llms.test.ts`. | improve/2026-10-29 |
| 3 | 2026-10-30 | Security hardening. Added HSTS (2 years, includeSubDomains), Cross-Origin-Opener-Policy and X-Permitted-Cross-Domain-Policies next to the existing CSP (`frame-ancestors 'none'`), nosniff, Referrer-Policy and Permissions-Policy. The in-memory sliding-window rate limiter is capped at 5000 tracked addresses with pruning, so a flood can't grow memory, and it prefers Vercel's `x-vercel-forwarded-for` client IP. `/api/check` now returns `X-RateLimit-Limit`/`-Remaining` (exposed via CORS) and 429 + Retry-After. `/check/%E0`-style malformed URLs now return not-found instead of a 500. Tests in `src/lib/rate-limit.test.ts` and `src/lib/security-headers.test.ts`. | improve/2026-10-30 |
| 4 | 2026-10-31 | Testing. New `src/lib/check.test.ts` runs the real `checkVersion` (dataset loading, cache, version matching, CVE evaluation) against fake upstream loaders: vulnerable vs fixed version, NVD down with no cache (DataUnavailableError), optional sources failing (warnings), and falling back to the cached NVD copy. `api.test.ts` adds the generic 500 path (no internal details leaked) and rate-limit headers. New `scripts/smoke.mjs` (`npm run smoke`) starts the production build and checks key pages, `/llms.txt`, `/openapi.json`, sitemap, API 400s and the 404 page; CI now runs it after build. | improve/2026-10-31 |
| 5 | 2026-11-01 | Performance and caching. New shared cache tier (`src/lib/shared-cache.ts`) on Vercel Runtime Cache: upstream datasets (NVD, php.net branches, ChangeLog, GitHub advisories) are gzipped (NVD 4.7 MB JSON to ~250 KB) and shared across serverless instances, so a cold instance reuses data another instance fetched instead of refetching NVD (the 18-27s cold load). Stale shared data is still a fallback when an upstream fails; cache errors never break a check; off outside Vercel. New `GET /api/health` (no-store, CORS) reports app uptime, shared-cache status and per-source retrievedAt/age/fresh from cache only (never calls upstream); `ok` when NVD is fresh, else `degraded`. Added to OpenAPI, llms.txt and the smoke test. Tests in `src/lib/shared-cache.test.ts`. | improve/2026-11-01 |
| 6 | 2026-11-02 | Reliability and UX. Branded 404 page (`src/app/not-found.tsx`, noindex, links to the checker and CVE list, version-format hint), `error.tsx` with Try again (shows only the opaque digest, no internal details) and a last-resort `global-error.tsx`. Structured JSON server logging (`src/lib/log.ts`): one line per event with ts/level/event, secret-looking keys redacted, errors reduced to name+message (no stack), long strings trimmed; all API/page/dataset/cache logs use it. Accessibility: "Skip to content" link with focusable main region, decorative theme icons hidden from screen readers, `/check/[version]` loading skeleton is `aria-busy` with a screen-reader status. Smoke test checks the 404 text and the skip link. Tests in `src/lib/log.test.ts`. | improve/2026-11-02 |
| 7 | 2026-11-03 | Docs and review. README gained Architecture (layers and files), Data sources, a full API table including `/api/vulnerabilities` and `/api/health`, the JSON error-code table, and a Test section (lint, Vitest, build, smoke, smoke against production, CI). New `SECURITY.md` (private reporting, scope, how the app protects itself) and `CHANGELOG.md` (all PRs #1 to #14). Production-readiness checklist below. | improve/2026-11-03 |

### Production-readiness checklist (2026-11-03)
- Done: public API with OpenAPI spec and JSON errors; security headers, input validation, bounded rate limiting; unit, end-to-end and smoke tests in CI; shared cache and /api/health; 404/error pages, structured logs without secrets, accessibility basics; README, SECURITY.md, CHANGELOG.
- Remaining gaps: the rate limiter is per instance (in memory), not global; the very first /check after a new deploy can still take about 15s while caches warm; no uptime alerting on /api/health yet; no end-to-end browser (Playwright) tests in CI.

## New features (approved 31 Oct, 3 Nov and 4 Nov 2026)

| Feature | Date | Change | PR |
| --- | --- | --- | --- |
| 1/13 | 2026-11-04 | `/php-versions` support timeline: server-rendered (cached hours) chart with one bar per PHP branch (active support in green, security-only in orange, faded once end of life, a line for today), summary cards per support state, branch cards with release / active / security dates, status badge and latest patch linking to `/check/{version}`. Data only from php.net via the existing branch catalog. Geometry in `src/lib/timeline.ts` with tests. Nav, sitemap, llms.txt and smoke test updated; `/versions` table links to it. | improve/2026-11-04 |
| 2/13 | 2026-11-05 | `/cves` CVE explorer: server-rendered list of every PHP interpreter CVE from the NVD CVE API 2.0 (`virtualMatchString=cpe:2.3:a:php:php:*:*:*:*:*:*:*:*`, rejected excluded, paged politely through the existing NVD loader and shared cache; page cached hours). Search (ID/description) and filters for year, severity (CVSS v3.x base severity, else v2, version labelled; v4-only records fall back to v4, no score = Unrated) and affected branch (derived only from NVD configuration ranges, otherwise "unknown") via URL params, so it works without JavaScript; 50 per page. CVEs-per-year bar chart and severity breakdown in the site's own CSS (bars are clickable filters). Each CVE links to its NVD page and to `/check/{last affected version}` when NVD gives an exact bound. NVD v2 severity is now read from the metric (it was missing). Logic in `src/lib/cve-explorer.ts` with synthetic-fixture tests. Nav, sitemap, llms.txt and smoke test updated. | improve/2026-11-05 |
| 3/13 | 2026-11-06 | `/composer` composer.lock scanner: paste or upload a lock file (client-side JSON parse only; 5 MB cap; never stored or executed). Only the name@version list is POSTed to `/api/composer-advisories`, which queries the official Packagist security-advisories API (batched, 1h cache), matches installed versions against `affectedVersions`, and returns advisory title/link, CVE, severity, suggested fixed versions (exclusive upper bounds) and copy-paste `composer update vendor/pkg` commands. Clean locks get a clear success message. Constraint matcher + lock parser + API tests. Nav, sitemap, llms.txt, OpenAPI and smoke updated. | improve/2026-11-06 |
| 4/13 | 2026-11-07 | `/cve/{CVE-ID}` "Am I affected?" pages for any PHP CVE in the NVD dataset (ID validated, unknown IDs 404). Branch-wise fixed-version table built only from precise php.net ranges when available, else NVD CPE ranges; "Fixed in" shown only for exact exclusive upper bounds, never guessed. GET form `?v=X.Y.Z` answers affected / not in any listed range / unknown, linking to `/check` pages. FAQPage JSON-LD generated from the same data. Featured CVEs verified on the NVD API 2026-11-07 (CVE-2024-4577, CVE-2024-8926, CVE-2024-5458, CVE-2024-8927, CVE-2024-2756, CVE-2019-11043, CVE-2012-1823) are in the sitemap; "PHP2Shell" could not be matched to an official CVE ID, so it was not added. `/cves` items link to their page. Logic in `src/lib/cve-page.ts` with tests; llms.txt and smoke updated. | improve/2026-11-07 |
| 5/13 | 2026-11-08 | `/news` daily security news: server-rendered headlines and links from official feeds and APIs (php.net releases and news, Laravel blog, WordPress.org news and security, GitHub Security Advisories for Composer, Apache HTTP Server vulnerabilities page, MariaDB.org, MySQL GitHub releases, and CISA KEV filtered to LAMP-related products). Dates shown in IST; optional `?source=` filter works without JavaScript; per-source 1h cache with stale fallback; one source failing does not take down the page. Titles and links only — feed/HTML bodies are not republished. Logic in `src/lib/news.ts` and `src/lib/rss.ts` with synthetic-fixture tests. Nav, sitemap, llms.txt and smoke updated. | improve/2026-11-08 |

## Toolkit pass (2026-11-08)

Shipped in the PHP Developer Security Toolkit pull request. The daily builder should not recreate these:

| Item | Status |
| --- | --- |
| 6/13 free status badge | Done. `GET /api/badge?v=8.3.12` returns an SVG from the real version check. |
| 7/13 uptime GitHub Action | Done. `.github/workflows/uptime.yml` pings `/api/health` and opens one issue when the status is not `ok`. It runs only on this repository. |
| 10/13 fuller homepage | Done. Hero, tool links, php.net support counts, and official headlines. No invented statistics. |
| 11/13 Docker tag input | Done. `/docker` and `GET /api/docker-tag`, using docker-library/php `versions.json`. |
| 12/13 distro backport note | Done. Shown on version results. It does not claim a distro package is patched. |
| 13/13 copy-paste upgrade commands | Done. Homebrew, Docker tag, ondrej/php PPA (labelled as a community archive), and a Composer platform note that does not upgrade PHP. |
| `/.well-known/security.txt` | Done. |
| Short version redirects | Done. `/8.1.12` redirects to `/check/8.1.12`. |
| php.ini audit, extension checker, Laravel checker, WordPress core status, SSRF-safe headers checker | Done. See IMPLEMENTATION-NOTES.md. |

Still open for a later day:

- ~~8/13 Symfony version checker~~ Done 2026-11-09 (see below).
- ~~9/13 Playwright in CI.~~ Done 2026-11-10 (see below).
- Branch risk scorecard on `/php-versions` (would load the full NVD set onto the timeline).
- PDF reports. JSON download and print view shipped instead.

Next new feature: Playwright (9/13). Do not rebuild the badge, homepage, Docker tag tool, upgrade commands, or distro note.

## 2026-11-09 — Feature 8/13: Symfony version checker
- New `/symfony` form and server-rendered `/symfony/check/{version}` reports, plus `GET /api/symfony?v=7.4.10` (rate limited, CORS, JSON errors).
- Support state uses symfony.com's own data only: `releases.json` (maintained/security lists, min PHP, current stable/LTS) and `releases/{branch}.json` (`is_eomed`/`is_eoled` flags, month-level end of maintenance/end of life, latest patch). Days are never guessed; unknown branches say so.
- Advisories: Packagist security advisories for `symfony/symfony`, with CVE/advisory links and `composer update "symfony/*" --with-all-dependencies`. Component-only installs are pointed to `/composer`.
- Nav, sitemap, llms.txt, OpenAPI and smoke checks updated. New unit tests in `src/lib/symfony-support.test.ts`.

## 2026-11-10 — Feature 9/13: Playwright browser tests in CI
- `@playwright/test` with `playwright.config.ts` and `e2e/checker.spec.ts`: home page form, branch-only input shows the validation error, a full version updates the URL and shows a result (or the friendly "Unable to verify" panel if an upstream is down), `/check/8.1.12` heading, invalid `/check/...` not-found page, real 404 for unknown routes.
- Tests assert the flow, not live CVE counts, so php.net/NVD changes do not make CI flaky. Chromium headless shell only, 1 retry on CI, trace kept on failure and uploaded as an artifact.
- CI runs `npm run test:e2e` after the smoke step. Run locally with `npm run build && npm run test:e2e`, or against a deployment with `E2E_BASE_URL=https://php-security-checker.vercel.app npm run test:e2e`.
- Next: oldest item in SUGGESTIONS.md "Queued (auto-approved)" that is not done yet (branch risk scorecard on `/php-versions`).

## 2026-11-11 — Branch risk scorecard on `/php-versions` (queued idea)
- New `src/lib/scorecard.ts` (with tests) builds one row per recent branch: official support state, days of security support left, NVD CVEs mapped to the branch, how many are critical or high, latest patch, and a risk label.
- The risk label uses only the php.net support state (active = lower risk, security-only = plan upgrade, EOL = upgrade now). CVE counts are context and link to `/cves?branch=X.Y`; they are reported CVEs, not "open" ones. If NVD is down the counts show as unavailable, never zero.
- Page shows a suggested upgrade target (newest actively supported branch). Smoke check and a Playwright e2e test added.
- Next: oldest undone queued idea, the CISA KEV "exploited in the wild" badge on `/cve/{id}` and `/cves` (security.txt and short redirects were already shipped in PR #22).

## 2026-11-12 — CISA KEV "exploited in the wild" badge on `/cve/{id}` and `/cves` (queued idea)
- New `src/lib/kev.ts` (with tests) reads the official CISA KEV JSON feed, sharing the raw-feed cache key with `/news`, and indexes entries by CVE ID (date added, due date, CISA's ransomware-use value).
- `/cve/{id}` shows a red "Exploited in the wild (CISA KEV)" badge and a callout with the date added (and known ransomware use when CISA says "Known"). When not listed, it says "not in the catalog as of the last sync", never "safe". If the feed is down, nothing is shown rather than a false "not listed".
- `/cves` list items get the same badge, plus a line saying how many of the matching CVEs are in KEV. Playwright e2e test added for `/cve/CVE-2019-11043`.
- Next: oldest undone queued idea, EPSS exploit-probability score on CVE pages (FIRST.org free API).

## 2026-11-12 — EPSS exploit probability and Related CVEs on `/cve/{id}` (queued ideas)
- New `src/lib/epss.ts` (with tests) reads the free FIRST.org EPSS API per CVE (cached 12 h, stale allowed). The page shows the probability, the percentile ("top N%") and the score date. If FIRST is down it says "Unavailable"; if FIRST has no score it says so. No number is ever guessed.
- New `src/lib/related-cves.ts` (with tests) lists up to 6 other PHP CVEs that NVD ranges put on the same branches, closest first (shared branches, same year, CVSS). Better internal linking.
- Playwright e2e test added for both on `/cve/CVE-2019-11043`.

## 2026-11-12 — composer.json `require.php` constraint checker (queued idea)
- New `/composer/php-constraint` page: paste `^8.1`, `>=8.1 <8.4`, `~8.2.0 || ^8.4` or a whole `"php": "..."` line. It lists which php.net branches the constraint allows, flags end-of-life branches it still allows (with a suggested `^X.Y` floor from the oldest supported branch), and notes when it also allows unreleased future branches.
- New `src/lib/php-constraint.ts` (with tests) handles Composer `^ ~ * x`, comparison operators, hyphen ranges, `,`/space AND and `|`/`||` OR. Linked from `/composer`, nav, sitemap and llms.txt. Smoke check and Playwright e2e test added.

## 2026-11-12 — "Copy as Markdown" on version, composer and Symfony reports + Symfony badge (queued ideas)
- New `src/lib/markdown-report.ts` (with tests) builds GitHub-flavoured Markdown: status summary, a CVE/advisory table with fixed versions, update commands and a link back to the full report. Only confirmed findings go in the version table. Missing data is written as "Unavailable", never 0.
- Shared `CopyMarkdownButton` added to the PHP version report, the composer.lock report and `/symfony/check/{version}`.
- New `/api/symfony/badge?v=7.4.10` SVG (reuses the PHP badge drawing code). It says "unable to verify" when Packagist fails and never shows a clean badge then. The Symfony report has a "Share this report" card with the badge preview and its README Markdown.
- Smoke check for the badge's 400 path; Playwright e2e tests for both Markdown buttons and the badge card.

## 2026-11-12 — Featured `/cve` pages for CVE-2026-109618 and CVE-2026-109619 (PHP2Shell) (queued idea)
- Both IDs re-checked in the NVD CVE API on 12 Nov 2026 (published 21 Oct 2026, php:php CPE ranges) and added to `FEATURED_CVES`, so they are in the sitemap and in a new "Featured" line on `/cves`.
- New `src/lib/featured-advisories.ts` (with tests) adds short notes from the official php.net 21 Oct 2026 advisory: php.net's title, fixed releases (8.5.12 / 8.4.27 / 8.3.36 / 8.2.35), the interim mitigations in plain words, and the php-src GHSA links. "PHP2Shell" is labelled as a press nickname, not an official name. Branch fixed versions on the page still come from live NVD/php.net ranges.
- Smoke check (sitemap lists the page) and Playwright e2e test added.

## 2026-11-12 — "Is my PHP patched?" `php -v` parser (queued idea)
- New `/php-v` page: paste the full `php -v` output. It is parsed only in the browser (`src/lib/php-v.ts`, with tests) and shows the exact version, package suffix with a distro hint (Ubuntu, Debian, deb.sury.org, RHEL family, Amazon Linux, Fedora, Alpine), SAPI, ZTS/NTS, build date, OPcache/Xdebug, and pre-release builds.
- When there is a distro suffix it explains that distros backport fixes without changing the version and asks the user to confirm with their vendor; it never claims a backport exists. Links to `/check/{version}`.
- Added to nav, sitemap and llms.txt. Smoke check and Playwright e2e test added.

## 2026-11-12 — Per-branch Atom feeds of new PHP CVEs + ICS support-dates calendar (queued ideas)
- New `/feeds/all.xml` and `/feeds/{MAJOR.MINOR}.xml` (e.g. `/feeds/8.3.xml`): Atom 1.0 feeds of the 50 newest PHP CVEs from existing NVD data, each entry linking to `/cve/{id}`. Unknown slugs return 404; if NVD data is unavailable the feed returns 503 instead of an empty or fake feed. Builder in `src/lib/cve-feed.ts` (with tests).
- New `/php-versions/calendar.ics`: iCalendar all-day events for every upcoming active-support and security-support end date from php.net (e.g. PHP 8.2 end of life on 31 Dec 2026). Builder in `src/lib/ics.ts` (RFC 5545 escaping and line folding, with tests).
- Subscribe links on `/php-versions` and `/cves`, `<link rel="alternate">` for the feed, llms.txt entries. Smoke check (404 path) and Playwright e2e test added.

## Ideas queue (not done yet)

- ~~CI linting: GitHub Actions for lint, typecheck, test, build~~ Done 2026-10-25 (Raghav added `ci.yml`).
- Error handling and timeouts, caching, UI/accessibility, OG images, README, composer.lock/package.json advisory feature.

## 2026-10-25 — Fix CI lint (react-hooks/set-state-in-effect)
- Recent-history list in `checker.tsx` now reads localStorage via `useSyncExternalStore` (server snapshot = empty list, so no hydration mismatch; syncs across tabs via `storage` events) instead of `setState` inside `useEffect`.
- `npm ci`, lint, tests and build pass locally; GitHub Actions CI green on the PR.
