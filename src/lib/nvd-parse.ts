import { parseAffectedVersion, parsePhpRuntimeCpe, type CpeMatch } from "@/lib/ranges";
import type { CvssMetric, NormalizedCve, ReferenceLink } from "@/lib/types";

type RawMetric = {
  type?: string;
  cvssData?: {
    version?: string;
    vectorString?: string;
    baseScore?: number;
    baseSeverity?: string;
  };
};

type RawCve = {
  id?: string;
  published?: string;
  vulnStatus?: string;
  descriptions?: { lang?: string; value?: string }[];
  metrics?: Record<string, RawMetric[] | undefined>;
  weaknesses?: { description?: { lang?: string; value?: string }[] }[];
  references?: { url?: string; tags?: string[] }[];
  configurations?: {
    operator?: string;
    nodes?: {
      operator?: string;
      negate?: boolean;
      cpeMatch?: CpeMatch[];
    }[];
  }[];
  affected?: {
    source?: string;
    affectedData?: {
      vendor?: string;
      product?: string;
      defaultStatus?: string;
      modules?: string[];
      platforms?: string[];
      versions?: {
        version?: string;
        lessThan?: string;
        lessThanOrEqual?: string;
        greaterThan?: string;
        greaterThanOrEqual?: string;
        status?: string;
      }[];
    }[];
  }[];
};

const METRIC_KEYS = ["cvssMetricV40", "cvssMetricV31", "cvssMetricV30", "cvssMetricV2"] as const;

function isPhpProduct(vendor: string, product: string): boolean {
  return /^php$/i.test(product) && /php/i.test(vendor);
}

function isPhpNetSource(source: string): boolean {
  return /php\.net/i.test(source);
}

export function parseNvdCve(raw: unknown): NormalizedCve | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as { cve?: RawCve };
  const cve = record.cve ?? (raw as RawCve);
  if (!cve.id || !cve.id.startsWith("CVE-")) return null;
  if ((cve.vulnStatus ?? "").toLowerCase() === "rejected") return null;

  const description =
    cve.descriptions?.find((item) => item.lang === "en")?.value ??
    cve.descriptions?.[0]?.value ??
    "";

  const weaknesses: string[] = [];
  for (const weakness of cve.weaknesses ?? []) {
    for (const item of weakness.description ?? []) {
      if (item.value && /^CWE-\d+$/i.test(item.value)) weaknesses.push(item.value.toUpperCase());
    }
  }

  const phpNetRanges = [];
  const phpNetUnaffectedRanges = [];
  const prerequisites: string[] = [];
  let sawPhpNet = false;

  for (const block of cve.affected ?? []) {
    if (!isPhpNetSource(block.source ?? "")) continue;
    for (const product of block.affectedData ?? []) {
      if (!isPhpProduct(product.vendor ?? "", product.product ?? "")) continue;
      sawPhpNet = true;
      for (const moduleName of product.modules ?? []) {
        prerequisites.push(`Module: ${moduleName}`);
      }
      for (const platform of product.platforms ?? []) {
        prerequisites.push(`Platform: ${platform}`);
      }
      for (const version of product.versions ?? []) {
        const status = (version.status ?? "affected").toLowerCase();
        const parsed = parseAffectedVersion({ ...version, status: "affected" });
        if (status === "unaffected") phpNetUnaffectedRanges.push(...parsed);
        else if (status === "affected") phpNetRanges.push(...parsed);
      }
    }
  }

  const cpeRanges = [];
  for (const configuration of cve.configurations ?? []) {
    const configurationOperator = (configuration.operator ?? "OR").toUpperCase();
    const nodes = configuration.nodes ?? [];
    const phpNodes = [];
    const otherCriteria: string[] = [];
    for (const node of nodes) {
      if (node.negate) continue;
      const matches = node.cpeMatch ?? [];
      const phpMatches = matches
        .map((match) => parsePhpRuntimeCpe(match))
        .filter((range) => range !== null);
      if (phpMatches.length > 0) {
        phpNodes.push(...phpMatches);
      } else {
        for (const match of matches) {
          if (match.criteria) otherCriteria.push(match.criteria);
        }
      }
    }
    cpeRanges.push(...phpNodes);
    if (configurationOperator === "AND" && phpNodes.length > 0) {
      for (const criteria of otherCriteria) {
        prerequisites.push(`NVD configuration also requires ${criteria}`);
      }
    }
  }

  if (!sawPhpNet && cpeRanges.length === 0 && phpNetRanges.length === 0) return null;

  const references = pickReferences(cve.references ?? []);
  const phpNetHasPrecise = phpNetRanges.some((range) => range.precision === "precise");

  return {
    id: cve.id,
    description,
    published: cve.published ?? null,
    weaknesses: [...new Set(weaknesses)],
    cvss: pickCvss(cve.metrics ?? {}),
    references,
    phpNetRanges,
    phpNetUnaffectedRanges,
    phpNetHasPrecise,
    cpeRanges,
    prerequisites: [...new Set(prerequisites)],
  };
}

function pickCvss(metrics: Record<string, RawMetric[] | undefined>): CvssMetric | null {
  for (const key of METRIC_KEYS) {
    const list = metrics[key];
    if (!list?.length) continue;
    const chosen = list.find((item) => item.type === "Primary") ?? list[0];
    const data = chosen?.cvssData;
    if (!data || typeof data.baseScore !== "number" || !data.version) continue;
    return {
      score: data.baseScore,
      severity: data.baseSeverity ?? null,
      version: data.version,
      vector: data.vectorString ?? null,
    };
  }
  return null;
}

function pickReferences(references: { url?: string; tags?: string[] }[]): ReferenceLink[] {
  const scored = references
    .filter((item): item is { url: string; tags?: string[] } => Boolean(item.url))
    .map((item) => ({
      url: item.url,
      tags: item.tags ?? [],
      score: scoreReference(item.url, item.tags ?? []),
    }))
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, 12).map(({ url, tags }) => ({ url, tags }));
}

function scoreReference(url: string, tags: string[]): number {
  let score = 0;
  if (tags.includes("Vendor Advisory")) score += 5;
  if (tags.includes("Patch")) score += 4;
  if (tags.includes("Release Notes")) score += 3;
  if (url.includes("php.net")) score += 4;
  if (url.includes("github.com/php/php-src")) score += 4;
  if (url.includes("nvd.nist.gov")) score += 1;
  return score;
}
