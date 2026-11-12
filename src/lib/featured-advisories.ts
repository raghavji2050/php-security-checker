/**
 * Short notes from official php.net security advisories, shown on featured /cve/{id} pages.
 * Every fact here is taken from php.net (https://www.php.net/archive/2026.php) and the
 * php-src GitHub security advisories; checked 2026-11-12. Fixed versions on the page
 * itself still come from live NVD/php.net ranges; these notes only add official context.
 */
export type FeaturedAdvisory = {
  cveId: string;
  /** Title as php.net words it. */
  title: string;
  /** Nickname used in press coverage, shown as such (not an official name). */
  nickname: string | null;
  published: string;
  advisoryUrl: string;
  ghsaId: string;
  ghsaUrl: string;
  fixedIn: string[];
  /** Plain-words summary of php.net's interim mitigations. */
  mitigations: string[];
  relatedCves: string[];
};

const ARCHIVE = "https://www.php.net/archive/2026.php";
const FIXED_2026_10_21 = ["8.5.12", "8.4.27", "8.3.36", "8.2.35"];

export const FEATURED_ADVISORIES: Record<string, FeaturedAdvisory> = {
  "CVE-2026-109618": {
    cveId: "CVE-2026-109618",
    title: "RCE via OOM corruption",
    nickname: "PHP2Shell",
    published: "2026-10-21",
    advisoryUrl: ARCHIVE,
    ghsaId: "GHSA-w8hw-w9fx-j79w",
    ghsaUrl: "https://github.com/php/php-src/security/advisories/GHSA-w8hw-w9fx-j79w",
    fixedIn: FIXED_2026_10_21,
    mitigations: [
      "Set memory_limit=-1 in a way applications cannot override (for example php_admin_value in the FPM pool).",
      "Set a low post_max_size (8M without uploads, 32M with uploads) and keep upload_max_filesize below it.",
      "Enforce request size and field/part/header count limits at the web server or proxy.",
    ],
    relatedCves: ["CVE-2026-109619"],
  },
  "CVE-2026-109619": {
    cveId: "CVE-2026-109619",
    title: "RCE via stale global state",
    nickname: "PHP2Shell",
    published: "2026-10-21",
    advisoryUrl: ARCHIVE,
    ghsaId: "GHSA-6wmf-4rv5-p3rp",
    ghsaUrl: "https://github.com/php/php-src/security/advisories/GHSA-6wmf-4rv5-p3rp",
    fixedIn: FIXED_2026_10_21,
    mitigations: [
      "Set session.upload_progress.enabled=0 in php.ini or the FPM pool (not ini_set() or .user.ini) and restart every worker.",
      "On PHP 8.5, set fatal_error_backtraces=0 and restart every worker.",
      "Fix attacker-reachable fatal errors and execution timeouts in your application.",
    ],
    relatedCves: ["CVE-2026-109618"],
  },
};

export function featuredAdvisory(id: string): FeaturedAdvisory | null {
  return FEATURED_ADVISORIES[id.toUpperCase()] ?? null;
}
