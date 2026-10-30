import { describe, expect, it } from "vitest";
import { rateLimit, resetRateLimits } from "@/lib/rate-limit";

describe("rateLimit", () => {
  it("blocks the address after the limit inside the window", () => {
    resetRateLimits();
    const now = 1_000_000;
    expect(rateLimit("check:203.0.113.5", 2, 60_000, now).ok).toBe(true);
    expect(rateLimit("check:203.0.113.5", 2, 60_000, now + 10).ok).toBe(true);
    const blocked = rateLimit("check:203.0.113.5", 2, 60_000, now + 20);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    expect(rateLimit("check:203.0.113.6", 2, 60_000, now + 20).ok).toBe(true);
  });
});

describe("rateLimit extras", () => {
  it("reports remaining requests and headers", async () => {
    const { rateLimitHeaders } = await import("@/lib/rate-limit");
    resetRateLimits();
    const first = rateLimit("k", 3, 60_000, 0);
    expect(first.remaining).toBe(2);
    expect(rateLimitHeaders(first)).toEqual({ "x-ratelimit-limit": "3", "x-ratelimit-remaining": "2" });
  });

  it("frees memory: never tracks more than the key cap", async () => {
    const { trackedKeyCount } = await import("@/lib/rate-limit");
    resetRateLimits();
    for (let i = 0; i < 6000; i++) rateLimit(`ip:${i}`, 5, 60_000, i);
    expect(trackedKeyCount()).toBeLessThanOrEqual(5000);
  });

  it("prefers the platform client IP header", async () => {
    const { clientIp } = await import("@/lib/rate-limit");
    const request = new Request("https://example.test/", {
      headers: { "x-vercel-forwarded-for": "198.51.100.7", "x-forwarded-for": "203.0.113.9, 10.0.0.1" },
    });
    expect(clientIp(request)).toBe("198.51.100.7");
    expect(clientIp(new Request("https://example.test/"))).toBe("local");
  });
});
