import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkVersion } from "@/lib/check";
import { DataUnavailableError, type DatasetLoaders } from "@/lib/dataset";
import type { BranchSnapshot } from "@/lib/php-releases";
import { parseAffectedVersion } from "@/lib/ranges";
import type { NormalizedCve, PhpBranch } from "@/lib/types";

// End-to-end tests of checkVersion (dataset loading + cache + evaluation)
// with fake upstream loaders, so no real php.net/NVD/GitHub calls are made.

let cacheDir = "";
const originalCacheDir = process.env.CACHE_DIR;

beforeEach(async () => {
  cacheDir = await mkdtemp(path.join(os.tmpdir(), "psc-check-test-"));
  process.env.CACHE_DIR = cacheDir;
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(async () => {
  vi.restoreAllMocks();
  if (originalCacheDir === undefined) delete process.env.CACHE_DIR;
  else process.env.CACHE_DIR = originalCacheDir;
  await rm(cacheDir, { recursive: true, force: true });
});

const branches: PhpBranch[] = [
  {
    branch: "8.3",
    state: "security",
    initialReleaseDate: "2023-11-23",
    activeSupportEnd: "2025-12-31",
    securitySupportEnd: "2027-12-31",
    latestPatch: "8.3.30",
    releases: ["8.3.10", "8.3.20", "8.3.30"],
  },
];

function mockCve(id: string, lessThan: string): NormalizedCve {
  return {
    id,
    description: "Mock vulnerability used only in tests.",
    published: "2026-01-01T00:00:00.000Z",
    weaknesses: [],
    cvss: { score: 7.5, severity: "HIGH", version: "3.1", vector: "CVSS:3.1/AV:N" },
    references: [],
    phpNetRanges: parseAffectedVersion({ version: "8.3.*", lessThan, status: "affected" }),
    phpNetUnaffectedRanges: [],
    phpNetHasPrecise: true,
    cpeRanges: [],
    prerequisites: [],
  };
}

function loaders(overrides: Partial<DatasetLoaders> = {}): DatasetLoaders {
  return {
    nvd: async () => [mockCve("CVE-2099-0001", "8.3.20")],
    advisories: async () => [],
    changelog: async () => ({}),
    branches: async (): Promise<BranchSnapshot> => ({ branches, warnings: [] }),
    ...overrides,
  };
}

const fail = async (): Promise<never> => {
  throw new Error("upstream timeout");
};

describe("checkVersion", () => {
  it("flags a version inside a php.net affected range and points to the fix", async () => {
    const result = await checkVersion("8.3.10", loaders());
    expect(result.version).toBe("8.3.10");
    expect(result.securityStatus).toBe("vulnerable");
    expect(result.vulnerabilities[0].cveId).toBe("CVE-2099-0001");
    expect(result.counts.total).toBe(1);
    expect(result.minimumFixedVersion).toBe("8.3.20");
    expect(result.stale).toBe(false);
  });

  it("does not flag a version at or above the fixed release", async () => {
    const result = await checkVersion("8.3.20", loaders());
    expect(result.counts.total).toBe(0);
    expect(result.securityStatus).not.toBe("vulnerable");
  });

  it("throws DataUnavailableError when NVD fails and nothing is cached", async () => {
    await expect(checkVersion("8.3.10", loaders({ nvd: fail }))).rejects.toBeInstanceOf(DataUnavailableError);
  });

  it("still answers with warnings when optional sources fail", async () => {
    const result = await checkVersion("8.3.10", loaders({ advisories: fail, changelog: fail }));
    expect(result.counts.total).toBe(1);
    expect(result.warnings.join(" ")).toMatch(/GitHub security advisories/);
    expect(result.warnings.join(" ")).toMatch(/ChangeLog could not be loaded/);
  });

  it("serves the cached NVD copy when the upstream fails later", async () => {
    await checkVersion("8.3.10", loaders());
    const result = await checkVersion("8.3.10", loaders({ nvd: fail }));
    expect(result.counts.total).toBe(1);
  });
});
