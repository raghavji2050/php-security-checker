import { getOrLoad } from "@/lib/cache";
import { fetchJson } from "@/lib/http";

export const WORDPRESS_STABLE_CHECK = "https://api.wordpress.org/core/stable-check/1.0/";

export const WP_STATUSES = ["latest", "outdated", "insecure"] as const;
export type WordPressStatus = (typeof WP_STATUSES)[number];

export function normalizeWordPressVersion(input: string): string | null {
  const trimmed = input.trim();
  if (!/^\d{1,2}(\.\d{1,4}){1,3}$/.test(trimmed)) return null;
  return trimmed;
}

export function interpretStableCheck(map: Record<string, string>, version: string): {
  listed: boolean;
  status: WordPressStatus | null;
  latest: string[];
} {
  const latest = Object.entries(map)
    .filter(([, status]) => status === "latest")
    .map(([key]) => key);
  const raw = map[version];
  const status = (WP_STATUSES as readonly string[]).includes(raw) ? (raw as WordPressStatus) : null;
  return { listed: status !== null, status, latest };
}

export function wordpressStatusCopy(status: WordPressStatus | null, listed: boolean): string {
  if (!listed || !status) {
    return "WordPress.org did not list this exact version in the stable-check response. That is not a claim it is safe or unsafe. Plugin and theme vulnerabilities are not covered.";
  }
  if (status === "latest") return "WordPress.org marks this exact version as latest in the core stable-check API. That is not a plugin, theme, or configuration audit.";
  if (status === "outdated") return "WordPress.org marks this exact version as outdated. The API does not include CVE records, so none are shown.";
  return "WordPress.org marks this exact version as insecure. The API does not include CVE records, so none are shown. Update core from the official package.";
}

export async function loadWordPressStableCheck(): Promise<{ map: Record<string, string>; retrievedAt: string; stale: boolean }> {
  const loaded = await getOrLoad({
    key: "wordpress-stable-check",
    ttlMs: 6 * 60 * 60 * 1000,
    allowStale: true,
    load: async () => {
      const json = await fetchJson<unknown>(WORDPRESS_STABLE_CHECK, {}, { timeoutMs: 15_000, retries: 1, deadlineMs: 20_000 });
      if (!json || typeof json !== "object" || Array.isArray(json)) throw new Error("WordPress stable-check was not an object");
      const map: Record<string, string> = {};
      for (const [key, value] of Object.entries(json)) {
        if (typeof value === "string") map[key] = value;
      }
      if (Object.keys(map).length === 0) throw new Error("WordPress stable-check was empty");
      return map;
    },
  });
  return { map: loaded.data, retrievedAt: loaded.storedAt, stale: loaded.stale };
}
