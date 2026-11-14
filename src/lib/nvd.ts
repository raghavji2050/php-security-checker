import { readFile } from "node:fs/promises";
import path from "node:path";
import { fetchJson } from "@/lib/http";
import { parseNvdCve } from "@/lib/nvd-parse";
import type { NormalizedCve } from "@/lib/types";

const NVD_URL = "https://services.nvd.nist.gov/rest/json/cves/2.0";
const PHP_RUNTIME_CPE = "cpe:2.3:a:php:php:*:*:*:*:*:*:*:*";

type NvdPage = {
  resultsPerPage?: number;
  startIndex?: number;
  totalResults?: number;
  vulnerabilities?: unknown[];
};

const DEFAULT_NVD_FIXTURE = path.join(process.cwd(), "e2e", "fixtures", "nvd-php-runtime.json");

/**
 * Path to a local NVD fixture, or null to use the live API.
 * Set NVD_FIXTURE only in CI e2e (the default fixture path, or "1").
 * Unset in production; this function then returns null and behaviour is unchanged.
 */
export function nvdFixturePath(): string | null {
  const raw = process.env.NVD_FIXTURE?.trim();
  if (!raw || raw === "0" || raw === "false") return null;
  if (raw === "1" || raw === "true" || raw === "e2e/fixtures/nvd-php-runtime.json") {
    return DEFAULT_NVD_FIXTURE;
  }
  return path.isAbsolute(raw) ? raw : path.resolve(/*turbopackIgnore: true*/ process.cwd(), raw);
}

function cveRecords(parsed: unknown): unknown[] | null {
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === "object" && "cves" in parsed && Array.isArray(parsed.cves)) {
    return parsed.cves;
  }
  return null;
}

async function readFixtureFile(file: string): Promise<string> {
  // The default path is statically scoped so Turbopack traces only e2e/fixtures,
  // not the whole project. Custom paths are for unit tests.
  if (file === DEFAULT_NVD_FIXTURE) {
    return readFile(path.join(process.cwd(), "e2e", "fixtures", "nvd-php-runtime.json"), "utf8");
  }
  return readFile(/*turbopackIgnore: true*/ file, "utf8");
}

export async function loadNvdFixture(file: string): Promise<NormalizedCve[]> {
  const records = cveRecords(JSON.parse(await readFixtureFile(file)));
  if (!records) {
    throw new Error(`NVD fixture is not a CVE list: ${file}`);
  }
  const cves: NormalizedCve[] = [];
  for (const item of records) {
    if (!item || typeof item !== "object" || typeof (item as NormalizedCve).id !== "string") {
      throw new Error(`NVD fixture has an invalid record in ${file}`);
    }
    cves.push(item as NormalizedCve);
  }
  if (cves.length === 0) {
    throw new Error(`NVD fixture is empty: ${file}`);
  }
  return cves;
}

let lastRequestAt = 0;

function gapMs(): number {
  return process.env.NVD_API_KEY ? 700 : 6500;
}

async function pace(): Promise<void> {
  const wait = Math.max(0, lastRequestAt + gapMs() - Date.now());
  lastRequestAt = Date.now() + wait;
  if (wait > 0) {
    await new Promise((resolve) => setTimeout(resolve, wait));
  }
}

export async function fetchPhpRuntimeCves(): Promise<NormalizedCve[]> {
  const fixture = nvdFixturePath();
  if (fixture) {
    return loadNvdFixture(fixture);
  }

  const pageSize = 200;
  const collected: NormalizedCve[] = [];
  let startIndex = 0;
  let total = Number.POSITIVE_INFINITY;

  while (startIndex < total) {
    await pace();
    const url = new URL(NVD_URL);
    url.searchParams.set("virtualMatchString", PHP_RUNTIME_CPE);
    url.searchParams.set("resultsPerPage", String(pageSize));
    url.searchParams.set("startIndex", String(startIndex));
    url.searchParams.set("noRejected", "");
    const headers: Record<string, string> = {};
    if (process.env.NVD_API_KEY) headers.apiKey = process.env.NVD_API_KEY;
    const page = await fetchJson<NvdPage>(url.toString(), { headers }, { timeoutMs: 60_000, retries: 3, deadlineMs: 90_000 });
    const batch = page.vulnerabilities ?? [];
    for (const item of batch) {
      const parsed = parseNvdCve(item);
      if (parsed) collected.push(parsed);
    }
    total = page.totalResults ?? startIndex + batch.length;
    const step = page.resultsPerPage || batch.length || pageSize;
    startIndex += step;
    if (batch.length === 0) break;
  }

  return collected;
}
