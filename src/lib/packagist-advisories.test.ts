import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchWithRetry = vi.fn();
vi.mock("@/lib/http", () => ({
  fetchWithRetry: (...args: unknown[]) => fetchWithRetry(...args),
}));

vi.mock("@/lib/cache", async () => {
  const actual = await vi.importActual<typeof import("@/lib/cache")>("@/lib/cache");
  return {
    ...actual,
    // Force load path (no disk cache dependence in unit tests).
    getOrLoad: async ({ load }: { load: () => Promise<unknown> }) => ({
      data: await load(),
      storedAt: new Date().toISOString(),
      stale: false,
    }),
  };
});

import { auditComposerPackages } from "@/lib/packagist-advisories";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("auditComposerPackages", () => {
  beforeEach(() => {
    fetchWithRetry.mockReset();
  });

  it("returns only advisories that match the installed version", async () => {
    fetchWithRetry.mockResolvedValue(
      jsonResponse({
        advisories: {
          "guzzlehttp/psr7": [
            {
              advisoryId: "PKSA-1",
              packageName: "guzzlehttp/psr7",
              title: "Old vuln",
              link: "https://example.test/a",
              cve: "CVE-2022-0001",
              affectedVersions: "<2.12.3",
              severity: "medium",
              reportedAt: "2022-01-01 00:00:00",
              sources: [],
            },
            {
              advisoryId: "PKSA-2",
              packageName: "guzzlehttp/psr7",
              title: "Does not apply",
              link: "https://example.test/b",
              cve: null,
              affectedVersions: ">=9.0.0,<9.0.1",
              severity: "high",
              reportedAt: null,
              sources: [],
            },
          ],
          "safe/package": [],
        },
      }),
    );

    const result = await auditComposerPackages([
      { name: "guzzlehttp/psr7", version: "2.4.0" },
      { name: "safe/package", version: "1.0.0" },
    ]);

    expect(result.advisoryCount).toBe(1);
    expect(result.affectedCount).toBe(1);
    expect(result.findings[0]?.advisoryId).toBe("PKSA-1");
    expect(result.findings[0]?.suggestedFixedVersions).toEqual(["2.12.3"]);
    expect(result.findings[0]?.updateCommand).toBe("composer update guzzlehttp/psr7");
    expect(result.updateCommands).toEqual(["composer update guzzlehttp/psr7"]);
    expect(fetchWithRetry).toHaveBeenCalled();
  });

  it("returns a clean result when nothing matches", async () => {
    fetchWithRetry.mockResolvedValue(
      jsonResponse({
        advisories: {
          "guzzlehttp/psr7": [
            {
              advisoryId: "PKSA-1",
              packageName: "guzzlehttp/psr7",
              title: "Fixed already",
              link: null,
              cve: null,
              affectedVersions: "<2.0.0",
              severity: "low",
              reportedAt: null,
              sources: [],
            },
          ],
        },
      }),
    );

    const result = await auditComposerPackages([{ name: "guzzlehttp/psr7", version: "2.12.3" }]);
    expect(result.advisoryCount).toBe(0);
    expect(result.affectedCount).toBe(0);
    expect(result.findings).toEqual([]);
  });
});
