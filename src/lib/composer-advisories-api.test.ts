import { beforeEach, describe, expect, it, vi } from "vitest";

const auditComposerPackages = vi.fn();
vi.mock("@/lib/packagist-advisories", () => ({
  auditComposerPackages: (...args: unknown[]) => auditComposerPackages(...args),
  MAX_API_PACKAGES: 1500,
}));

import { GET, OPTIONS, POST } from "@/app/api/composer-advisories/route";
import { resetRateLimits } from "@/lib/rate-limit";

const post = (body: unknown, ip = "1.2.3.4") =>
  new Request("https://example.test/api/composer-advisories", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });

describe("POST /api/composer-advisories", () => {
  beforeEach(() => {
    resetRateLimits();
    auditComposerPackages.mockReset();
  });

  it("accepts a packages map and returns the audit", async () => {
    auditComposerPackages.mockResolvedValue({
      checkedAt: "2026-11-06T00:00:00.000Z",
      packageCount: 1,
      affectedCount: 0,
      advisoryCount: 0,
      findings: [],
      updateCommands: [],
      stale: false,
      source: "packagist",
    });
    const res = await POST(post({ packages: { "guzzlehttp/psr7": "2.12.3" } }));
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    const body = await res.json();
    expect(body.advisoryCount).toBe(0);
    expect(auditComposerPackages).toHaveBeenCalled();
  });

  it("rejects missing packages", async () => {
    const res = await POST(post({}));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("missing_packages");
  });

  it("GET explains the POST contract", async () => {
    const res = await GET();
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("missing_packages");
  });

  it("OPTIONS allows POST", async () => {
    const res = await OPTIONS();
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-methods")).toContain("POST");
  });
});
