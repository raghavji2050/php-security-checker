import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { FEATURED_CVES } from "@/lib/cve-page";
import { fetchPhpRuntimeCves, loadNvdFixture, nvdFixturePath } from "@/lib/nvd";

const original = process.env.NVD_FIXTURE;

afterEach(() => {
  if (original === undefined) delete process.env.NVD_FIXTURE;
  else process.env.NVD_FIXTURE = original;
});

describe("nvdFixturePath", () => {
  it("is off when the env var is unset, empty, or explicitly disabled", () => {
    delete process.env.NVD_FIXTURE;
    expect(nvdFixturePath()).toBeNull();
    process.env.NVD_FIXTURE = "";
    expect(nvdFixturePath()).toBeNull();
    process.env.NVD_FIXTURE = "0";
    expect(nvdFixturePath()).toBeNull();
    process.env.NVD_FIXTURE = "false";
    expect(nvdFixturePath()).toBeNull();
  });

  it("resolves the default flag and the CI path to the committed fixture", () => {
    const expected = path.join(process.cwd(), "e2e", "fixtures", "nvd-php-runtime.json");
    process.env.NVD_FIXTURE = "e2e/fixtures/nvd-php-runtime.json";
    expect(nvdFixturePath()).toBe(expected);
    process.env.NVD_FIXTURE = "1";
    expect(nvdFixturePath()).toBe(expected);
  });
});

describe("loadNvdFixture", () => {
  it("loads the committed CI e2e fixture, including every featured CVE", async () => {
    const cves = await loadNvdFixture(path.resolve("e2e/fixtures/nvd-php-runtime.json"));
    const ids = new Set(cves.map((cve) => cve.id));
    expect(cves.length).toBeGreaterThan(0);
    for (const id of FEATURED_CVES) expect(ids.has(id)).toBe(true);
    expect(ids.has("CVE-2019-9641")).toBe(true);
  });

  it("rejects a file that is not a CVE list", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "nvd-fixture-"));
    const file = path.join(dir, "bad.json");
    await writeFile(file, JSON.stringify({ cves: "nope" }));
    await expect(loadNvdFixture(file)).rejects.toThrow(/not a CVE list/);
  });
});

describe("fetchPhpRuntimeCves", () => {
  it("returns the fixture and does not call the live NVD API when NVD_FIXTURE is set", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "nvd-fixture-"));
    const file = path.join(dir, "nvd.json");
    // Synthetic record for this unit test only; e2e uses official NVD records.
    await writeFile(
      file,
      JSON.stringify({
        cves: [
          {
            id: "CVE-2099-0001",
            description: "Synthetic fixture used to prove the env flag short-circuits the live API.",
            published: null,
            weaknesses: [],
            cvss: null,
            references: [],
            phpNetRanges: [],
            phpNetUnaffectedRanges: [],
            phpNetHasPrecise: false,
            cpeRanges: [],
            prerequisites: [],
          },
        ],
      }),
    );
    process.env.NVD_FIXTURE = file;
    const cves = await fetchPhpRuntimeCves();
    expect(cves).toEqual([
      expect.objectContaining({ id: "CVE-2099-0001" }),
    ]);
  });
});
