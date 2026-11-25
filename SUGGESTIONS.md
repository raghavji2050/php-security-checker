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

## Queued (auto-approved)

### 2026-11-06 — Evening update ideas
- **`/.well-known/security.txt` (RFC 9116)** — free trust signal for security crawlers and buyers who check it; one static file with contact and preferred languages.
- **Short version redirects (`/8.1.12` → `/check/8.1.12`)** — easier to share/type than the long path, and a cheap SEO win for version searches.
- ~~**Branch risk scorecard on `/php-versions` (support state + open CVE count from existing NVD data)**~~ Done 2026-11-11 (counts shown as reported NVD CVEs, not "open") — turns the timeline into an actionable “which branch is safest?” view without new data sources.

### 2026-11-07 — Evening update ideas
- ~~**CISA KEV "exploited in the wild" badge on `/cve/{id}` and `/cves` (official CISA KEV JSON feed)**~~ Done 2026-11-12 — tells devs at a glance which CVEs are actually being attacked, so they prioritise correctly.
- ~~**EPSS exploit-probability score on CVE pages (FIRST.org free EPSS API)**~~ Done 2026-11-12 — adds a real-world likelihood number next to CVSS, making the "should I worry?" answer more useful.
- ~~**Related CVEs block on `/cve/{id}` (same branch/year, from existing NVD data)**~~ Done 2026-11-12 — stronger internal linking for SEO and keeps visitors browsing longer.

## 2026-11-08 — Weekly market check
Sources checked 8 Nov 2026 (IST). No code changed. Compared with the 1 Nov 2026 check.

