/**
 * Plain-language glossary of the security terms used across the site.
 * Definitions are written in our own words; each term links to the official
 * source that defines it, plus the page on this site where the term is used.
 */
export type GlossaryTerm = {
  /** URL fragment, also used as the visible anchor. */
  id: string;
  term: string;
  /** Short expansion of an acronym, if any. */
  expansion?: string;
  definition: string;
  /** What it means for a PHP developer in practice. */
  inPractice: string;
  source: { label: string; href: string };
  related?: { label: string; href: string };
};

export const GLOSSARY: GlossaryTerm[] = [
  {
    id: "cve",
    term: "CVE",
    expansion: "Common Vulnerabilities and Exposures",
    definition:
      "A public ID (like CVE-2024-4577) given to one specific, disclosed vulnerability, so everyone talks about the same bug.",
    inPractice:
      "When a PHP release note lists a CVE ID, search it here to see which PHP versions are affected and which patch fixes it.",
    source: { label: "CVE Program (cve.org)", href: "https://www.cve.org/ResourcesSupport/Glossary" },
    related: { label: "CVE explorer", href: "/cves" },
  },
  {
    id: "nvd",
    term: "NVD",
    expansion: "National Vulnerability Database",
    definition:
      "The US government (NIST) database that adds severity scores, affected product ranges (CPE) and references to CVE records.",
    inPractice:
      "Our CVE pages read affected PHP version ranges from NVD. A CVE without NVD ranges cannot be matched to a version automatically.",
    source: { label: "NIST NVD", href: "https://nvd.nist.gov/general" },
    related: { label: "How it works", href: "/how-it-works" },
  },
  {
    id: "cvss",
    term: "CVSS",
    expansion: "Common Vulnerability Scoring System",
    definition:
      "A 0.0 to 10.0 score for how severe a vulnerability is, based on things like whether it needs login, network access or user action.",
    inPractice:
      "Use it to sort what to patch first, but it measures technical severity only. It does not say whether anyone is attacking the bug right now.",
    source: { label: "FIRST CVSS", href: "https://www.first.org/cvss/" },
    related: { label: "CVE explorer severity filter", href: "/cves" },
  },
  {
    id: "severity",
    term: "Severity rating",
    definition:
      "The label that goes with a CVSS v3/v4 score: None (0.0), Low (0.1–3.9), Medium (4.0–6.9), High (7.0–8.9) and Critical (9.0–10.0).",
    inPractice:
      "Older CVEs often only have a CVSS v2 score, which uses different bands; we show it as reported and mark CVEs with no score as Unrated.",
    source: { label: "FIRST CVSS v3.1 specification", href: "https://www.first.org/cvss/v3.1/specification-document" },
  },
  {
    id: "kev",
    term: "KEV",
    expansion: "Known Exploited Vulnerabilities catalog",
    definition:
      "A list kept by the US agency CISA of vulnerabilities with reliable evidence of real attacks in the wild.",
    inPractice:
      "If a CVE affecting your PHP version is in KEV, treat the upgrade as urgent, whatever its CVSS score.",
    source: {
      label: "CISA KEV catalog",
      href: "https://www.cisa.gov/known-exploited-vulnerabilities-catalog",
    },
    related: { label: "CVE explorer", href: "/cves" },
  },
  {
    id: "epss",
    term: "EPSS",
    expansion: "Exploit Prediction Scoring System",
    definition:
      "A daily probability (0–100%) from FIRST that a vulnerability will be exploited in the next 30 days, with a percentile against all other CVEs.",
    inPractice:
      "A high EPSS next to a high CVSS is a strong signal to patch soon. It is a model estimate, not proof of attacks (that is what KEV is for).",
    source: { label: "FIRST EPSS", href: "https://www.first.org/epss/" },
  },
  {
    id: "ghsa",
    term: "GHSA",
    expansion: "GitHub Security Advisory",
    definition:
      "An advisory ID (like GHSA-xxxx-xxxx-xxxx) from the GitHub Advisory Database, often published before or alongside a CVE.",
    inPractice:
      "php-src publishes advisories on GitHub, and Composer/Packagist advisories for packages like laravel/framework often carry a GHSA ID.",
    source: { label: "GitHub Advisory Database", href: "https://docs.github.com/en/code-security/security-advisories" },
    related: { label: "composer.lock scanner", href: "/composer" },
  },
  {
    id: "eol",
    term: "End of life (EOL)",
    definition:
      "A PHP branch that no longer gets any fixes from the PHP project, not even security fixes.",
    inPractice:
      "New vulnerabilities found later will never be patched upstream for that branch. Plan the upgrade to a supported branch.",
    source: { label: "php.net supported versions", href: "https://www.php.net/supported-versions.php" },
    related: { label: "Support timeline", href: "/php-versions" },
  },
  {
    id: "active-support",
    term: "Active support",
    definition:
      "The phase of a PHP branch where it gets regular bug fixes and security fixes in new patch releases.",
    inPractice: "The safest place to be. Stay on the latest patch of an actively supported branch.",
    source: { label: "php.net supported versions", href: "https://www.php.net/supported-versions.php" },
    related: { label: "Branch table", href: "/versions" },
  },
  {
    id: "security-support",
    term: "Security-only support",
    definition:
      "The phase after active support where a branch only gets fixes for security issues, released when needed.",
    inPractice: "Still safe if you stay on the latest patch, but EOL is coming. Start planning the next upgrade.",
    source: { label: "php.net supported versions", href: "https://www.php.net/supported-versions.php" },
    related: { label: "Support timeline", href: "/php-versions" },
  },
  {
    id: "backport",
    term: "Backport",
    definition:
      "Applying a fix from a newer release to an older version without changing its version number, as Linux distributions do for their PHP packages.",
    inPractice:
      "A distro PHP like 8.1.2-1ubuntu2.20 may be patched even though plain 8.1.2 looks vulnerable. Check your distro's security tracker before panicking.",
    source: { label: "Debian security FAQ", href: "https://www.debian.org/security/faq#version" },
    related: { label: "Paste php -v", href: "/php-v" },
  },
  {
    id: "patch-release",
    term: "Patch release",
    definition:
      "The last number in a PHP version (the 12 in 8.3.12). Patch releases on a branch contain fixes only, no breaking changes.",
    inPractice:
      "Moving to the latest patch on your branch is the cheapest security win; compare what you get on the What changed page.",
    source: { label: "php.net releases", href: "https://www.php.net/releases/" },
    related: { label: "What changed", href: "/changes" },
  },
  {
    id: "cpe",
    term: "CPE",
    expansion: "Common Platform Enumeration",
    definition:
      "A structured name for a product and version (for PHP, cpe:2.3:a:php:php:…) that NVD uses to say exactly which versions a CVE affects.",
    inPractice: "This is how a CVE gets matched to your exact PHP version on the check page.",
    source: { label: "NIST CPE", href: "https://nvd.nist.gov/products/cpe" },
    related: { label: "How it works", href: "/how-it-works" },
  },
  {
    id: "supply-chain",
    term: "Supply-chain attack",
    definition:
      "An attack that reaches you through a dependency, such as a malicious or hijacked Composer or npm package, instead of your own code.",
    inPractice:
      "Commit composer.lock, run composer audit in CI, and review new or renamed packages before installing them.",
    source: { label: "Composer audit docs", href: "https://getcomposer.org/doc/03-cli.md#audit" },
    related: { label: "composer.lock scanner", href: "/composer" },
  },
];

/** DefinedTermSet JSON-LD for the glossary page. */
export function glossaryJsonLd(baseUrl: string) {
  const pageUrl = new URL("/glossary", baseUrl).toString();
  return {
    "@context": "https://schema.org",
    "@type": "DefinedTermSet",
    "@id": pageUrl,
    name: "PHP security glossary",
    url: pageUrl,
    hasDefinedTerm: GLOSSARY.map((t) => ({
      "@type": "DefinedTerm",
      name: t.expansion ? `${t.term} (${t.expansion})` : t.term,
      description: t.definition,
      url: `${pageUrl}#${t.id}`,
      inDefinedTermSet: pageUrl,
    })),
  };
}
