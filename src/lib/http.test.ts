import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchJson, fetchWithRetry } from "@/lib/http";

afterEach(() => {
  vi.unstubAllGlobals();
});

function hangingFetch() {
  return vi.fn((_url: string, init?: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
    }),
  );
}

describe("upstream http helpers", () => {
  it("gives up on a hanging upstream within the total deadline", async () => {
    const fetchMock = hangingFetch();
    vi.stubGlobal("fetch", fetchMock);
    const started = Date.now();
    await expect(
      fetchJson("https://services.nvd.nist.gov/x", {}, { retries: 4, timeoutMs: 10_000, deadlineMs: 300 }),
    ).rejects.toThrow();
    expect(Date.now() - started).toBeLessThan(2_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not wait out a Retry-After longer than the remaining budget", async () => {
    const fetchMock = vi.fn(async () => new Response("busy", { status: 503, headers: { "retry-after": "60" } }));
    vi.stubGlobal("fetch", fetchMock);
    const started = Date.now();
    await expect(fetchWithRetry("https://www.php.net/x", {}, { retries: 3, deadlineMs: 1_000 })).rejects.toThrow(
      "HTTP 503",
    );
    expect(Date.now() - started).toBeLessThan(1_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns parsed JSON when the upstream answers", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ ok: true })));
    await expect(fetchJson<{ ok: boolean }>("https://www.php.net/releases/index.php")).resolves.toEqual({ ok: true });
  });

  it("does not retry a 404", async () => {
    const fetchMock = vi.fn(async () => new Response("missing", { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchJson("https://www.php.net/missing")).rejects.toThrow("HTTP 404");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
