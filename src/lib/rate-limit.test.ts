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
