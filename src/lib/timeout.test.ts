import { describe, expect, it } from "vitest";
import { TimeoutError, withTimeout } from "@/lib/timeout";

describe("withTimeout", () => {
  it("returns the value when the promise settles in time", async () => {
    await expect(withTimeout(Promise.resolve(42), 50)).resolves.toBe(42);
  });
  it("rejects with TimeoutError when too slow", async () => {
    const slow = new Promise((resolve) => setTimeout(resolve, 200));
    await expect(withTimeout(slow, 10)).rejects.toBeInstanceOf(TimeoutError);
  });
  it("passes through the original rejection", async () => {
    await expect(withTimeout(Promise.reject(new Error("boom")), 50)).rejects.toThrow("boom");
  });
});
