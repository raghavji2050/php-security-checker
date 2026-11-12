import type { ChangelogIndex } from "@/lib/types";
import { compareVersions, parsePhpVersion, type PhpVersion } from "@/lib/version";

export type DiffRelease = { version: string; securityIds: string[] };

export type ChangelogDiff =
  | { ok: true; from: string; to: string; branch: string; releases: DiffRelease[]; securityIds: string[] }
  | { ok: false; error: string };

/** Every security ID (CVE or GHSA) php.net's ChangeLog lists per release. */
export function idsByVersion(index: ChangelogIndex): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [id, versions] of Object.entries(index)) {
    for (const v of versions) (out[v] ??= []).push(id);
  }
  for (const list of Object.values(out)) list.sort();
  return out;
}

/**
 * Security fixes you gain by moving from `fromRaw` to `toRaw` on the same branch, from
 * php.net ChangeLog data only. `releases` is the official release list for that branch.
 */
export function changelogDiff(fromRaw: string, toRaw: string, index: ChangelogIndex, releases: string[]): ChangelogDiff {
  const from = parsePhpVersion(fromRaw);
  const to = parsePhpVersion(toRaw);
  if (!from || !to) return { ok: false, error: "Use full MAJOR.MINOR.PATCH versions, for example 8.3.10 and 8.3.14." };
  if (from.major !== to.major || from.minor !== to.minor) {
    return { ok: false, error: "Pick two patch versions on the same branch (for example 8.3.10 → 8.3.14). For a branch upgrade, check the target version directly." };
  }
  if (compareVersions(to, from) <= 0) return { ok: false, error: "The second version must be newer than the first." };
  const branch = `${from.major}.${from.minor}`;
  const byVersion = idsByVersion(index);
  const between = releases
    .map((r) => parsePhpVersion(r))
    .filter((v): v is PhpVersion => v !== null && v.major === from.major && v.minor === from.minor)
    .filter((v) => compareVersions(v, from) > 0 && compareVersions(v, to) <= 0)
    .sort(compareVersions);
  if (!releases.includes(to.raw)) return { ok: false, error: `PHP ${to.raw} is not in the official php.net release list.` };
  const rows = between.map((v) => ({ version: v.raw, securityIds: byVersion[v.raw] ?? [] }));
  const ids = [...new Set(rows.flatMap((r) => r.securityIds))].sort();
  return { ok: true, from: from.raw, to: to.raw, branch, releases: rows, securityIds: ids };
}
