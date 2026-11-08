# PHP Developer Security Toolkit — implementation notes

Date: 2026-11-08. This pass extends the existing Next.js app. It does not replace the design system or the `/api/check` response.

## 1. Existing codebase

Next.js App Router app. The version checker (`/`, `/check/[version]`, `GET /api/check`), CVE explorer, CVE pages, composer.lock scanner, password-hashing check, news page, php.net timeline, shared cache, and `/api/health` were already working. Those flows were kept. New work adds pages and backward-compatible fields (`counts.medium`, `counts.low`, `counts.unrated`).

## 2. Feature status

| Feature | Status |
| --- | --- |
| Homepage hero, checker, tool links, php.net support counts, official headlines | Completed and tested |
| Grouped nav (Version, Vulnerabilities, Tools, News, Docs, API) | Completed and tested |
| Version results: risk line, severity counts, sources, distro note, upgrade commands, JSON report, print view | Completed and tested |
| CVE explorer sort, minimum CVSS, numbered pages | Completed and tested |
| PDF export | Not implemented. JSON download and the browser print view cover the report. A PDF library was left out to avoid a serverless size and time risk. |
| php.ini audit | Completed and tested. Parsed in the browser. The file is not uploaded. |
| PHP extension checker | Completed and tested. Confirmed matches are existing PHP runtime CVEs whose description mentions the extension. Outdated vs current is explicitly not assessed. |
| Laravel checker | Completed and tested. Support table from Laravel release notes. Advisories from Packagist for `laravel/framework`. Env checklist stays in the browser and does not return `APP_KEY`. |
| WordPress core check | Completed and tested. Status strings from `api.wordpress.org/core/stable-check/1.0/` only. No plugin or theme coverage and no CVE list. |
| Security headers checker | Completed and tested. SSRF checks cover loopback, private, link-local, CGNAT, documentation, multicast, IPv6 mapped addresses, obfuscated IPs, credentials, non-80/443 ports, and redirects. The socket connects to the resolved public IP. |
| Docker tag and Dockerfile review | Completed and tested. Tag mapping uses docker-library/php `versions.json`. Dockerfile text is parsed in the browser. Images are not pulled. |
| Status badge `GET /api/badge` | Completed and tested. Counts come from the version check. Invalid versions return an SVG without calling NVD. |
| Uptime workflow | Completed. `.github/workflows/uptime.yml` pings `/api/health` on a schedule for this repository only. It is not executed by CI on pull requests. |
| `/.well-known/security.txt` and `/8.1.12` → `/check/8.1.12` | Completed and tested |
| Symfony checker | Not implemented. Symfony packages can already go through `/composer`. A support-policy parser was not added in this pass. |
| Playwright in CI | Not implemented. Unit tests and the production smoke script cover the new logic. A browser toolchain was not added. |
| Branch CVE scorecard on `/php-versions` | Not implemented. It would load the full NVD dataset onto the timeline page. |
| CLI, hosted webhooks, accounts, email alerts, AI chatbot | Not implemented. No model credentials are configured, and a chatbot that can invent security facts was out of scope. |
| Paid APIs, user accounts, payments | Not implemented. |

## 3. Modified and new files

New libraries: `nav.ts`, `upgrade-commands.ts`, `report.ts`, `risk.ts`, `ini-audit.ts`, `extension-check.ts`, `laravel-support.ts`, `laravel-config.ts`, `wordpress-status.ts`, `ssrf.ts`, `header-audit.ts`, `docker-php.ts`, `docker-library.ts`, `badge.ts`, plus tests.

New routes: `/php-ini`, `/extensions`, `/laravel`, `/wordpress`, `/headers`, `/docker`, `/.well-known/security.txt`, `/api/headers`, `/api/extensions`, `/api/laravel`, `/api/wordpress`, `/api/docker-tag`, `/api/badge`, `src/proxy.ts`.

Updated: homepage, header, footer, version results, CVE explorer, sitemap, llms.txt, OpenAPI, changelog, README, SECURITY.md, about page, FAQ, smoke script, `IMPROVEMENTS.md`.

## 4. New API endpoints

- `POST /api/headers` `{ "url" }`
- `POST /api/extensions` `{ "modules" }` or `{ "names" }`, optional `version`
- `GET /api/laravel?v=11.31.0`
- `GET /api/wordpress?v=6.4.2`
- `GET /api/docker-tag?tag=php:8.3-fpm`
- `GET /api/badge?v=8.3.12` (SVG)

`GET /api/check` is unchanged aside from extra count fields.

## 5. Database changes

None.

## 6. New environment variables

None. Existing `NVD_API_KEY` and `GITHUB_TOKEN` are unchanged.

## 7. External integrations

php.net (already used), NVD (already used), Packagist (already used), Laravel docs on GitHub (`releases.md`), WordPress.org stable-check, docker-library/php `versions.json`. No paid APIs.

## 8. Test results

`npx vitest run`: 35 files, 177 tests passed.

`npx eslint .`: passed.

## 9. Production build

`npx next build`: passed (Next.js 16.4.2). `npm run smoke`: 30 checks passed, including the new pages, the version redirect, the badge 400 SVG, and the existing `/api/check` errors.

During static generation one news source (`mysql-github`) returned HTTP 504. The news loader already keeps the page up when a single feed fails. That source was not changed in this pass.

## 10. Known limitations

- Extension “confirmed” means a PHP runtime CVE description matched the extension and the version check already confirmed that CVE. It is not a separate extension advisory. Outdated is never claimed.
- Laravel support is “unknown” when the official table uses a quarter instead of a day.
- WordPress “insecure” is WordPress.org’s label. This app does not list WordPress CVEs.
- Header checks do not grade a site as secure. Missing Permissions-Policy is informational.
- Docker notes compare a tag with `versions.json`. They are not CVE findings and the image is not scanned.
- Distro backport text warns that a version string can miss backported fixes. It does not mark a distro package patched or vulnerable.
- The rate limiter is still per instance.
- PDF export is not included.

## 11. Remaining tasks

Symfony support-policy checker, Playwright in CI, a branch risk scorecard that can load NVD without slowing `/php-versions`, PDF export if it stays inside the serverless budget, and the later-phase items in the product brief (CLI, webhooks, historical scans, grounded AI). Do not invent those data sources.
