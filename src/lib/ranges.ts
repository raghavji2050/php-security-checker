import {
  parsePhpVersion,
  compareVersions,
  versionBranch,
  type PhpVersion,
} from "@/lib/version";

export type VersionBound = {
  version: PhpVersion;
  inclusive: boolean;
};

export type RangePrecision = "precise" | "broad";

export type VersionRange = {
  start: VersionBound | null;
  end: VersionBound | null;
  /** When set, the range applies only to this MAJOR.MINOR branch. */
  branch: string | null;
  precision: RangePrecision;
  label: string;
};

export function versionInRange(version: PhpVersion, range: VersionRange): boolean {
  if (range.branch && versionBranch(version) !== range.branch) return false;
  if (!range.start && !range.end) return false;
  if (range.start) {
    const order = compareVersions(version, range.start.version);
    if (range.start.inclusive ? order < 0 : order <= 0) return false;
  }
  if (range.end) {
    const order = compareVersions(version, range.end.version);
    if (range.end.inclusive ? order > 0 : order >= 0) return false;
  }
  return true;
}

export function formatRange(range: VersionRange): string {
  const branch = range.branch ? `PHP ${range.branch} only, ` : "";
  if (range.start && range.end && compareVersions(range.start.version, range.end.version) === 0 && range.start.inclusive && range.end.inclusive) {
    return `${branch}${range.start.version.raw} exactly`;
  }
  if (range.start && range.end) {
    return `${branch}${range.start.version.raw} (${range.start.inclusive ? "including" : "excluding"}) to ${range.end.version.raw} (${range.end.inclusive ? "including" : "excluding"})`;
  }
  if (range.end) {
    return `${branch}before ${range.end.version.raw}${range.end.inclusive ? " (including that release)" : ""}`;
  }
  if (range.start) {
    return `${branch}from ${range.start.version.raw} (${range.start.inclusive ? "including" : "excluding"}) with no published upper bound`;
  }
  return "unspecified";
}

function boundLabel(start: VersionBound | null, end: VersionBound | null, branch: string | null): string {
  return formatRange({ start, end, branch, precision: "precise", label: "" });
}

export function exactRange(version: PhpVersion): VersionRange {
  const bound = { version, inclusive: true };
  return {
    start: bound,
    end: bound,
    branch: versionBranch(version),
    precision: "precise",
    label: `${version.raw} exactly`,
  };
}

export function makeRange(
  start: VersionBound | null,
  end: VersionBound | null,
  branch: string | null,
  precision: RangePrecision,
): VersionRange {
  return {
    start,
    end,
    branch,
    precision,
    label: boundLabel(start, end, branch),
  };
}

type LooseVersion = {
  version?: string;
  lessThan?: string;
  lessThanOrEqual?: string;
  greaterThan?: string;
  greaterThanOrEqual?: string;
  status?: string;
};

function parsedBound(raw: string | undefined, inclusive: boolean): VersionBound | null {
  if (!raw) return null;
  const version = parsePhpVersion(raw);
  if (!version) return null;
  return { version, inclusive };
}

/** Parse one affected-version object from NVD CVE 5 data or a prose version string. */
export function parseAffectedVersion(entry: LooseVersion): VersionRange[] {
  if ((entry.status ?? "affected").toLowerCase() !== "affected") return [];
  const raw = (entry.version ?? "").trim();
  const chunks = raw.split(/\s+and\s+/i).map((part) => part.trim()).filter(Boolean);
  const ranges: VersionRange[] = [];

  for (const chunk of chunks.length > 0 ? chunks : [raw]) {
    const prose = /^(\d+)\.(\d+)\.[xX*]\s*(?:<|below|before)\s*(\d+\.\d+\.\d+)$/i.exec(chunk);
    if (prose) {
      const start = parsedBound(`${prose[1]}.${prose[2]}.0`, true);
      const end = parsedBound(prose[3], false);
      if (start && end) {
        ranges.push(makeRange(start, end, `${prose[1]}.${prose[2]}`, "precise"));
      }
      continue;
    }

    const before = /^before\s+(\d+\.\d+\.\d+)$/i.exec(chunk);
    if (before) {
      const end = parsedBound(before[1], false);
      if (end) ranges.push(makeRange(null, end, null, "broad"));
      continue;
    }

    const wildcard = /^(\d+)\.(\d+)\.[xX*]$/.exec(chunk);
    const lowerRaw = entry.greaterThanOrEqual ?? entry.greaterThan;
    const upperRaw = entry.lessThanOrEqual ?? entry.lessThan;
    const lowerInclusive = Boolean(entry.greaterThanOrEqual) || !entry.greaterThan;
    const upperInclusive = Boolean(entry.lessThanOrEqual);

    if (wildcard && (lowerRaw || upperRaw)) {
      const branch = `${wildcard[1]}.${wildcard[2]}`;
      const start = parsedBound(lowerRaw ?? `${branch}.0`, lowerRaw ? lowerInclusive : true);
      const end = parsedBound(upperRaw, upperInclusive);
      if (start || end) {
        ranges.push(makeRange(start, end, branch, start && end ? "precise" : "broad"));
      }
      continue;
    }

    const exact = parsePhpVersion(chunk);
    if (exact && !lowerRaw && !upperRaw && chunks.length === 1) {
      ranges.push(exactRange(exact));
      continue;
    }

    if (exact && (lowerRaw || upperRaw)) {
      const start = parsedBound(lowerRaw ?? exact.raw, lowerRaw ? lowerInclusive : true);
      const end = parsedBound(upperRaw, upperInclusive);
      if (start || end) {
        ranges.push(makeRange(start, end, null, start && end ? "precise" : "broad"));
      }
    }
  }

  return ranges;
}

