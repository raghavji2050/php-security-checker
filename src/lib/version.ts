export type PhpVersion = {
  major: number;
  minor: number;
  patch: number;
  raw: string;
};

const VERSION_PATTERN = /^(0|[1-9]\d{0,3})\.(0|[1-9]\d{0,3})\.(0|[1-9]\d{0,3})$/;

/** Accept only MAJOR.MINOR.PATCH. A missing patch is rejected, not assumed. */
export function parsePhpVersion(input: string): PhpVersion | null {
  const trimmed = input.trim();
  const match = VERSION_PATTERN.exec(trimmed);
  if (!match) return null;
  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = Number(match[3]);
  return { major, minor, patch, raw: `${major}.${minor}.${patch}` };
}

export function compareVersions(a: PhpVersion, b: PhpVersion): number {
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  return a.patch - b.patch;
}

export function versionBranch(version: PhpVersion): string {
  return `${version.major}.${version.minor}`;
}

export function compareBranches(a: string, b: string): number {
  const [aMajor, aMinor] = a.split(".").map(Number);
  const [bMajor, bMinor] = b.split(".").map(Number);
  if (aMajor !== bMajor) return aMajor - bMajor;
  return aMinor - bMinor;
}

export function branchOfRaw(raw: string): string | null {
  const parsed = parsePhpVersion(raw);
  return parsed ? versionBranch(parsed) : null;
}
