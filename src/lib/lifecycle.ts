import { compareBranches } from "@/lib/version";
import type { PhpBranch, SupportState } from "@/lib/types";

export type BranchOverride = {
  stable?: string;
  security?: string;
  date?: string;
};

const MONTHS: Record<string, string> = {
  jan: "01",
  feb: "02",
  mar: "03",
  apr: "04",
  may: "05",
  jun: "06",
  jul: "07",
  aug: "08",
  sep: "09",
  oct: "10",
  nov: "11",
  dec: "12",
};

export function parsePublishedDate(value: string): string | null {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const match = /^(\d{1,2}) ([A-Za-z]{3}) (\d{4})$/.exec(value.trim());
  if (!match) return null;
  const month = MONTHS[match[2].toLowerCase()];
  if (!month) return null;
  return `${match[3]}-${month}-${match[1].padStart(2, "0")}`;
}

export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addYears(iso: string, years: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year + years, month - 1, day));
  return isoDate(date);
}

function endOfYear(iso: string): string {
  return `${iso.slice(0, 4)}-12-31`;
}

/**
 * Same schedule php.net uses in branches.inc:
 * active support is two years (extended to 31 Dec from 8.2),
 * security support is three years before 8.1 and four years snapped to 31 Dec from 8.1.
 * Explicit overrides from branches.inc win.
 */
export function computeSupportDates(
  branch: string,
  initialReleaseDate: string,
  overrides: BranchOverride = {},
  finalReleaseDate: string | null = null,
): { activeSupportEnd: string | null; securitySupportEnd: string | null } {
  const initial = overrides.date ?? initialReleaseDate;
  let activeSupportEnd: string | null = overrides.stable ?? addYears(initial, 2);
  if (!overrides.stable && compareBranches(branch, "8.2") >= 0) {
    activeSupportEnd = endOfYear(activeSupportEnd);
  }

  let securitySupportEnd: string | null;
  if (overrides.security) {
    securitySupportEnd = overrides.security;
  } else if (compareBranches(branch, "5.3") < 0) {
    securitySupportEnd = finalReleaseDate;
  } else if (compareBranches(branch, "8.1") < 0) {
    securitySupportEnd = addYears(initial, 3);
  } else {
    securitySupportEnd = endOfYear(addYears(initial, 4));
  }

  return { activeSupportEnd, securitySupportEnd };
}

export function supportStateOn(today: string, branch: Pick<PhpBranch, "activeSupportEnd" | "securitySupportEnd">): SupportState {
  const securityEnd = branch.securitySupportEnd;
  if (!securityEnd) return "unknown";
  if (today > securityEnd) return "eol";
  if (branch.activeSupportEnd && today > branch.activeSupportEnd) return "security";
  return "active";
}

export function supportLabel(state: SupportState): string {
  switch (state) {
    case "active":
      return "Active support";
    case "security":
      return "Security fixes only";
    case "eol":
      return "End of life";
    default:
      return "Support status unknown";
  }
}

export type PublishedBranch = {
  branch: string;
  state?: SupportState;
  initialReleaseDate?: string | null;
  activeSupportEnd?: string | null;
  securitySupportEnd?: string | null;
  latestPatch?: string | null;
};

export function parseSupportedVersionsHtml(html: string): PublishedBranch[] {
  const branches: PublishedBranch[] = [];
  const rows = html.matchAll(/<tr class="(stable|security|eol)">([\s\S]*?)<\/tr>/gi);
  for (const row of rows) {
    const state: SupportState = row[1] === "stable" ? "active" : row[1] === "security" ? "security" : "eol";
    const branch = /<a[^>]*>\s*(\d+\.\d+)\s*<\/a>/i.exec(row[2])?.[1];
    if (!branch) continue;
    const dates = [...row[2].matchAll(/<td>\s*(\d{1,2} [A-Za-z]{3} \d{4})\s*<\/td>/g)].map((match) =>
      parsePublishedDate(match[1]),
    );
    branches.push({
      branch,
      state,
      initialReleaseDate: dates[0] ?? null,
      activeSupportEnd: dates[1] ?? null,
      securitySupportEnd: dates[2] ?? null,
    });
  }
  return branches;
}

export function parseEolHtml(html: string): PublishedBranch[] {
  const branches: PublishedBranch[] = [];
  const rows = html.matchAll(/<tr>([\s\S]*?)<\/tr>/gi);
  for (const row of rows) {
    const body = row[1];
    const branch = /<td>\s*(\d+\.\d+)\s*<\/td>/i.exec(body)?.[1];
    if (!branch) continue;
    const date = /(\d{1,2} [A-Za-z]{3} \d{4})/.exec(body)?.[1];
    const latest = /releases#(\d+\.\d+\.\d+)/.exec(body)?.[1] ?? null;
    branches.push({
      branch,
      state: "eol",
      securitySupportEnd: date ? parsePublishedDate(date) : null,
      latestPatch: latest,
    });
  }
  return branches;
}

export function parseBranchOverrides(source: string): Record<string, BranchOverride> {
  const overrides: Record<string, BranchOverride> = {};
  const blocks = source.matchAll(/'(\d+\.\d+)'\s*=>\s*\[([\s\S]*?)\]/g);
  for (const block of blocks) {
    const body = block[2];
    const override: BranchOverride = {};
    const stable = /'stable'\s*=>\s*'(\d{4}-\d{2}-\d{2})'/.exec(body)?.[1];
    const security = /'security'\s*=>\s*'(\d{4}-\d{2}-\d{2})'/.exec(body)?.[1];
    const date = /'date'\s*=>\s*'(\d{4}-\d{2}-\d{2})'/.exec(body)?.[1];
    if (stable) override.stable = stable;
    if (security) override.security = security;
    if (date) override.date = date;
    if (override.stable || override.security || override.date) overrides[block[1]] = override;
  }
  return overrides;
}
