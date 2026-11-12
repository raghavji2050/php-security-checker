import { FAQ } from "@/lib/faq";
import { SITE_URL } from "@/lib/site";

function url(path: string): string {
  return new URL(path, SITE_URL).toString();
}

/** Markdown summary for AI assistants, served at /llms.txt (https://llmstxt.org). */
export function buildLlmsTxt(): string {
  const lines = [
    "# PHP Security Checker",
    "",
    "> Check an installed PHP version (MAJOR.MINOR.PATCH) against known PHP runtime vulnerabilities and the official php.net support timeline. Data comes only from NVD, php.net, the PHP ChangeLog and GitHub Security Advisories for php/php-src.",
    "",
    "The version checker only compares a version string with published records. It does not run PHP. The separate headers tool fetches one public URL you submit (HTTP/HTTPS ports 80 and 443, private and metadata addresses refused) and reads response headers only.",
    "",
    "## Pages",
    "",
    `- [Home](${url("/")}): enter a PHP version and get a report.`,
    `- [Result page](${url("/check/8.1.12")}): server-rendered report at /check/{version}, for example /check/8.1.12.`,
    `- [Vulnerabilities](${url("/vulnerabilities")}): searchable list of PHP runtime CVEs.`,
    `- [CVE explorer](${url("/cves")}): every PHP interpreter CVE from NVD with search, filters by year, severity and affected branch (URL params q, year, severity, branch), plus per-year and severity charts.`,
    `- [Security news](${url("/news")}): headlines and links from official PHP, Laravel, WordPress and LAMP-stack feeds and APIs (filter with ?source=). We do not republish articles.`,
    `- [Am I affected? CVE pages](${url("/cve/CVE-2024-4577")}): /cve/{CVE-ID} for any PHP CVE in NVD, with a branch-wise fixed version table from NVD/php.net ranges and a version check (?v=X.Y.Z).`,
    `- [Versions](${url("/versions")}): PHP branches and their support status.`,
    `- [PHP versions timeline](${url("/php-versions")}): visual support timeline per PHP branch (release, active support, security-only, end of life) from php.net data.`,
    `- [require.php constraint checker](${url("/composer/php-constraint")}): paste the composer.json "php" constraint (e.g. ^8.1) to see which php.net branches it allows and whether any are end of life.`,
    `- [composer.lock scanner](${url("/composer")}): paste or upload a composer.lock (parsed in the browser); checks locked name@version against the Packagist security advisories API. POST /api/composer-advisories accepts only the package map, never the raw lock.`,
    `- [php.ini audit](${url("/php-ini")}): paste or upload php.ini. Parsed in the browser. Findings explain current vs recommended, with cases where a stricter setting would break an app.`,
    `- [Extension checker](${url("/extensions")}): paste php -m. Bundled names come from the PHP manual. Confirmed matches are PHP runtime CVEs whose description mentions the extension. Outdated is not assessed.`,
    `- [Laravel checker](${url("/laravel")}): framework version against Laravel's release-note support table and Packagist advisories for laravel/framework. Env checklist stays in the browser.`,
    `- [Symfony checker](${url("/symfony")}): Symfony version against symfony.com release/EOL data and Packagist advisories for symfony/symfony. Server-rendered reports at /symfony/check/{version}.`,
    `- [WordPress core](${url("/wordpress")}): core version status from api.wordpress.org stable-check (latest, outdated, insecure). No plugin/theme coverage and no CVE list.`,
    `- [Security headers](${url("/headers")}): one public URL, response headers only, SSRF protections.`,
    `- [Docker / PHP](${url("/docker")}): official image tags via docker-library/php versions.json, plus a local Dockerfile text review. Images are not pulled.`,
    `- [Password hashing](${url("/password-hashing")}): compare a hash string with PHP's password API recommendations.`,
    `- [How it works](${url("/how-it-works")}): matching rules, trusted sources and outage behaviour.`,
    `- [About](${url("/about")}): scope and disclaimer.`,
    "",
    "## API",
    "",
    `- [GET /api/check?v={version}](${url("/api/check?v=8.1.12")}): JSON report for one version. CORS enabled for GET. Errors are JSON with \`code\` (missing_version, invalid_version, rate_limited, data_unavailable, internal_error) and a matching HTTP status.`,
    `- [GET /api/health](${url("/api/health")}): app status and data freshness (NVD, php.net, ChangeLog, GitHub advisories).`,
    `- [POST /api/composer-advisories](${url("/api/composer-advisories")}): JSON body { "packages": { "vendor/pkg": "1.2.3" } }; returns Packagist advisories matching those versions.`,
    `- [GET /api/laravel?v=11.31.0](${url("/api/laravel?v=11.31.0")}): Laravel support table plus Packagist advisories for laravel/framework.`,
    `- [GET /api/symfony?v=7.4.10](${url("/api/symfony?v=7.4.10")}): symfony.com support data plus Packagist advisories for symfony/symfony.`,
    `- [GET /api/wordpress?v=6.4.2](${url("/api/wordpress?v=6.4.2")}): WordPress.org stable-check status for one core version.`,
    `- [GET /api/docker-tag?tag=php:8.3-fpm](${url("/api/docker-tag?tag=php:8.3-fpm")}): official PHP image tag mapping.`,
    `- [POST /api/headers](${url("/api/headers")}): JSON { "url" } for one public URL. Private targets are rejected.`,
    `- [POST /api/extensions](${url("/api/extensions")}): JSON { "modules", "version"? } for php -m names.`,
    `- [GET /api/badge?v=8.3.12](${url("/api/badge?v=8.3.12")}): SVG status badge from the version check.`,
    `- [OpenAPI 3.1 spec](${url("/openapi.json")}): machine-readable description of the API.`,
    "",
    "## Quick answers",
    "",
    ...FAQ.flatMap((item) => [`### ${item.question}`, "", item.answer, ""]),
  ];
  return `${lines.join("\n").trimEnd()}\n`;
}
