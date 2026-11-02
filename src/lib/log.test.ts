import { describe, expect, it, vi } from "vitest";
import { formatLog, log } from "./log";

const at = new Date("2026-11-02T05:30:00.000Z");

describe("formatLog", () => {
  it("writes one JSON line with timestamp, level and event", () => {
    const line = formatLog("info", "check.done", { version: "8.1.12", ms: 12 }, at);
    expect(JSON.parse(line)).toEqual({ ts: at.toISOString(), level: "info", event: "check.done", version: "8.1.12", ms: 12 });
    expect(line).not.toContain("\n");
  });

  it("redacts secret-looking keys at any depth", () => {
    const parsed = JSON.parse(
      formatLog("warn", "x", { token: "abc", nested: { apiKey: "k", Authorization: "Bearer y", ok: 1 } }, at),
    );
    expect(parsed.token).toBe("[redacted]");
    expect(parsed.nested).toEqual({ apiKey: "[redacted]", Authorization: "[redacted]", ok: 1 });
  });

  it("keeps only name and message of errors (no stack)", () => {
    const parsed = JSON.parse(formatLog("error", "x", { error: new TypeError("boom") }, at));
    expect(parsed.error).toEqual({ name: "TypeError", message: "boom" });
  });

  it("trims long strings and deep objects", () => {
    const parsed = JSON.parse(formatLog("info", "x", { s: "a".repeat(1000), d: { a: { b: { c: { e: 1 } } } } }, at));
    expect(parsed.s.length).toBeLessThan(310);
    expect(parsed.d.a.b).toBe("[truncated]");
  });
});

describe("log", () => {
  it("routes errors to console.error", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    log.error("api.check.failed", { route: "/api/check" });
    expect(spy).toHaveBeenCalledOnce();
    expect(JSON.parse(spy.mock.calls[0][0] as string).event).toBe("api.check.failed");
    spy.mockRestore();
  });
});
