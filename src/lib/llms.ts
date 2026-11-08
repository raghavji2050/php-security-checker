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
    "The checker only compares a version string with published records. It does not scan websites or run PHP code.",
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
    `- [composer.lock scanner](${url("/composer")}): paste or upload a composer.lock (parsed in the browser); checks locked name@version against the Packagist security advisories API. POST /api/composer-advisories accepts only the package map, never the raw lock.`,
    `- [How it works](${url("/how-it-works")}): matching rules, trusted sources and outage behaviour.`,
    `- [About](${url("/about")}): scope and disclaimer.`,
    "",
    "## API",
    "",
    `- [GET /api/check?v={version}](${url("/api/check?v=8.1.12")}): JSON report for one version. CORS enabled for GET. Errors are JSON with \`code\` (missing_version, invalid_version, rate_limited, data_unavailable, internal_error) and a matching HTTP status.`,
    `- [GET /api/health](${url("/api/health")}): app status and data freshness (NVD, php.net, ChangeLog, GitHub advisories).`,
    `- [POST /api/composer-advisories](${url("/api/composer-advisories")}): JSON body { "packages": { "vendor/pkg": "1.2.3" } }; returns Packagist advisories matching those versions.`,
    `- [OpenAPI 3.1 spec](${url("/openapi.json")}): machine-readable description of the API.`,
    "",
    "## Quick answers",
    "",
    ...FAQ.flatMap((item) => [`### ${item.question}`, "", item.answer, ""]),
  ];
  return `${lines.join("\n").trimEnd()}\n`;
}
