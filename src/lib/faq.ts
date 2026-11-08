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
      "Version checks use NIST NVD, php.net releases and support dates, the PHP ChangeLog, and GitHub Security Advisories for php/php-src. Composer and Laravel advisories come from Packagist. Laravel support dates come from Laravel's release notes. WordPress core status comes from api.wordpress.org. Docker tag mapping comes from docker-library/php versions.json. News headlines come from the official feeds linked on /news.",
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
      "The version checker only compares the version string you enter. It never connects to your server or runs PHP. The headers tool fetches a single public URL you submit, reads response headers, and discards the body. It refuses local, private, and metadata addresses. It does not send exploit payloads.",
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
