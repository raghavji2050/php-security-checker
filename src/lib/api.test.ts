import { beforeEach, describe, expect, it, vi } from "vitest";

const checkVersion = vi.fn();
vi.mock("@/lib/check", () => ({ checkVersion: (v: string) => checkVersion(v) }));

import { GET, OPTIONS } from "@/app/api/check/route";
import { DataUnavailableError } from "@/lib/dataset";
import { buildOpenApiSpec } from "@/lib/openapi";
import { resetRateLimits } from "@/lib/rate-limit";

const req = (qs: string, ip = "1.2.3.4") =>
  new Request(`https://example.test/api/check${qs}`, { headers: { "x-forwarded-for": ip } });

describe("GET /api/check", () => {
  beforeEach(() => {
    resetRateLimits();
    checkVersion.mockReset();
  });

  it("returns the result for ?v= with CORS", async () => {
    checkVersion.mockResolvedValue({ version: "8.1.12" });
    const res = await GET(req("?v=8.1.12"));
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect(await res.json()).toEqual({ version: "8.1.12" });
    expect(checkVersion).toHaveBeenCalledWith("8.1.12");
  });

  it("still accepts the legacy ?version= parameter", async () => {
    checkVersion.mockResolvedValue({ version: "8.3.0" });
    const res = await GET(req("?version=8.3.0"));
    expect(res.status).toBe(200);
  });

  it("rejects a missing version", async () => {
    const res = await GET(req(""));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("missing_version");
    expect(checkVersion).not.toHaveBeenCalled();
  });

  it.each(["8.1", "8.1.x", "v8.1.12", "08.1.1", "8.1.12.1", "1".repeat(40)])("rejects %s", async (v) => {
    const res = await GET(req(`?v=${encodeURIComponent(v)}`));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("invalid_version");
    expect(checkVersion).not.toHaveBeenCalled();
  });

  it("returns 503 when upstream data is unavailable", async () => {
    checkVersion.mockRejectedValue(new DataUnavailableError("NVD unavailable"));
    const res = await GET(req("?v=8.2.1"));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.code).toBe("data_unavailable");
    expect(body.securityStatus).toBe("unable_to_verify");
  });

  it("returns a generic 500 without leaking internal error details", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    checkVersion.mockRejectedValue(new Error("secret internal path /var/task/x"));
    const res = await GET(req("?v=8.2.1"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.code).toBe("internal_error");
    expect(JSON.stringify(body)).not.toContain("/var/task");
    spy.mockRestore();
  });

  it("sends rate-limit headers on normal responses", async () => {
    checkVersion.mockResolvedValue({});
    const res = await GET(req("?v=8.2.1", "5.5.5.5"));
    expect(res.headers.get("x-ratelimit-limit")).toBe("20");
    expect(Number(res.headers.get("x-ratelimit-remaining"))).toBe(19);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("returns 429 with Retry-After after too many requests", async () => {
    checkVersion.mockResolvedValue({});
    for (let i = 0; i < 20; i += 1) await GET(req("?v=8.2.1", "9.9.9.9"));
    const res = await GET(req("?v=8.2.1", "9.9.9.9"));
    expect(res.status).toBe(429);
    expect(Number(res.headers.get("retry-after"))).toBeGreaterThan(0);
  });

  it("answers CORS preflight", () => {
    const res = OPTIONS();
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-methods")).toContain("GET");
  });
});

describe("OpenAPI spec", () => {
  it("describes /api/check with a required v parameter", () => {
    const spec = buildOpenApiSpec();
    expect(spec.openapi).toMatch(/^3\./);
    const op = spec.paths["/api/check"].get;
    expect(op.operationId).toBe("checkPhpVersion");
    expect(op.parameters[0]).toMatchObject({ name: "v", in: "query", required: true });
    expect(Object.keys(op.responses)).toEqual(expect.arrayContaining(["200", "400", "429", "503"]));
  });
});
