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
    const page = await fetchJson<NvdPage>(url.toString(), { headers }, { timeoutMs: 60_000, retries: 3 });
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
