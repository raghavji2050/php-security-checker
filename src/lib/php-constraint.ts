/**
 * Composer `require.php` constraint checker: which PHP branches does a constraint like
 * "^8.1", ">=7.4 <8.3" or "~8.2.0 || ^8.4" allow? Versions are MAJOR.MINOR.PATCH only;
 * stability flags (@dev, -RC1) are ignored because PHP releases used in production are stable.
 */

/** Half-open interval [lo, hi) over encoded versions. hi = Infinity for no upper bound. */
export type Interval = [number, number];

const MAX = Number.POSITIVE_INFINITY;

export function encode(major: number, minor = 0, patch = 0): number {
  return major * 1_000_000 + minor * 1_000 + patch;
}

type Partial = { parts: number[]; wildcard: boolean };

function parsePartial(input: string): Partial | null {
  let raw = input.trim().replace(/^v/i, "");
  raw = raw.replace(/@[a-z]+$/i, "").replace(/-(dev|alpha\d*|beta\d*|rc\d*|stable)$/i, "");
  if (raw === "*" || raw.toLowerCase() === "x") return { parts: [], wildcard: true };
  const m = /^(\d{1,3})(?:\.(\d{1,3}|\*|x))?(?:\.(\d{1,3}|\*|x))?(?:\.(\d{1,3}|\*|x))?$/i.exec(raw);
  if (!m) return null;
  const parts: number[] = [];
  let wildcard = false;
  for (const p of m.slice(1, 4)) {
    if (p === undefined) break;
    if (p === "*" || p.toLowerCase() === "x") {
      wildcard = true;
      break;
    }
    parts.push(Number(p));
  }
  return { parts, wildcard };
}

function lowOf(p: Partial): number {
  return encode(p.parts[0] ?? 0, p.parts[1] ?? 0, p.parts[2] ?? 0);
}

/** Exclusive upper bound when the last given part (or wildcard) is bumped. */
function bumpLast(parts: number[]): number {
  if (parts.length === 0) return MAX;
  if (parts.length === 1) return encode(parts[0] + 1);
  if (parts.length === 2) return encode(parts[0], parts[1] + 1);
  return encode(parts[0], parts[1], parts[2] + 1);
}

function term(input: string): Interval[] | null {
  const m = /^(>=|<=|>|<|!=|==|=|\^|~)?\s*(.+)$/.exec(input.trim());
  if (!m) return null;
  const op = m[1] ?? "";
  const p = parsePartial(m[2]);
  if (!p) return null;
  const [a, b = 0, c = 0] = p.parts;
  const lo = lowOf(p);
  if (p.wildcard || (op === "" && p.parts.length === 0)) {
    if (op && op !== "=" && op !== "==") return null;
    return [[lo, bumpLast(p.parts)]];
  }
  switch (op) {
    case "":
    case "=":
    case "==":
      return [[lo, lo + 1]];
    case ">=":
      return [[lo, MAX]];
    case ">":
      return [[lo + 1, MAX]];
    case "<":
      return [[0, lo]];
    case "<=":
      // "<=8.2" in Composer means <=8.2.0.0, so only the exact x.y.0 is included.
      return [[0, lo + 1]];
    case "!=":
      return [[0, lo], [lo + 1, MAX]];
    case "^": {
      if (a > 0 || p.parts.length === 1) return [[lo, encode(a + 1)]];
      if (b > 0 || p.parts.length === 2) return [[lo, encode(0, b + 1)]];
      return [[lo, encode(0, 0, c + 1)]];
    }
    case "~": {
      if (p.parts.length === 1) return [[lo, encode(a + 1)]];
      if (p.parts.length === 2) return [[lo, encode(a + 1)]];
      return [[lo, encode(a, b + 1)]];
    }
  }
  return null;
}

function intersect(x: Interval[], y: Interval[]): Interval[] {
  const out: Interval[] = [];
  for (const [a1, b1] of x) {
    for (const [a2, b2] of y) {
      const lo = Math.max(a1, a2);
      const hi = Math.min(b1, b2);
      if (lo < hi) out.push([lo, hi]);
    }
  }
  return out;
}

function union(list: Interval[]): Interval[] {
  const sorted = [...list].sort((p, q) => p[0] - q[0]);
  const out: Interval[] = [];
  for (const iv of sorted) {
    const last = out[out.length - 1];
    if (last && iv[0] <= last[1]) last[1] = Math.max(last[1], iv[1]);
    else out.push([iv[0], iv[1]]);
  }
  return out;
}

function group(input: string): Interval[] | null {
  const text = input.trim();
  if (!text) return null;
  const hyphen = /^(\S+)\s+-\s+(\S+)$/.exec(text);
  if (hyphen) {
    const from = parsePartial(hyphen[1]);
    const to = parsePartial(hyphen[2]);
    if (!from || !to || from.wildcard || to.wildcard) return null;
    // A partial upper bound acts as a wildcard: "8.1 - 8.3" allows every 8.3.x.
    const hi = to.parts.length >= 3 ? lowOf(to) + 1 : bumpLast(to.parts);
    return lowOf(from) < hi ? [[lowOf(from), hi]] : [];
  }
  // Join operators to their version ("> = 8.1" is not valid, but ">= 8.1" is common).
  const tokens = text.replace(/(>=|<=|!=|==|>|<|=|\^|~)\s+/g, "$1").split(/\s*,\s*|\s+/).filter(Boolean);
  let acc: Interval[] = [[0, MAX]];
  for (const token of tokens) {
    const t = term(token);
    if (!t) return null;
    acc = intersect(acc, t);
  }
  return acc;
}

export type ParsedConstraint = { ok: true; intervals: Interval[] } | { ok: false; error: string };

/** Accepts a bare constraint (^8.1) or a JSON-ish line ("php": "^8.1"). */
export function extractConstraint(input: string): string {
  const text = input.trim().slice(0, 500);
  const json = /"php"\s*:\s*"([^"]*)"/.exec(text);
  if (json) return json[1].trim();
  return text.replace(/^["']|["'],?$/g, "").trim();
}

export function parsePhpConstraint(input: string): ParsedConstraint {
  const constraint = extractConstraint(input);
  if (!constraint) return { ok: false, error: "Enter a constraint like ^8.1 or >=8.2 <8.5." };
  if (constraint.length > 200) return { ok: false, error: "That constraint is too long." };
  const parts = constraint.split(/\s*\|\|?\s*/);
  const all: Interval[] = [];
  for (const part of parts) {
    const g = group(part);
    if (!g) return { ok: false, error: `Could not read "${part.trim() || constraint}" as a Composer version constraint.` };
    all.push(...g);
  }
  return { ok: true, intervals: union(all) };
}

/** True when any X.Y.* release is allowed. */
export function allowsBranch(intervals: Interval[], branch: string): boolean {
  const m = /^(\d+)\.(\d+)$/.exec(branch);
  if (!m) return false;
  const lo = encode(Number(m[1]), Number(m[2]));
  const hi = lo + 1_000;
  return intervals.some(([a, b]) => a < hi && b > lo);
}

/** True when the constraint allows a version on a branch newer than `newestBranch` (a future release). */
export function allowsNewerThan(intervals: Interval[], newestBranch: string): boolean {
  const m = /^(\d+)\.(\d+)$/.exec(newestBranch);
  if (!m) return false;
  const after = encode(Number(m[1]), Number(m[2]) + 1);
  return intervals.some(([, b]) => b > after);
}
