/** Client-safe Symfony version input helpers. */

/** Accept a stable MAJOR.MINOR.PATCH Symfony version (leading v allowed). Branch-only and pre-releases are rejected. */
export function normalizeSymfonyVersion(input: string): string | null {
  const trimmed = input.trim().replace(/^v/i, "");
  if (!trimmed || trimmed.length > 24) return null;
  if (!/^\d{1,2}\.\d{1,2}\.\d{1,4}$/.test(trimmed)) return null;
  return trimmed.split(".").map((part) => String(Number(part))).join(".");
}
