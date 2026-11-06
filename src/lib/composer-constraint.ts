/**
 * Composer constraint matching for Packagist security-advisory affectedVersions.
 * Covers the operators Packagist advisories use: >= > <= < != = and OR (|), AND (,).
 * Not a full Composer constraint parser (no ^ ~ * x-ranges); those rarely appear in advisories.
 */

export type ComposerVersion = {
  /** Numeric core, e.g. [1, 2, 3] or [1, 2, 3, 0]. */
  numbers: number[];
  /** Stability: stable > RC > beta > alpha > dev. null means stable. */
  stability: "stable" | "RC" | "beta" | "alpha" | "dev";
  stabilityNumber: number;
  raw: string;
};

const STABILITY_RANK: Record<ComposerVersion["stability"], number> = {
  stable: 4,
  RC: 3,
  beta: 2,
  alpha: 1,
  dev: 0,
};

/** Strip branch-alias / build metadata noise; keep pre-release flags. */
export function parseComposerVersion(input: string): ComposerVersion | null {
  let raw = input.trim();
  if (!raw || raw.length > 64) return null;
  if (raw.startsWith("v") || raw.startsWith("V")) raw = raw.slice(1);

  // Branch / arbitrary versions ("dev-main", "dev-master") are not comparable to advisory ranges.
  if (/^dev-/i.test(raw) || raw.endsWith("-dev") && !/^\d/.test(raw)) return null;

  const match = /^(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:\.(\d+))?(?:[-.]?(stable|RC|rc|beta|b|alpha|a|dev)(\d.*)?)?(?:\+.*)?$/i.exec(raw);
  if (!match) return null;

  const numbers = [Number(match[1]), Number(match[2] ?? 0), Number(match[3] ?? 0)];
  if (match[4] !== undefined) numbers.push(Number(match[4]));
  if (numbers.some((n) => !Number.isFinite(n) || n < 0)) return null;

  let stability: ComposerVersion["stability"] = "stable";
  let stabilityNumber = 0;
  if (match[5]) {
    const flag = match[5].toLowerCase();
    if (flag === "stable") stability = "stable";
    else if (flag === "rc") stability = "RC";
    else if (flag === "beta" || flag === "b") stability = "beta";
    else if (flag === "alpha" || flag === "a") stability = "alpha";
    else if (flag === "dev") stability = "dev";
    const numPart = (match[6] ?? "").replace(/^\D*/, "");
    stabilityNumber = numPart ? Number(numPart) || 0 : 0;
  }

  return { numbers, stability, stabilityNumber, raw: input.trim() };
}

function pad(a: number[], b: number[]): [number[], number[]] {
  const len = Math.max(a.length, b.length);
  return [
    [...a, ...Array(len - a.length).fill(0)],
    [...b, ...Array(len - b.length).fill(0)],
  ];
}

export function compareComposerVersions(a: ComposerVersion, b: ComposerVersion): number {
  const [left, right] = pad(a.numbers, b.numbers);
  for (let i = 0; i < left.length; i += 1) {
    if (left[i] !== right[i]) return left[i] - right[i];
  }
  const stab = STABILITY_RANK[a.stability] - STABILITY_RANK[b.stability];
  if (stab !== 0) return stab;
  return a.stabilityNumber - b.stabilityNumber;
}

type Comparator = ">=" | ">" | "<=" | "<" | "!=" | "=";

function parseAtom(atom: string): { op: Comparator; version: ComposerVersion } | null {
  const trimmed = atom.trim();
  if (!trimmed) return null;
  const match = /^(>=|<=|!=|<>|>|<|=)?\s*(.+)$/.exec(trimmed);
  if (!match) return null;
  let op = (match[1] || "=") as Comparator | "<>";
  if (op === "<>") op = "!=";
  const version = parseComposerVersion(match[2].trim());
  if (!version) return null;
  return { op, version };
}

function atomMatches(installed: ComposerVersion, atom: { op: Comparator; version: ComposerVersion }): boolean {
  const cmp = compareComposerVersions(installed, atom.version);
  switch (atom.op) {
    case ">=":
      return cmp >= 0;
    case ">":
      return cmp > 0;
    case "<=":
      return cmp <= 0;
    case "<":
      return cmp < 0;
    case "!=":
      return cmp !== 0;
    case "=":
      return cmp === 0;
  }
}

/** True when `version` satisfies a Packagist/Composer constraint string. */
export function versionSatisfies(versionRaw: string, constraint: string): boolean {
  const installed = parseComposerVersion(versionRaw);
  if (!installed) return false;
  const normalized = constraint.trim();
  if (!normalized || normalized === "*") return true;

  // OR of AND-groups: ">=1,<2|>=3,<4"
  const groups = normalized.split("|").map((g) => g.trim()).filter(Boolean);
  if (groups.length === 0) return false;

  return groups.some((group) => {
    const atoms = group.split(",").map((a) => a.trim()).filter(Boolean);
    if (atoms.length === 0) return false;
    return atoms.every((atomText) => {
      const atom = parseAtom(atomText);
      if (!atom) return false;
      return atomMatches(installed, atom);
    });
  });
}

/**
 * For the OR-groups that match the installed version, collect exclusive upper bounds
 * (`<X.Y.Z`) as suggested fixed versions for that branch.
 */
export function suggestedFixedVersions(versionRaw: string, constraint: string): string[] {
  const installed = parseComposerVersion(versionRaw);
  if (!installed) return [];
  const groups = constraint.split("|").map((g) => g.trim()).filter(Boolean);
  const fixed = new Set<string>();

  for (const group of groups) {
    const atoms = group.split(",").map((a) => a.trim()).filter(Boolean).map(parseAtom);
    if (atoms.some((a) => a === null)) continue;
    const parsed = atoms as { op: Comparator; version: ComposerVersion }[];
    if (!parsed.every((atom) => atomMatches(installed, atom))) continue;

    for (const atom of parsed) {
      if (atom.op === "<") {
        fixed.add(formatVersionNumbers(atom.version.numbers));
      }
    }
  }

  return [...fixed];
}

function formatVersionNumbers(numbers: number[]): string {
  // Drop trailing zeros beyond patch for nicer "5.4.56" display, keep at least 3 parts.
  const core = [...numbers];
  while (core.length > 3 && core[core.length - 1] === 0) core.pop();
  while (core.length < 3) core.push(0);
  return core.join(".");
}
