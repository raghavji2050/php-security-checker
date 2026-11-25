import type { PackagistAdvisory } from "@/lib/packagist-advisories";

/** Framework packages tracked on /framework-cves. Advisories come only from Packagist. */
export const FRAMEWORK_SOURCES = [
  { id: "laravel", label: "Laravel", packages: ["laravel/framework", "livewire/livewire"] },
  { id: "symfony", label: "Symfony", packages: ["symfony/symfony"] },
] as const;

export type FrameworkId = (typeof FRAMEWORK_SOURCES)[number]["id"];

export const FRAMEWORK_PACKAGES: string[] = FRAMEWORK_SOURCES.flatMap((source) => [...source.packages]);

export const FRAMEWORK_FEED_LIMIT = 60;

export type FrameworkFeedItem = {
  advisoryId: string;
  framework: FrameworkId;
  frameworkLabel: string;
  packageName: string;
  title: string;
  link: string | null;
  cve: string | null;
  cveUrl: string | null;
  severity: string | null;
  affectedRanges: string[];
  reportedAt: string | null;
  updateCommand: string;
};

export function parseFrameworkFilter(value: string | string[] | undefined): FrameworkId | null {
  const raw = Array.isArray(value) ? value[0] : value;
  const found = FRAMEWORK_SOURCES.find((source) => source.id === raw?.trim().toLowerCase());
  return found ? found.id : null;
}

export function frameworkFeedHref(framework: FrameworkId | null): string {
  return framework ? `/framework-cves?framework=${framework}` : "/framework-cves";
}

function frameworkFor(packageName: string): (typeof FRAMEWORK_SOURCES)[number] | null {
  return FRAMEWORK_SOURCES.find((source) => (source.packages as readonly string[]).includes(packageName)) ?? null;
}

function updateCommandFor(packageName: string): string {
  if (packageName === "symfony/symfony") return 'composer update "symfony/*" --with-all-dependencies';
  return `composer update ${packageName} --with-all-dependencies`;
}

/** Packagist uses "|" between ranges and sometimes "," inside one range. */
export function splitAffectedRanges(value: string): string[] {
  return value
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean);
}

function timeOf(value: string | null): number {
  if (!value) return 0;
  // Packagist sends "YYYY-MM-DD HH:MM:SS" in UTC.
  const iso = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value) ? `${value.replace(" ", "T")}Z` : value;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? 0 : t;
}

/** Normalises a Packagist timestamp to ISO (UTC) so it can be shown in IST. */
export function toIsoUtc(value: string | null): string | null {
  const t = timeOf(value);
  return t ? new Date(t).toISOString() : null;
}

/**
 * Builds the newest-first framework advisory list. Only uses records Packagist returned:
 * nothing is invented, unknown severity stays null, duplicates (same advisory id) are dropped.
 */
export function buildFrameworkFeed(
  advisories: Record<string, PackagistAdvisory[] | undefined>,
  options: { framework?: FrameworkId | null; limit?: number } = {},
): FrameworkFeedItem[] {
  const seen = new Set<string>();
  const items: FrameworkFeedItem[] = [];
  for (const [name, list] of Object.entries(advisories)) {
    const source = frameworkFor(name);
    if (!source || !Array.isArray(list)) continue;
    if (options.framework && source.id !== options.framework) continue;
    for (const advisory of list) {
      if (!advisory?.advisoryId || seen.has(advisory.advisoryId)) continue;
      seen.add(advisory.advisoryId);
      const cve = advisory.cve && /^CVE-\d{4}-\d{4,}$/.test(advisory.cve) ? advisory.cve : null;
      items.push({
        advisoryId: advisory.advisoryId,
        framework: source.id,
        frameworkLabel: source.label,
        packageName: name,
        title: advisory.title || advisory.advisoryId,
        link: advisory.link && /^https:\/\//.test(advisory.link) ? advisory.link : null,
        cve,
        cveUrl: cve ? `https://nvd.nist.gov/vuln/detail/${cve}` : null,
        severity: advisory.severity ? advisory.severity.toLowerCase() : null,
        affectedRanges: splitAffectedRanges(advisory.affectedVersions ?? ""),
        reportedAt: toIsoUtc(advisory.reportedAt),
        updateCommand: updateCommandFor(name),
      });
    }
  }
  items.sort((a, b) => timeOf(b.reportedAt) - timeOf(a.reportedAt) || a.advisoryId.localeCompare(b.advisoryId));
  return items.slice(0, options.limit ?? FRAMEWORK_FEED_LIMIT);
}

export function severityVariant(severity: string | null): "danger" | "warning" | "secondary" | "outline" {
  if (severity === "critical" || severity === "high") return "danger";
  if (severity === "medium" || severity === "moderate") return "warning";
  if (severity === "low") return "secondary";
  return "outline";
}
