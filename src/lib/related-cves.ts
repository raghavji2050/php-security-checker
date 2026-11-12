import type { ExplorerRow } from "@/lib/cve-explorer";

export type RelatedCve = {
  id: string;
  severity: ExplorerRow["severity"];
  score: number | null;
  published: string | null;
  sharedBranches: string[];
  sameYear: boolean;
};

/**
 * Other CVEs that touch the same PHP branches (from NVD ranges), closest first:
 * more shared branches, then same year, then higher CVSS, then newer. Only existing data; no guessing.
 */
export function relatedCves(target: ExplorerRow, rows: ExplorerRow[], limit = 6): RelatedCve[] {
  const mine = new Set(target.branches);
  const out: RelatedCve[] = [];
  for (const row of rows) {
    if (row.id === target.id) continue;
    const shared = row.branches.filter((b) => mine.has(b));
    const sameYear = target.year !== null && row.year === target.year;
    if (shared.length === 0) continue;
    out.push({ id: row.id, severity: row.severity, score: row.score, published: row.published, sharedBranches: shared, sameYear });
  }
  out.sort(
    (a, b) =>
      b.sharedBranches.length - a.sharedBranches.length ||
      Number(b.sameYear) - Number(a.sameYear) ||
      (b.score ?? -1) - (a.score ?? -1) ||
      (b.published ?? "").localeCompare(a.published ?? "") ||
      a.id.localeCompare(b.id),
  );
  return out.slice(0, limit);
}
