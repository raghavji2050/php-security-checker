import type { ExplorerRow } from "@/lib/cve-explorer";
import type { SourceInfo } from "@/lib/types";

export const OPEN_DATA_SCHEMA_VERSION = 1;
export const NVD_NOTICE = "This product uses the NVD API but is not endorsed or certified by the NVD.";

export type OpenDataCve = {
  id: string;
  published: string | null;
  severity: string;
  cvssScore: number | null;
  cvssVersion: string | null;
  branches: string[];
  description: string;
  url: string;
  nvdUrl: string;
};

export type OpenDataDocument = {
  schemaVersion: number;
  title: string;
  description: string;
  generatedFrom: string;
  lastDataUpdate: string | null;
  stale: boolean;
  count: number;
  attribution: { notice: string; sources: { name: string; url: string; retrievedAt: string | null }[] };
  fields: Record<keyof OpenDataCve, string>;
  cves: OpenDataCve[];
};

/** Stable, attributed open-data JSON of PHP interpreter CVEs (NVD data only), newest first. */
export function buildOpenData(options: {
  rows: ExplorerRow[];
  siteUrl: string;
  retrievedAt: string | null;
  stale: boolean;
  sources: SourceInfo[];
}): OpenDataDocument {
  const base = options.siteUrl.replace(/\/$/, "");
  const cves = [...options.rows]
    .sort((a, b) => (b.published ?? "").localeCompare(a.published ?? "") || b.id.localeCompare(a.id))
    .map((r) => ({
      id: r.id,
      published: r.published,
      severity: r.severity,
      cvssScore: r.score,
      cvssVersion: r.cvssVersion,
      branches: [...r.branches],
      description: r.description,
      url: `${base}/cve/${r.id}`,
      nvdUrl: `https://nvd.nist.gov/vuln/detail/${r.id}`,
    }));
  return {
    schemaVersion: OPEN_DATA_SCHEMA_VERSION,
    title: "PHP interpreter CVEs (NIST NVD)",
    description: "Every CVE NIST NVD links to the PHP interpreter (cpe:2.3:a:php:php), rejected records excluded. Free to reuse with attribution to NVD and a link back.",
    generatedFrom: `${base}/cves`,
    lastDataUpdate: options.retrievedAt,
    stale: options.stale,
    count: cves.length,
    attribution: {
      notice: NVD_NOTICE,
      sources: options.sources.filter((s) => /nvd/i.test(s.name)).map((s) => ({ name: s.name, url: s.url, retrievedAt: s.retrievedAt })),
    },
    fields: {
      id: "CVE identifier.",
      published: "NVD publish date (YYYY-MM-DD), or null.",
      severity: "CVSS v3.x base severity, or v2 when that is all NVD has; UNRATED when none.",
      cvssScore: "CVSS base score, or null.",
      cvssVersion: "CVSS version the score came from, or null.",
      branches: "PHP MAJOR.MINOR branches derived only from NVD version ranges; empty means unknown.",
      description: "English description from NVD.",
      url: "Page on this site with fixed versions and an 'am I affected?' check.",
      nvdUrl: "Official NVD record.",
    },
    cves,
  };
}