export type CpeMatch = {
  vulnerable?: boolean;
  criteria?: string;
  versionStartIncluding?: string;
  versionStartExcluding?: string;
  versionEndIncluding?: string;
  versionEndExcluding?: string;
};

/** Keep only the PHP runtime product. Other php:* products are ignored. */
export function parsePhpRuntimeCpe(match: CpeMatch): VersionRange | null {
  if (match.vulnerable === false) return null;
  const parts = (match.criteria ?? "").split(":");
  if (parts.length < 6) return null;
  if (parts[2] !== "a" || parts[3] !== "php" || parts[4] !== "php") return null;

  const versionToken = parts[5];
  const start = match.versionStartIncluding
    ? parsedBound(match.versionStartIncluding, true)
    : match.versionStartExcluding
      ? parsedBound(match.versionStartExcluding, false)
      : null;
  const end = match.versionEndIncluding
    ? parsedBound(match.versionEndIncluding, true)
    : match.versionEndExcluding
      ? parsedBound(match.versionEndExcluding, false)
      : null;

  if ((match.versionStartIncluding || match.versionStartExcluding) && !start) return null;
  if ((match.versionEndIncluding || match.versionEndExcluding) && !end) return null;

  if (start || end) {
    const precision: RangePrecision = start && end ? "precise" : "broad";
    const branch = !start && end ? versionBranch(end.version) : null;
    return makeRange(start, end, branch, precision);
  }

  if (versionToken && versionToken !== "*" && versionToken !== "-") {
    const exact = parsePhpVersion(versionToken);
    if (!exact) return null;
    return exactRange(exact);
  }

  return null;
}

export type GithubRangeInput = {
  vulnerable_version_range?: string;
  patched_versions?: string | null;
};

/**
 * PHP publishes one upper bound per branch (`<8.4.27`, `<8.5.12`, ...).
 * A single bare upper bound is left broad so it cannot confirm every older branch.
 * Several branch caps in one advisory are scoped to each branch.
 */
export function parseGithubRanges(entries: GithubRangeInput[]): VersionRange[] {
  const pieces = entries.map((entry) => parseGithubComparator(entry.vulnerable_version_range ?? ""));
  const upperOnly = pieces.filter((piece) => piece && !piece.start && piece.end);
  const branches = new Set(upperOnly.map((piece) => versionBranch(piece!.end!.version)));
  const scopeToBranch = branches.size >= 2;

  const ranges: VersionRange[] = [];
  for (const piece of pieces) {
    if (!piece) continue;
    if (!piece.start && piece.end && scopeToBranch) {
      const branch = versionBranch(piece.end.version);
      const start = parsedBound(`${branch}.0`, true);
      ranges.push(makeRange(start, piece.end, branch, "precise"));
      continue;
    }
    const precision: RangePrecision = piece.start && piece.end ? "precise" : "broad";
    const branch = !piece.start && piece.end ? versionBranch(piece.end.version) : null;
    ranges.push(makeRange(piece.start, piece.end, precision === "broad" ? branch : null, precision));
  }
  return ranges;
}

function parseGithubComparator(raw: string): { start: VersionBound | null; end: VersionBound | null } | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  let start: VersionBound | null = null;
  let end: VersionBound | null = null;
  for (const part of trimmed.split(",").map((item) => item.trim()).filter(Boolean)) {
    const match = /^(>=|<=|>|<|=)\s*(\d+\.\d+\.\d+)$/.exec(part);
    if (!match) return null;
    const version = parsePhpVersion(match[2]);
    if (!version) return null;
    const operator = match[1];
    if (operator === ">=") start = { version, inclusive: true };
    else if (operator === ">") start = { version, inclusive: false };
    else if (operator === "<=") end = { version, inclusive: true };
    else if (operator === "<") end = { version, inclusive: false };
    else {
      start = { version, inclusive: true };
      end = { version, inclusive: true };
    }
  }
  if (!start && !end) return null;
  return { start, end };
}

export function impliedFixOnBranch(range: VersionRange, branch: string, releases: string[]): string | null {
  if (!range.end) return null;
  if (versionBranch(range.end.version) !== branch) return null;
  if (!range.end.inclusive) return range.end.version.raw;
  const next = releases.find((release) => {
    const parsed = parsePhpVersion(release);
    return parsed ? compareVersions(parsed, range.end!.version) > 0 : false;
  });
  return next ?? null;
}
