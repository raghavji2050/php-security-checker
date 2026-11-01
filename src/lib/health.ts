import { peekCache } from "@/lib/cache";
import { sharedCacheEnabled } from "@/lib/shared-cache";

export type SourceHealth = {
  name: string;
  required: boolean;
  cached: boolean;
  fresh: boolean;
  retrievedAt: string | null;
  ageSeconds: number | null;
};

export type HealthReport = {
  status: "ok" | "degraded";
  app: { name: string; uptimeSeconds: number };
  time: string;
  sharedCache: boolean;
  sources: SourceHealth[];
  note: string;
};

const SOURCES: { key: string; name: string; required: boolean }[] = [
  { key: "nvd-php-runtime-v1", name: "NIST NVD (PHP runtime CVEs)", required: true },
  { key: "php-branches-v1", name: "php.net supported versions and releases", required: false },
  { key: "php-changelog-index-v1", name: "PHP ChangeLog", required: false },
  { key: "github-php-advisories-v1", name: "GitHub advisories for php/php-src", required: false },
];

/** Builds the health report from cached data only; it never calls php.net, NVD or GitHub. */
export async function healthReport(now = Date.now()): Promise<HealthReport> {
  const sources = await Promise.all(
    SOURCES.map(async (source): Promise<SourceHealth> => {
      const entry = await peekCache(source.key).catch(() => null);
      return {
        name: source.name,
        required: source.required,
        cached: entry !== null,
        fresh: entry?.fresh ?? false,
        retrievedAt: entry?.storedAt ?? null,
        ageSeconds: entry ? Math.max(0, Math.round((now - Date.parse(entry.storedAt)) / 1000)) : null,
      };
    }),
  );
  const required = sources.filter((s) => s.required);
  const status = required.every((s) => s.cached && s.fresh) ? "ok" : "degraded";
  return {
    status,
    app: { name: "php-security-checker", uptimeSeconds: Math.round(process.uptime()) },
    time: new Date(now).toISOString(),
    sharedCache: sharedCacheEnabled(),
    sources,
    note:
      status === "ok"
        ? "The app is up and vulnerability data is fresh."
        : "The app is up, but NVD data is not cached or is stale on this instance. The next check will fetch it.",
  };
}
