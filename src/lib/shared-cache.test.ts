import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getOrLoad, peekCache } from "@/lib/cache";
import { healthReport } from "@/lib/health";
import { readShared, setSharedStore, writeShared, type SharedStore } from "@/lib/shared-cache";

// Fake Runtime Cache shared by "instances". A new CACHE_DIR simulates a cold instance
// (empty /tmp); memory entries are keyed by CACHE_DIR too, so they don't leak across.
function fakeStore() {
  const items = new Map<string, unknown>();
  const store: SharedStore & { items: Map<string, unknown> } = {
    items,
    get: vi.fn(async (key: string) => items.get(key) ?? null),
    set: vi.fn(async (key: string, value: unknown) => {
      items.set(key, value);
    }),
  };
  return store;
}

const dirs: string[] = [];
async function coldInstance() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "psc-shared-test-"));
  dirs.push(dir);
  process.env.CACHE_DIR = dir;
}

const originalCacheDir = process.env.CACHE_DIR;

beforeEach(async () => {
  await coldInstance();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(async () => {
  setSharedStore(undefined);
  vi.restoreAllMocks();
  if (originalCacheDir === undefined) delete process.env.CACHE_DIR;
  else process.env.CACHE_DIR = originalCacheDir;
  await Promise.all(dirs.splice(0).map((d) => rm(d, { recursive: true, force: true })));
});

describe("shared cache tier", () => {
  it("round-trips a gzipped envelope", async () => {
    const store = fakeStore();
    setSharedStore(store);
    const envelope = { storedAt: new Date().toISOString(), ttlMs: 60_000, data: { cves: ["CVE-1"] } };
    expect(await writeShared("k", envelope)).toBe(true);
    expect(typeof store.items.get("k")).toBe("string");
    expect(await readShared("k")).toEqual(envelope);
  });

  it("ignores corrupt or foreign values instead of throwing", async () => {
    const store = fakeStore();
    store.items.set("bad", "not-gzip");
    store.items.set("obj", { storedAt: 1 });
    setSharedStore(store);
    expect(await readShared("bad")).toBeNull();
    expect(await readShared("obj")).toBeNull();
  });

  it("is a no-op when disabled", async () => {
    setSharedStore(null);
    expect(await writeShared("k", { storedAt: new Date().toISOString(), ttlMs: 1, data: 1 })).toBe(false);
    expect(await readShared("k")).toBeNull();
  });

  it("lets a cold instance reuse another instance's fresh data without calling upstream", async () => {
    const store = fakeStore();
    setSharedStore(store);
    const first = vi.fn(async () => ["fresh"]);
    await getOrLoad({ key: "nvd", ttlMs: 60_000, load: first, allowStale: true });
    expect(first).toHaveBeenCalledTimes(1);

    await coldInstance();
    const second = vi.fn(async () => ["should-not-run"]);
    const result = await getOrLoad({ key: "nvd", ttlMs: 60_000, load: second, allowStale: true });
    expect(second).not.toHaveBeenCalled();
    expect(result.data).toEqual(["fresh"]);
    expect(result.stale).toBe(false);
  });

  it("falls back to stale shared data when the upstream fails on a cold instance", async () => {
    const store = fakeStore();
    setSharedStore(store);
    const old = new Date(Date.now() - 10 * 60_000).toISOString();
    await writeShared("nvd", { storedAt: old, ttlMs: 60_000, data: ["old"] });

    const result = await getOrLoad({
      key: "nvd",
      ttlMs: 60_000,
      load: async () => {
        throw new Error("NVD down");
      },
      allowStale: true,
    });
    expect(result).toEqual({ data: ["old"], storedAt: old, stale: true });
  });

  it("still works when the shared store errors", async () => {
    setSharedStore({
      get: async () => {
        throw new Error("timeout");
      },
      set: async () => {
        throw new Error("timeout");
      },
    });
    const result = await getOrLoad({ key: "nvd", ttlMs: 60_000, load: async () => [1], allowStale: true });
    expect(result.data).toEqual([1]);
  });
});

describe("health report", () => {
  it("is degraded with nothing cached and never loads upstream data", async () => {
    setSharedStore(null);
    const report = await healthReport();
    expect(report.status).toBe("degraded");
    expect(report.sources.every((s) => !s.cached && s.retrievedAt === null)).toBe(true);
  });

  it("is ok when NVD data is fresh and reports its age", async () => {
    setSharedStore(null);
    const now = Date.now();
    await getOrLoad({ key: "nvd-php-runtime-v1", ttlMs: 60_000, load: async () => [], allowStale: true });
    const report = await healthReport(now + 5_000);
    const nvd = report.sources.find((s) => s.required)!;
    expect(report.status).toBe("ok");
    expect(nvd.fresh).toBe(true);
    expect(nvd.ageSeconds).toBeGreaterThanOrEqual(4);
    expect(await peekCache("missing")).toBeNull();
  });
});
