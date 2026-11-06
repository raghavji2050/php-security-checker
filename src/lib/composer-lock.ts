/** Client- and server-safe composer.lock parsing. Never executes anything. */

export const MAX_LOCK_BYTES = 5 * 1024 * 1024;
export const MAX_PACKAGES = 1500;

export type LockPackage = {
  name: string;
  version: string;
  isDev: boolean;
};

export type ParseLockOk = {
  ok: true;
  packages: LockPackage[];
  lockContentHash: string;
  packageCount: number;
  devPackageCount: number;
};

export type ParseLockErr = {
  ok: false;
  code:
    | "empty"
    | "too_large"
    | "invalid_json"
    | "not_composer_lock"
    | "no_packages"
    | "too_many_packages";
  message: string;
};

export type ParseLockResult = ParseLockOk | ParseLockErr;

const PACKAGE_NAME = /^[a-z0-9]([_.-]?[a-z0-9]+)*\/[a-z0-9](([_.]|-{1,2})?[a-z0-9]+)*$/i;

type RawLock = {
  packages?: unknown;
  "packages-dev"?: unknown;
  "content-hash"?: unknown;
  _readme?: unknown;
  "plugin-api-version"?: unknown;
};

function asPackageList(value: unknown, isDev: boolean): LockPackage[] | null {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) return null;
  const out: LockPackage[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const rec = item as Record<string, unknown>;
    if (typeof rec.name !== "string" || typeof rec.version !== "string") return null;
    const name = rec.name.trim();
    const version = rec.version.trim();
    if (!PACKAGE_NAME.test(name) || !version || version.length > 64) continue;
    out.push({ name, version, isDev });
  }
  return out;
}

/** Validate and parse a composer.lock JSON string. Rejects oversized or non-lock payloads. */
export function parseComposerLock(text: string): ParseLockResult {
  if (typeof text !== "string" || text.trim() === "") {
    return { ok: false, code: "empty", message: "Paste or upload a composer.lock file." };
  }
  // UTF-16 code units ≈ bytes for ASCII-heavy lock files; reject early.
  if (text.length > MAX_LOCK_BYTES) {
    return {
      ok: false,
      code: "too_large",
      message: `composer.lock is too large (max ${Math.floor(MAX_LOCK_BYTES / (1024 * 1024))} MB).`,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, code: "invalid_json", message: "That is not valid JSON." };
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, code: "not_composer_lock", message: "That JSON does not look like a composer.lock." };
  }

  const lock = parsed as RawLock;
  const looksLikeLock =
    Array.isArray(lock.packages) ||
    Array.isArray(lock["packages-dev"]) ||
    typeof lock["content-hash"] === "string" ||
    typeof lock["plugin-api-version"] === "string" ||
    typeof lock._readme === "string";

  if (!looksLikeLock) {
    return {
      ok: false,
      code: "not_composer_lock",
      message: "Expected a composer.lock with a packages (and optional packages-dev) array.",
    };
  }

  const prod = asPackageList(lock.packages, false);
  const dev = asPackageList(lock["packages-dev"], true);
  if (prod === null || dev === null) {
    return {
      ok: false,
      code: "not_composer_lock",
      message: "packages / packages-dev must be arrays of { name, version } objects.",
    };
  }

  const packages = [...prod, ...dev];
  if (packages.length === 0) {
    return { ok: false, code: "no_packages", message: "No packages found in this lock file." };
  }
  if (packages.length > MAX_PACKAGES) {
    return {
      ok: false,
      code: "too_many_packages",
      message: `Too many packages (${packages.length}; max ${MAX_PACKAGES}).`,
    };
  }

  // Prefer the lock's own content-hash when present; otherwise a short length marker (not cryptographic).
  const lockContentHash =
    typeof lock["content-hash"] === "string" && lock["content-hash"]
      ? lock["content-hash"]
      : `packages:${packages.length}`;

  return {
    ok: true,
    packages,
    lockContentHash,
    packageCount: prod.length,
    devPackageCount: dev.length,
  };
}

/** Map name → first version seen (prod wins over later duplicates). */
export function packagesToVersionMap(packages: LockPackage[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const pkg of packages) {
    if (!(pkg.name in map)) map[pkg.name] = pkg.version;
  }
  return map;
}

export function isValidPackageName(name: string): boolean {
  return PACKAGE_NAME.test(name) && name.length <= 214;
}