**New or newly noticed in the market (no second launch-press wave like 21–27 Oct):**
- php2shell.app, a URL-in PHP2Shell checker (one normal GET, no exploit) plus a fixed-version and Linux distro backport table. Debian package status on that table was checked 5 Nov 2026. Site check and bulk list check are free; they also sell credit packs for an assistant that reads pasted server output when the version is hidden (exact credit prices not listed on the homepage fetch, so not repeated here): https://php2shell.app/ and https://php2shell.app/fixed-versions
- php2shell.uk/checker, last reviewed 28 Oct 2026: URL check on their server, plus a browser-side version / `php -v` / distro-package paste (closer to our version-in model). They also sell a TypeScript checker engine for $99 USD one-time (price taken from their page). They flag CVE-2026-115560 as separate and not version-assessable: https://php2shell.uk/checker
- php2shell-checker.com published a dedicated CVE-2026-115560 explainer (updated 30 Oct 2026) covering the three config conditions and the `session.upload_progress.enabled=0` mitigation: https://php2shell-checker.com/cve-2026-115560/
- Additional GitHub/CLI tools not listed on 1 Nov (launch dates not independently confirmed, so not called “new this week”): [adityaaravind/php2shell-check](https://github.com/adityaaravind/php2shell-check) (local binaries, Docker images, running containers, inventory files, passive URL HEAD); [assetnote/php2shell-scanner](https://github.com/assetnote/php2shell-scanner) (authorized active multipart probes); [aancw/php2shell-scanner](https://github.com/aancw/php2shell-scanner) (url / local / ssh modes). [phpscan 1.6.0](https://pypi.org/project/phpscan/) (30 Oct 2026) is the open-source scanner behind already-listed phpatch.com.
- Pattern is unchanged: most PHP2Shell tools are URL-in and event-specific. A few now add distro-backport tables or fleet/Docker inventory. We are still version-in, with a broader CVE history.

**Existing competitors:**
- endoflife.date/php still shows PHP 8.2 security support ending 31 Dec 2026 and PHP 8.4 active support ending the same day. Latest listed patches match the 21 Oct PHP2Shell releases (8.2.35 / 8.3.36 / 8.4.27 / 8.5.12): https://endoflife.date/php and https://www.php.net/supported-versions.php
- Composer / Packagist `composer audit`, Roave SecurityAdvisories (dev-latest updated 7 Nov 2026 as a routine advisory bump), Enlightn, Snyk, WPScan and CVEdetails: no major product-feature change found this week. Snyk has a coverage article on the October RCEs, later updated for CVE-2026-115560: https://snyk.io/blog/php-patches-critical-unauthenticated-rces/
- openai/php2shell-checker remains the header-only CLI noted on 1 Nov: https://github.com/openai/php2shell-checker

**CVE and search trends:**
- PHP2Shell is still the main search driver: CVE-2026-109618 and CVE-2026-109619 (CVSS v4.0 9.2 Critical; NVD also lists v3.1 9.8 Critical and 8.1 High respectively). Official write-up: https://www.php.net/archive/2026.php (21 Oct 2026). NVD now has both records with `cpe:2.3:a:php:php` ranges and status Analyzed; published 21 Oct 2026, last modified 5 Nov 2026 19:17 UTC (6 Nov 2026, 12:47 AM IST): https://nvd.nist.gov/vuln/detail/CVE-2026-109618 and https://nvd.nist.gov/vuln/detail/CVE-2026-109619
- CVE-2026-115560 (informational advisory, 23 Oct 2026 on php.net): a separate, configuration-dependent session upload-progress RCE path. PHP says it is unlikely in practice and will publish a full advisory with the next regular bugfix release. The 21 Oct PHP2Shell releases do not fix it. Mitigation: keep `session.upload_progress.enabled=0` until that release. As of this check (8 Nov 2026 IST) php.net’s latest post is PHP 8.6.0 RC5 (5 Nov 2026); no new stable security release has shipped, and the NVD API returned 0 records for CVE-2026-115560.
- PHP 8.6.0 GA is planned for 19 Nov 2026 (RC5 published 5 Nov 2026). PHP 8.6.0 RC4 already included the two PHP2Shell fixes: https://www.php.net/archive/2026.php
- Secondary, Windows-oriented: updated PHP Windows builds on 26 Oct 2026 bundle Brotli 1.2.1 to fix CVE-2026-111497 (out-of-bounds write in Brotli decompression, reachable via the cURL extension when automatic HTTP response decompression is enabled). NVD has this ID (published 22 Oct 2026, last modified 6 Nov 2026).
- Laravel TokenGuard CVE-2026-114509 is still being written about; no newer Laravel CVE wave found this week: https://github.com/laravel/framework/security/advisories/GHSA-f9x3-7vq9-cph6

**Where we stand (features shipped 2–7 Nov, from IMPROVEMENTS.md):**
- Feature 1/13 `/php-versions` timeline (4 Nov, PR improve/2026-11-04), Feature 2/13 `/cves` explorer (5 Nov), Feature 3/13 `/composer` lock scanner (6 Nov), Feature 4/13 `/cve/{CVE-ID}` Am I affected? pages (7 Nov). The site is now a small hub (EOL timeline + CVE explorer + lock scanner + per-CVE pages), not only a version-in checker.
- Remaining gap vs the PHP2Shell pack: no URL-in mode, and Feature 4 did not add PHP2Shell as a featured sitemap CVE because the nickname did not map to an NVD ID on 7 Nov. The IDs CVE-2026-109618 and CVE-2026-109619 are in NVD with php:php CPEs as of this check, so those `/cve/{id}` pages can be featured from official data now.

**New ideas:**
- **PHP 8.6.0 “is it patched / should I move?” page around the 19 Nov 2026 GA:** captures the launch-week search spike and can state from php.net that RC4 and later already include the PHP2Shell fixes (not for production until GA).
- **Config-aware page for CVE-2026-115560:** this one is not a version-range question (the three conditions are serialize_handler set to `php_binary`/`php_serialize`, switched to `php` at runtime before `session_start()`, and upload progress still enabled). Competitors are already ranking for it; NVD has no record yet, so the page should cite php.net’s 23 Oct advisory and label the pending full advisory clearly.

## Queued (auto-approved)

### 2026-11-08 — Evening update ideas
- ~~**composer.json `require.php` constraint checker (paste `"php": "^8.1"`, see which php.net branches it allows and flag EOL ones)** — package maintainers instantly see if their constraint still allows unsupported PHP, using existing php.net branch data.~~ Done 2026-11-12 (`/composer/php-constraint`).
- ~~**IndexNow ping on each deploy for new `/cve/{id}`, `/check/` and `/news` URLs (free IndexNow protocol, own sitemap only)** — Bing and other IndexNow engines pick up new CVE pages within hours instead of days.~~ Done 2026-11-12 (approved by Raghav; `npm run indexnow` after prod deploy)
- ~~**"Copy as Markdown" button on version and composer reports** — devs can paste a clean CVE/fix table straight into a GitHub issue, PR or Jira ticket, so the report turns into a tracked task.~~ Done 2026-11-12

### 2026-11-09 — Evening update ideas
- ~~**Featured /cve pages for CVE-2026-109618 and CVE-2026-109619 (PHP2Shell) from NVD data** — captures the biggest PHP search spike with official data.~~ Done 2026-11-12
- ~~**Symfony "Copy as Markdown" and badge for /symfony reports** — shareable results for Symfony teams, reuses existing badge code.~~ Done 2026-11-12 (`/api/symfony/badge`)
- **PHP 8.6.0 GA (19 Nov) readiness page using php.net data** — launch-week traffic, labelled clearly until GA.

### 2026-11-10 — Evening update ideas
- ~~**"Is my PHP patched?" copy-paste `php -v` parser (paste full `php -v` output, extract version + distro suffix)** — users paste what they have instead of hand-typing a version.~~ Done 2026-11-12 (`/php-v`)
- ~~**Per-branch RSS/Atom feed of new PHP CVEs from existing NVD data** — devs subscribe once, and it earns backlinks and returning visitors.~~ Done 2026-11-12 (`/feeds/all.xml`, `/feeds/8.3.xml`)
- ~~**Print-friendly "server audit summary" page combining version, php.ini and extension checks** — gives freelancers a client-ready report.~~ Done 2026-11-13 (`/audit`)

### 2026-11-11 — Evening update ideas
- ~~**"What changed" diff page between two PHP patch versions (php.net ChangeLog data)** — shows which fixes you get by upgrading, a strong reason to upgrade.~~ Done 2026-11-12 (`/changes`, security IDs only)
- **Laravel version support checker (laravel.com release policy + Packagist advisories)** — same hub pattern as Symfony, covers his main stack.
- ~~**JSON-LD FAQ schema on /check and /php-versions pages** — helps Google/AI answer engines quote the site.~~ Done 2026-11-12

### 2026-11-12 — Evening update ideas
- **Embeddable "PHP support status" widget (small iframe/SVG for blogs and hosting docs)** — every embed is a backlink and a returning-visitor source, using php.net data only.
- **Dynamic OG share images per /cve/{id} (severity, KEV/EPSS, fixed versions via next/og)** — CVE links look better on X/LinkedIn/Slack, so click-through goes up.
- **Open data JSON at /data/php-cves.json (NVD-attributed, cached, with update time)** — devs and bloggers can use it and cite the site, which earns links.

### 2026-11-14 — Evening update ideas
- **Weekly Search Console review: top queries/pages from GSC, then tune titles and FAQs for those queries** — free, uses his real data, shows which pages deserve work while features are paused.
- **/changelog page generated from IMPROVEMENTS.md (shipped features with dates)** — fresh crawlable content and a trust signal for visitors.
- **Draft (unposted) listings for free PHP/security directories and awesome-php-style lists** — backlinks; text goes to Raghav for approval, nothing is submitted by me.

## 2026-11-15 — Weekly competitor check (IST, no code changed)
- New: phpscientist/php-security-check (GitHub created 9 Nov, v0.2.1 on Packagist 10 Nov 2026): CLI/Action for php.ini, PHP version/EOL, Composer and Laravel/Symfony/WordPress config checks, MIT, 0 stars so far: https://packagist.org/packages/phpscientist/php-security-check
- voku/php-runtime-audit (created 25 Oct): local /proc runtime evidence for PHP2Shell CVEs: https://github.com/voku/php-runtime-audit
- Enlightn/signify checkers: no change. 
- Trends: Laravel signed-URL expiry bypass GHSA-v5ch-g375-82r6 (11 Nov, moderate 4.8, fixed 12.72.0 / 13.41.0); Symfony 5.4.56/6.4.50/7.4.23/8.1.11 security release (4-6 Nov, many CVEs e.g. CVE-2026-118516): https://symfony.com/blog/cve-2026-118516-host-placeholders-can-match-the-start-of-the-path-in-compiled-url-matchers-bypassing-path-rules ; Laskyr tracks PHP package CVEs: https://laskyr.com/php-packages/vulnerabilities
- Ideas: (1) "Framework CVE feed" page for Laravel/Symfony from Packagist advisories (extends /symfony, Laravel checker); (2) 8.6.0 GA page on 19 Nov (already queued).

### 2026-11-15 — Evening update ideas
## Queued (auto-approved)
- **/security.txt + /.well-known/security.txt for the checker itself** — free trust signal, shows the site follows the practices it preaches.
- **Per-branch "upgrade urgency" score on /php-versions (days to EOL + open CVE count, official data)** — gives a one-glance answer on which branch to move first.
- ~~**Laravel/Symfony framework CVE feed page (Packagist advisories)**~~ Done 2026-11-25 (`/framework-cves`). — fresh crawlable content for his main stack, earns returning visitors.

### 2026-11-16 — Evening update ideas
## Queued (auto-approved)
- **"Copy as .env-safe checklist": downloadable hardening checklist (Markdown) from /audit results** — gives freelancers a client handoff file, no secrets involved.
- **/glossary page (CVSS, KEV, EPSS, backport, EOL) in plain words** — long-tail SEO and AEO answers, written from official definitions.
- **Status badge for "latest PHP release per branch" (SVG)** — READMEs embed it, each one a backlink using php.net data.

### 2026-11-17 — Evening update ideas
## Queued (auto-approved)
- **"Hosting PHP version" lookup page: major hosts' default PHP versions from their official docs, flagged vs EOL** — helps freelancers see whether a host is behind, useful long-tail SEO.
- **Email-free "copy shareable result link" on /check (version in URL, with OG preview)** — easy sharing in team chats, more returning traffic.
- **Self-check page showing site's own security headers (CSP, HSTS) live** — trust signal; only scans its own site.

### 2026-11-20 — Evening update ideas
## Queued (auto-approved)
- **"Is my PHP patch current?" one-box check on homepage (paste version → latest patch in branch, official php.net data)** — fastest answer for visitors, better engagement.
- **Per-CVE "how to check logs" tips on /cve pages (generic, no scanning)** — practical value, helps AEO snippets.
- **RSS/Atom feed of new PHP releases and security fixes (php.net data)** — returning readers, feed-directory backlinks.

### 2026-11-21 — Evening update ideas
## Queued (auto-approved)
- **Composer "platform php" mismatch checker: paste composer.json require.php, shows which supported/EOL branches it allows** — catches silent EOL constraints, client-audit useful.
- **Changelog page "What changed this week" from php.net release data** — fresh weekly content, SEO and returning visitors.
- **Print/PDF-friendly /audit report layout** — freelancers hand it to clients, free shareable proof.

## 2026-11-22 — Weekly competitor check (IST, no code changed)
- New: Insignary insignary-chk (free Linux x86_64 CLI scanner for PHP2Shell CVE-2026-109618/109619 + Node2Shell, announced 4-6 Nov 2026): https://www.globenewswire.com/news-release/2026/11/06/3397466/0/en/insignary-releases-free-insignary-chk-tool-to-detect-php2shell-and-node2shell-exposure.html
- New: SmartScanner 3.1 added PHP2Shell detection (4 Nov): https://www.thesmartscanner.com/blog/introducing-version-3-1-mcp-security-testing-and-php2shell-detection
- Trend: PHP 19 Nov security release (8.5.13/8.4.28/8.3.37/8.2.36, 18 CVEs, FPM smuggling CVE-2026-129289 CVSS 9.2): https://www.bleepingcomputer.com/news/security/php-security-updates-fix-18-flaws-including-critical-rce-bugs/
- Other competitors: not re-checked this week (no change found).
- Ideas: (1) "Am I patched for 19 Nov release?" landing page (patch-level check + mitigations list from php.net/AWS bulletin https://aws.amazon.com/security/security-bulletins/2026-190-aws/); (2) PHP-FPM connection-reuse self-check guide page (nginx/Apache config snippets).

### 2026-11-22 — Evening update ideas
## Queued (auto-approved)
- **"Am I patched for the 19 Nov PHP release?" page (patch-level check + official mitigations)** — timely search intent after 18-CVE release.
- **PHP-FPM hardening guide page (nginx/Apache snippets, php.net data)** — practical, long-tail SEO for the FPM smuggling issue.
- **"Known exploited" (CISA KEV) badge on /cve pages** — helps prioritise what to patch first, official data.

### 2026-11-23 — Evening update ideas
## Queued (auto-approved)
- **"Copy badge/embed" button on every /check/{version} page (reuses new widget)** — spreads backlinks from users' READMEs and blogs.
- **PHP framework-vs-PHP compatibility matrix (Laravel/Symfony supported PHP versions, official docs)** — answers a common upgrade question, long-tail SEO.
- **Weekly "PHP security digest" public page auto-built from php.net + NVD** — fresh content each week, returning visitors.

### 2026-11-24 — Evening update ideas
## Queued (auto-approved)
- **PHP upgrade path page (e.g. /upgrade/7.4-to-8.3): step-by-step branch hops linking each official php.net migration guide** — answers "how do I upgrade" searches, natural next step after an EOL result.
- **Deprecated/removed function lookup (type a function, see which PHP version deprecated or removed it, linking php.net manual)** — quick fix help during upgrades, long-tail SEO.
- **Drupal core support/security status checker (official drupal.org release history data)** — same hub pattern as WordPress/Symfony, new PHP audience.
