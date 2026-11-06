# Suggestions

## 2026-10-31 — Competitor research ideas
- ~~**composer.lock upload/paste scanner (client-side parse, Packagist advisories API)**~~ Done 2026-11-06 as Feature 3/13 (`/composer`).
- **Event pages + "am I affected" for big PHP CVEs (e.g. PHP2Shell CVE-2026-109618/109619)** — single-purpose checkers (php2shell.live, phpatch.com, Trend Micro) are getting traffic right now; a permanent per-CVE page with branch/fixed-version table captures that search.
- **Free embeddable badge + GitHub Action / CI endpoint** (`/api/check` returns pass/fail exit for a PHP version) — distribution + backlinks; competitors are either CLI-only or paid.

## 2026-10-31 — Evening update ideas
- **Laravel framework version checker (`/laravel/check/[version]`, GitHub Security Advisories for laravel/framework)** — Laravel devs are the core audience and few free tools answer "is my Laravel version vulnerable?".
- **RSS/Atom feed of new PHP CVEs (`/feed.xml`)** — zero-cost way for devs and aggregators to follow updates, bringing repeat visits and backlinks.
- **"Need help upgrading?" CTA on vulnerable results, linking to Raghav's PHP security/upgrade service** — turns high-intent visitors into freelance leads without ads.

## 2026-11-01 — Weekly market check
Sources checked 1 Nov 2026 (IST). No code changed.

**New in the market (all launched in the PHP2Shell wave, 21–27 Oct 2026):**
- PatchMyPHP, a free no-account PHP2Shell checker at patchmyphp.com (press release, 23 Oct): https://www.usatoday.com/press-release/story/52316/patchmyphp-launches-a-free-php-vulnerability-checker-that-shows-website-owners-in-under-a-minute-whether-the-october-2026-php-flaw-cve-2026-109618-leaves-them-exposed/
- Astra Security: a public-URL PHP2Shell Checker plus open-source php2shell-triage, which inspects running worker binaries (23 Oct): https://www.prnewswire.com/news-releases/astra-security-releases-free-tools-to-help-organizations-find-and-fix-php2shell-vulnerabilities-302918207.html
- Penta Security / Cloudbric Security Check: URL-based check plus a server script, in English, Korean and Japanese (27 Oct): https://www.pentasecurity.com/press-releases/penta-security-launches-website-security-check-and-response-rules-for-php2shell-vulnerabilities/
- Pentest-Tools free PHP2Shell scanner with active detection (works when the version is hidden) and a PDF report: https://pentest-tools.com/network-vulnerability-scanning/php2shell-scanner
- openai/php2shell-checker on GitHub: an open-source CLI that reads X-Powered-By/Server headers, with OK / POTENTIALLY VULNERABLE / UNKNOWN exit codes and JSON output: https://github.com/openai/php2shell-checker
- Pattern: almost every new tool is URL-in (it reads the site's headers), while we are version-in. Our gap is that we can't check a live site by URL. Our edge is the full CVE history per version, not just one event.

**Existing competitors:**
- Composer 2.11 (blog.packagist.com/composer-2-11-release/) adds a `cooldown` policy and `composer audit --direct`. Composer 2.10 added malware blocking (Aikido feed) and the unified `config.policy`. That makes `composer audit` stronger, which raises the bar for our planned composer.lock scanner.
- endoflife.date/php was updated 31 Oct 2026 and shows **PHP 8.2 security support ending 31 Dec 2026** and 8.4 active support ending the same day.

**CVE trends driving search right now:**
- PHP2Shell, CVE-2026-109618 / CVE-2026-109619 (CVSS 4.0 9.2, fixed in 8.5.12 / 8.4.27 / 8.3.36 / 8.2.35, exploited before the patch per Pentest-Tools' timeline): https://www.php.net/archive/2026.php
- Laravel TokenGuard auth bypass, CVE-2026-114509 (critical, fixed in 12.68.0 / 13.29.0) and CVE-2026-114508 (data destruction, 6.5): https://github.com/laravel/framework/security/advisories/GHSA-f9x3-7vq9-cph6

**New ideas:**
- **"Check by URL" mode (non-intrusive header read of X-Powered-By, clearly labelled "advertised version only, backports not detectable")**: every new competitor offers it, and it feeds straight into our existing per-version report.
- **"PHP 8.2 EOL on 31 Dec 2026" countdown banner + upgrade guide page**: it's a timely search spike over the next 2 months, and it fits the planned EOL timeline feature.

## 2026-11-01 — Evening update ideas
- **Public status page (`/status`) built on `/api/health`, showing per-source freshness (NVD, php.net, GitHub advisories)** — builds trust, since users can see the data is current, and it reuses today's work.
- **Dynamic OG share images per `/check/[version]` (e.g. "PHP 8.1.12: 9 CVEs, upgrade to 8.1.x")** — shared links on X/Reddit get a clear preview card, so more clicks.
- **WordPress plugin compatibility hint on results ("WordPress needs PHP 7.4+, recommends 8.3")** — a huge WordPress audience searches this, and it links naturally to the hacked-site cleanup service.

## 2026-11-02 — Evening update ideas
- **Upgrade diff page (`/compare/8.1.12...8.1.31`) listing exactly which CVEs an upgrade fixes** — gives devs a ready justification to show clients or managers before an upgrade.
- **"Watch my version" alerts (email or webhook when a new CVE hits a saved PHP version)** — brings people back on their own and builds a small mailing list.
- **Filter CVEs by PHP extension/SAPI used (curl, openssl, phar, FPM, CGI)** — many CVEs only matter with certain extensions, so results become more accurate and less scary.

## 2026-11-03 — Evening update ideas
- **Scheduled GitHub Action that pings `/api/health` every few hours and opens an issue when it's `degraded` or down** — free uptime alerting, closing a gap from today's readiness checklist.
- **Symfony framework version checker (`/symfony/check/[version]`, GitHub Security Advisories for symfony/symfony)** — reuses the Laravel-checker idea's pipeline for a second big PHP audience with little free tooling.
- **Playwright browser tests in CI for the checker flow (enter version, see report, Copy link)** — catches UI breaks that unit and smoke tests miss, the other open readiness gap.

## 2026-11-04 — Evening update ideas
- **Docker image tag input (e.g. `php:8.1-fpm-alpine` or `php:8.2.12-apache`) resolved to its PHP version and checked** — many devs only know their Docker tag, not the exact PHP patch version.
- **Linux distro backport note (Ubuntu/Debian/RHEL package versions like `8.1.2-1ubuntu2.x`)** — distro builds backport fixes, so this cuts false "vulnerable" alarms for server users.
- **Copy-paste upgrade commands on results (apt with ondrej PPA, Homebrew, Docker tag bump)** — turns the report into a direct fix step, so people act right away.
