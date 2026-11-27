import { compareBranches } from "@/lib/version";
import type { PhpBranch } from "@/lib/types";

/** One PHP branch whose php.net security support ends soon (or ended recently). */
export type EolCountdownRow = {
  branch: string;
  securitySupportEnd: string;
  /** Whole days from `today` to the end date. Negative once the branch is past end of life. */
  daysLeft: number;
  latestPatch: string | null;
  /** Official php.net migration guide for the next minor/major step, when one exists. */
  migrationGuide: { label: string; url: string } | null;
};

const DAY_MS = 86_400_000;

/** Whole days between two YYYY-MM-DD dates (UTC). */
export function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from.slice(0, 10)}T00:00:00Z`);
  const b = Date.parse(`${to.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return Number.NaN;
  return Math.round((b - a) / DAY_MS);
}

/**
 * php.net migration guides live at /manual/en/migrationXY.php, named after the target branch
 * (for example migration83.php covers 8.2 to 8.3). Only built when the target branch is known.
 */
export function migrationGuide(from: string, branches: Pick<PhpBranch, "branch">[]): EolCountdownRow["migrationGuide"] {
  const newer = branches
    .map((b) => b.branch)
    .filter((b) => compareBranches(b, from) > 0)
    .sort(compareBranches);
  const target = newer[0];
  if (!target || !/^\d+\.\d+$/.test(target)) return null;
  return {
    label: `Migrating from PHP ${from} to ${target}`,
    url: `https://www.php.net/manual/en/migration${target.replace(".", "")}.php`,
  };
}

/**
 * Branches whose security support ends within `horizonDays` from today, plus any that ended in the
 * last `graceDays` (so a page does not go blank the day after an end date). Uses only php.net dates;
 * branches without a published security end date are left out instead of guessed.
 */
export function buildEolCountdown(
  branches: PhpBranch[],
  today: string,
  { horizonDays = 400, graceDays = 60 }: { horizonDays?: number; graceDays?: number } = {},
): EolCountdownRow[] {
  return branches
    .filter((b): b is PhpBranch & { securitySupportEnd: string } => Boolean(b.securitySupportEnd))
    .map((b) => ({
      branch: b.branch,
      securitySupportEnd: b.securitySupportEnd.slice(0, 10),
      daysLeft: daysBetween(today, b.securitySupportEnd),
      latestPatch: b.latestPatch,
      migrationGuide: migrationGuide(b.branch, branches),
    }))
    .filter((r) => Number.isFinite(r.daysLeft) && r.daysLeft <= horizonDays && r.daysLeft >= -graceDays)
    .sort((a, b) => a.securitySupportEnd.localeCompare(b.securitySupportEnd) || compareBranches(a.branch, b.branch));
}

/** Short human label for a countdown, e.g. "34 days left", "Ends today", "Ended 5 days ago". */
export function countdownLabel(daysLeft: number): string {
  if (daysLeft === 0) return "Ends today";
  if (daysLeft > 0) return `${daysLeft} day${daysLeft === 1 ? "" : "s"} left`;
  const ago = -daysLeft;
  return `Ended ${ago} day${ago === 1 ? "" : "s"} ago`;
}
