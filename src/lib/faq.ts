/**
 * Plain-text answers shown in "Quick answers" on /how-it-works and published as FAQPage JSON-LD.
 * Keep the visible text and the structured data the same; only describe what the app really does.
 */
export const FAQ = [
  {
    question: "How do I check if my PHP version is vulnerable?",
    answer:
      "Run php -v on the server, then enter the full MAJOR.MINOR.PATCH version (for example 8.1.12) on the home page or open /check/8.1.12. The result lists confirmed and possible PHP runtime CVEs for that exact version, the branch support status, and the release to upgrade to.",
  },
  {
    question: "Which data sources does PHP Security Checker use?",
    answer:
      "Only official records: the NIST National Vulnerability Database (NVD API 2.0) for CVEs, CVSS scores and affected ranges; php.net release, supported-versions and end-of-life data; the PHP ChangeLog to cross-check fixes; and GitHub Security Advisories published on php/php-src.",
  },
  {
    question: "What happens if NVD or php.net is down or slow?",
    answer:
      "Each upstream call has a time limit and a small number of retries. If a source still fails, the last successful cached copy is used and the result is marked as cached with its Data last updated time, shown in yellow rather than green. If nothing is cached, you get a clear error and a Retry button.",
  },
  {
    question: "Does a green result mean my server is safe?",
    answer:
      "No. Green means no confirmed PHP runtime vulnerability matched in the available data and the branch is still supported. Extensions, configuration, your PHP application code and how PHP is run (CGI or php-fpm) can still expose risk.",
  },
  {
    question: "Is there an API?",
    answer:
      "Yes. GET /api/check?v=8.1.12 returns the same report as JSON, with CORS enabled for GET. Errors return JSON with a code and a matching HTTP status. The OpenAPI 3.1 description is at /openapi.json.",
  },
  {
    question: "Does the checker scan my website or run PHP code?",
    answer:
      "No. It only compares the version string you enter against published records. It never connects to your server, sends payloads, or runs PHP code.",
  },
] as const;

export function faqJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}

/** Serialize JSON-LD for a script tag without allowing "</script>" breakouts. */
export function jsonLdString(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
