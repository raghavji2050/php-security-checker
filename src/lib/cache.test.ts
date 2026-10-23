import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { CacheMissError, getOrLoad, writeCache } from "@/lib/cache";
import { DataUnavailableError, loadDataset } from "@/lib/dataset";
import type { PhpBranch } from "@/lib/types";

const directories: string[] = [];

async function tempCache(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "psc-cache-"));
  directories.push(directory);
  process.env.CACHE_DIR = directory;
  return directory;
}

afterEach(async () => {
  delete process.env.CACHE_DIR;
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

const branch: PhpBranch = {
  branch: "8.5",
  state: "active",
  initialReleaseDate: "2025-11-20",
  activeSupportEnd: "2027-12-31",
  securitySupportEnd: "2029-12-31",
  latestPatch: "8.5.12",
  releases: ["8.5.12"],
};

describe("response cache", () => {
  it("serves a fresh cached payload without calling the loader again", async () => {
    await tempCache();
    let calls = 0;
    const load = async () => {
      calls += 1;
      return { ok: true };
    };
    const first = await getOrLoad({ key: "sample", ttlMs: 60_000, load, allowStale: true });
    const second = await getOrLoad({ key: "sample", ttlMs: 60_000, load, allowStale: true });
    expect(calls).toBe(1);
    expect(second.stale).toBe(false);
    expect(second.data).toEqual(first.data);
  });

  it("serves a stale cached payload when the loader fails", async () => {
    await tempCache();
    await writeCache("sample", { ok: true }, 1_000, new Date(Date.now() - 86_400_000).toISOString());
    const result = await getOrLoad({
      key: "sample",
      ttlMs: 1_000,
      load: async () => {
        throw new Error("nvd down");
      },
      allowStale: true,
    });
    expect(result.stale).toBe(true);
    expect(result.data).toEqual({ ok: true });
    expect(result.storedAt).not.toBe(new Date().toISOString());
  });

  it("fails closed when NVD fails and nothing is cached", async () => {
    await tempCache();
    await expect(
      getOrLoad({
        key: "missing",
        ttlMs: 1_000,
        load: async () => {
          throw new Error("nvd down");
        },
        allowStale: true,
      }),
    ).rejects.toBeInstanceOf(CacheMissError);

    await expect(
      loadDataset({
        nvd: async () => {
          throw new Error("nvd down");
        },
        advisories: async () => [],
        changelog: async () => ({}),
        branches: async () => ({ branches: [branch], warnings: [] }),
      }),
    ).rejects.toBeInstanceOf(DataUnavailableError);
  });

  it("labels a failed refresh of cached NVD data as stale", async () => {
    await tempCache();
    await writeCache("nvd-php-runtime-v1", [], 1_000, "2026-01-01T00:00:00.000Z");
    const dataset = await loadDataset({
      nvd: async () => {
        throw new Error("nvd down");
      },
      advisories: async () => [],
      changelog: async () => ({}),
      branches: async () => ({ branches: [branch], warnings: [] }),
    });
    expect(dataset.stale).toBe(true);
    expect(dataset.retrievedAt).toBe("2026-01-01T00:00:00.000Z");
    expect(dataset.warnings.some((warning) => warning.toLowerCase().includes("stale"))).toBe(true);
  });
});
