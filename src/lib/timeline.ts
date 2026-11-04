import { compareBranches } from "@/lib/version";
import type { PhpBranch, SupportState } from "@/lib/types";

/** One horizontal bar on the support timeline, positioned in percent of the chart width. */
export type TimelineRow = {
  branch: string;
  state: SupportState;
  latestPatch: string | null;
  initialReleaseDate: string;
  activeSupportEnd: string | null;
  securitySupportEnd: string | null;
  /** Offset and width of the active-support segment. */
  active: { left: number; width: number };
  /** Offset and width of the security-only segment (width 0 when unknown). */
  security: { left: number; width: number };
};

export type Timeline = {
  start: string;
  end: string;
  /** Position of "today" in percent, or null when outside the range. */
  today: number | null;
  years: { year: number; left: number }[];
  rows: TimelineRow[];
};

function dayNumber(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return Date.UTC(y, m - 1, d) / 86_400_000;
}

const round = (n: number) => Math.round(n * 100) / 100;

/**
 * Builds chart geometry from official branch data. Only branches with a published (or schedule-derived)
 * initial release date are drawn; branches whose security support ended before `sinceYear` are left out.
 */
export function buildTimeline(branches: PhpBranch[], today: string, sinceYear = 2015): Timeline | null {
  const usable = branches
    .filter((b): b is PhpBranch & { initialReleaseDate: string } => Boolean(b.initialReleaseDate))
    .filter((b) => {
      const end = b.securitySupportEnd ?? b.activeSupportEnd;
      return !end || Number(end.slice(0, 4)) >= sinceYear;
    })
    .sort((a, b) => compareBranches(b.branch, a.branch));
  if (usable.length === 0) return null;

  const startYear = Math.min(...usable.map((b) => Number(b.initialReleaseDate.slice(0, 4))));
  const lastDate = usable
    .flatMap((b) => [b.securitySupportEnd, b.activeSupportEnd, b.initialReleaseDate])
    .filter((v): v is string => Boolean(v))
    .reduce((max, v) => (v > max ? v : max), today);
  const endYear = Number(lastDate.slice(0, 4)) + 1;
  const start = `${startYear}-01-01`;
  const end = `${endYear}-01-01`;
  const from = dayNumber(start);
  const span = dayNumber(end) - from;
  const pos = (iso: string) => Math.min(100, Math.max(0, ((dayNumber(iso) - from) / span) * 100));

  const rows = usable.map((b) => {
    const begin = pos(b.initialReleaseDate);
    const activeEnd = pos(b.activeSupportEnd ?? b.securitySupportEnd ?? b.initialReleaseDate);
    const securityEnd = b.securitySupportEnd ? pos(b.securitySupportEnd) : activeEnd;
    return {
      branch: b.branch,
      state: b.state,
      latestPatch: b.latestPatch,
      initialReleaseDate: b.initialReleaseDate,
      activeSupportEnd: b.activeSupportEnd,
      securitySupportEnd: b.securitySupportEnd,
      active: { left: round(begin), width: round(Math.max(0, activeEnd - begin)) },
      security: { left: round(activeEnd), width: round(Math.max(0, securityEnd - activeEnd)) },
    };
  });

  const years = [];
  for (let year = startYear; year <= endYear; year++) years.push({ year, left: round(pos(`${year}-01-01`)) });
  const todayPos = today >= start && today <= end ? round(pos(today)) : null;
  return { start, end, today: todayPos, years, rows };
}

export function stateCounts(branches: Pick<PhpBranch, "state">[]): Record<SupportState, number> {
  const counts: Record<SupportState, number> = { active: 0, security: 0, eol: 0, unknown: 0 };
  for (const b of branches) counts[b.state] += 1;
  return counts;
}
