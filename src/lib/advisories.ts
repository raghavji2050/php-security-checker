import { fetchWithRetry } from "@/lib/http";
import { parseGithubRanges } from "@/lib/ranges";
import type { CvssMetric, NormalizedAdvisory } from "@/lib/types";

type RawAdvisory = {
  ghsa_id?: string;
  cve_id?: string | null;
  summary?: string;
  description?: string;
  severity?: string | null;
  html_url?: string;
  state?: string;
  withdrawn_at?: string | null;
  cwe_ids?: string[] | null;
  cvss_severities?: {
    cvss_v4?: { vector_string?: string | null; score?: number | null };
    cvss_v3?: { vector_string?: string | null; score?: number | null };
  };
  vulnerabilities?: {
    vulnerable_version_range?: string;
    patched_versions?: string | null;
  }[];
};

function nextPage(link: string | null): string | null {
  if (!link) return null;
  for (const part of link.split(",")) {
    const match = /<([^>]+)>;\s*rel="next"/.exec(part);
    if (match) return match[1];
  }
  return null;
}

function advisoryCvss(raw: RawAdvisory): CvssMetric | null {
  const v4 = raw.cvss_severities?.cvss_v4;
  if (v4 && typeof v4.score === "number") {
    return {
      score: v4.score,
      severity: null,
      version: "4.0",
      vector: v4.vector_string ?? null,
    };
  }
  const v3 = raw.cvss_severities?.cvss_v3;
  if (v3 && typeof v3.score === "number") {
    return {
      score: v3.score,
      severity: null,
      version: "3.1",
      vector: v3.vector_string ?? null,
    };
  }
  return null;
}

export function parseGithubAdvisory(raw: RawAdvisory): NormalizedAdvisory | null {
  if (!raw.ghsa_id || !raw.html_url) return null;
  if (raw.withdrawn_at) return null;
  if (raw.state && raw.state !== "published") return null;
  return {
    ghsaId: raw.ghsa_id,
    cveId: raw.cve_id ?? null,
    summary: raw.summary ?? "",
    description: raw.description ?? raw.summary ?? "",
    severity: raw.severity ?? null,
    cvss: advisoryCvss(raw),
    htmlUrl: raw.html_url,
    cwes: (raw.cwe_ids ?? []).map((id) => id.toUpperCase()),
    ranges: parseGithubRanges(raw.vulnerabilities ?? []),
  };
}

export async function fetchPhpAdvisories(): Promise<NormalizedAdvisory[]> {
  const headers: Record<string, string> = {
    accept: "application/vnd.github+json",
    "x-github-api-version": "2022-11-28",
  };
  if (process.env.GITHUB_TOKEN) {
    headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  const advisories: NormalizedAdvisory[] = [];
  let url: string | null = "https://api.github.com/repos/php/php-src/security-advisories?state=published&per_page=100";
  let pages = 0;
  while (url && pages < 10) {
    const response = await fetchWithRetry(url, { headers }, { timeoutMs: 30_000, retries: 3 });
    if (!response.ok) {
      throw new Error(`GitHub advisories returned HTTP ${response.status}`);
    }
    const page = (await response.json()) as RawAdvisory[];
    if (!Array.isArray(page)) break;
    for (const item of page) {
      const parsed = parseGithubAdvisory(item);
      if (parsed) advisories.push(parsed);
    }
    url = nextPage(response.headers.get("link"));
    pages += 1;
  }
  return advisories;
}
