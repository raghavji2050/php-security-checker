import { SITE_URL } from "@/lib/site";

const errorSchema = {
  type: "object",
  required: ["error", "code", "status"],
  properties: {
    error: { type: "string", description: "Human-readable message." },
    code: {
      type: "string",
      enum: ["missing_version", "invalid_version", "rate_limited", "data_unavailable", "internal_error", "missing_packages", "invalid_packages", "invalid_body", "too_many_packages", "too_large", "missing_url", "blocked_target", "invalid_url", "missing_tag", "invalid_tag", "invalid_modules"],
    },
    status: { type: "integer" },
  },
};

const findingSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    cveId: { type: ["string", "null"] },
    ghsaId: { type: ["string", "null"] },
    description: { type: "string" },
    verdict: { type: "string", enum: ["confirmed", "potential"] },
    severity: { type: ["string", "null"] },
    cvssScore: { type: ["number", "null"] },
    cvssVersion: { type: ["string", "null"] },
    affectedVersions: { type: "string" },
    fixedVersion: { type: ["string", "null"] },
    fixedVersionStatus: { type: "string", enum: ["verified", "not_verified"] },
    advisoryUrl: { type: ["string", "null"] },
    published: { type: ["string", "null"] },
  },
};

/** OpenAPI 3.1 description of the public API, served at /openapi.json. */
export function buildOpenApiSpec() {
  return {
    openapi: "3.1.0",
    info: {
      title: "PHP Security Checker API",
      version: "1.0.0",
      description:
        "Check a PHP release (MAJOR.MINOR.PATCH) against known CVEs from NVD, php.net and GitHub advisories, plus its php.net support status. A version-only check cannot prove a deployment is safe or exploitable.",
    },
    servers: [{ url: SITE_URL }],
    paths: {
      "/api/check": {
        get: {
          operationId: "checkPhpVersion",
          summary: "Check a PHP version for known vulnerabilities and support status",
          parameters: [
            {
              name: "v",
              in: "query",
              required: true,
              description: "Exact PHP release, for example 8.1.12. A branch such as 8.1 is rejected.",
              schema: { type: "string", pattern: "^\\d{1,4}\\.\\d{1,4}\\.\\d{1,4}$", example: "8.1.12" },
            },
          ],
          responses: {
            "200": {
              description: "Check result.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      version: { type: "string" },
                      supportStatus: { type: "string", enum: ["active", "security", "eol", "unknown"] },
                      securityStatus: {
                        type: "string",
                        enum: ["vulnerable", "caution", "no_known_issues", "unable_to_verify"],
                      },
                      securityStatusLabel: { type: "string" },
                      statusExplanation: { type: "string" },
                      counts: {
                        type: "object",
                        properties: {
                          total: { type: "integer" },
                          confirmed: { type: "integer" },
                          potential: { type: "integer" },
                          critical: { type: "integer", description: "Confirmed findings whose severity is CRITICAL." },
                          high: { type: "integer" },
                          medium: { type: "integer" },
                          low: { type: "integer" },
                          unrated: { type: "integer" },
                          rce: { type: "integer" },
                        },
                      },
                      vulnerabilities: { type: "array", items: findingSchema },
                      minimumFixedVersion: { type: ["string", "null"] },
                      recommendedVersion: { type: ["string", "null"] },
                      checkedAt: { type: "string", format: "date-time" },
                      lastDataUpdate: { type: ["string", "null"] },
                      stale: { type: "boolean" },
                      disclaimer: { type: "string" },
                    },
                  },
                },
              },
            },
            "400": { description: "Missing or invalid version.", content: { "application/json": { schema: errorSchema } } },
            "429": {
              description: "Rate limited. See the Retry-After header (seconds).",
              headers: { "Retry-After": { schema: { type: "integer" } } },
              content: { "application/json": { schema: errorSchema } },
            },
            "503": {
              description: "Upstream vulnerability data is unavailable right now.",
              content: { "application/json": { schema: errorSchema } },
            },
            "500": { description: "Unexpected error.", content: { "application/json": { schema: errorSchema } } },
          },
        },
      },
      "/api/health": {
        get: {
          operationId: "health",
          summary: "App status and data freshness (cached data only, never calls upstream sources)",
          responses: {
            "200": {
              description: "status is ok when NVD data is cached and fresh, otherwise degraded.",
              content: { "application/json": { schema: { type: "object" } } },
            },
          },
        },
      },
      "/api/composer-advisories": {
        post: {
          operationId: "composerAdvisories",
          summary: "Check locked Composer package versions against Packagist security advisories",
          description:
            "Send only a name@version map (or list). Do not upload a raw composer.lock. Advisories come only from packagist.org/api/security-advisories/.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["packages"],
                  properties: {
                    packages: {
                      oneOf: [
                        { type: "object", additionalProperties: { type: "string" } },
                        {
                          type: "array",
                          items: {
                            type: "object",
                            required: ["name", "version"],
                            properties: {
                              name: { type: "string" },
                              version: { type: "string" },
                              isDev: { type: "boolean" },
                            },
                          },
                        },
                      ],
                    },
                  },
                },
              },
            },
          },
          responses: {
            "200": { description: "Audit result with matching advisories only.", content: { "application/json": { schema: { type: "object" } } } },
            "400": { description: "Invalid body.", content: { "application/json": { schema: errorSchema } } },
            "429": { description: "Rate limited.", content: { "application/json": { schema: errorSchema } } },
            "503": { description: "Packagist unavailable.", content: { "application/json": { schema: errorSchema } } },
          },
        },
      },
      "/api/laravel": {
        get: {
          operationId: "checkLaravelVersion",
          summary: "Laravel framework support window and Packagist advisories for one version",
          parameters: [{ name: "v", in: "query", required: true, schema: { type: "string", example: "11.31.0" } }],
          responses: {
            "200": { description: "Support row from Laravel release notes, plus Packagist findings for laravel/framework.", content: { "application/json": { schema: { type: "object" } } } },
            "400": { description: "Missing or invalid version.", content: { "application/json": { schema: errorSchema } } },
            "503": { description: "Both upstreams failed.", content: { "application/json": { schema: errorSchema } } },
          },
        },
      },
      "/api/symfony": {
        get: {
          operationId: "checkSymfonyVersion",
          summary: "Symfony support status from symfony.com and Packagist advisories for one version",
          parameters: [{ name: "v", in: "query", required: true, schema: { type: "string", example: "7.4.10" } }],
          responses: {
            "200": { description: "Support state from symfony.com release data, latest branch patch, plus Packagist findings for symfony/symfony.", content: { "application/json": { schema: { type: "object" } } } },
            "400": { description: "Missing or invalid version.", content: { "application/json": { schema: errorSchema } } },
            "429": { description: "Rate limited.", content: { "application/json": { schema: errorSchema } } },
            "503": { description: "Both upstreams failed.", content: { "application/json": { schema: errorSchema } } },
          },
        },
      },
      "/api/wordpress": {
        get: {
          operationId: "checkWordPressCore",
          summary: "WordPress core status from api.wordpress.org stable-check",
          parameters: [{ name: "v", in: "query", required: true, schema: { type: "string", example: "6.4.2" } }],
          responses: {
            "200": { description: "latest, outdated, or insecure when WordPress.org lists that exact version. No CVE list.", content: { "application/json": { schema: { type: "object" } } } },
            "400": { description: "Missing or invalid version.", content: { "application/json": { schema: errorSchema } } },
          },
        },
      },
      "/api/docker-tag": {
        get: {
          operationId: "resolvePhpDockerTag",
          summary: "Map an official php image tag using docker-library/php versions.json",
          parameters: [{ name: "tag", in: "query", required: true, schema: { type: "string", example: "php:8.3-fpm" } }],
          responses: {
            "200": { description: "Parsed tag and the library's current patch for that branch.", content: { "application/json": { schema: { type: "object" } } } },
            "400": { description: "Missing tag.", content: { "application/json": { schema: errorSchema } } },
          },
        },
      },
      "/api/headers": {
        post: {
          operationId: "checkSecurityHeaders",
          summary: "Fetch response headers for one public URL",
          description: "HTTP and HTTPS on ports 80 and 443 only. Local, private, link-local, and metadata targets are refused, including after redirects. The body is discarded.",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { type: "object", required: ["url"], properties: { url: { type: "string", example: "https://example.com" } } } } },
          },
          responses: {
            "200": { description: "Header findings for the final URL.", content: { "application/json": { schema: { type: "object" } } } },
            "400": { description: "Invalid or blocked URL.", content: { "application/json": { schema: errorSchema } } },
          },
        },
      },
      "/api/extensions": {
        post: {
          operationId: "checkPhpExtensions",
          summary: "Classify php -m names and match PHP runtime CVE description phrases",
          description: "Does not invent extension CVEs or decide whether an extension build is outdated.",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { type: "object", properties: { modules: { type: "string" }, version: { type: "string" } } } } },
          },
          responses: {
            "200": { description: "Per-extension classification.", content: { "application/json": { schema: { type: "object" } } } },
            "400": { description: "No module names, or an invalid PHP version.", content: { "application/json": { schema: errorSchema } } },
          },
        },
      },
      "/api/badge": {
        get: {
          operationId: "phpVersionBadge",
          summary: "SVG status badge for one PHP version",
          parameters: [{ name: "v", in: "query", required: true, schema: { type: "string", example: "8.3.12" } }],
          responses: {
            "200": { description: "SVG image. Counts come from the same check as /api/check.", content: { "image/svg+xml": { schema: { type: "string" } } } },
            "400": { description: "Missing or invalid version. The body is still an SVG.", content: { "image/svg+xml": { schema: { type: "string" } } } },
          },
        },
      },
    },
  };
}
