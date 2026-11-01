import { SITE_URL } from "@/lib/site";

const errorSchema = {
  type: "object",
  required: ["error", "code", "status"],
  properties: {
    error: { type: "string", description: "Human-readable message." },
    code: {
      type: "string",
      enum: ["missing_version", "invalid_version", "rate_limited", "data_unavailable", "internal_error"],
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
                          critical: { type: "integer" },
                          high: { type: "integer" },
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
    },
  };
}
