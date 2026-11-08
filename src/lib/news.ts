import { getOrLoad, secondsFromEnv } from "@/lib/cache";
import { fetchText } from "@/lib/http";
import { log } from "@/lib/log";
import {
  extractBlocks,
  parseFeedEntry,
  parseFeedItems,
  resolveFeedUrl,
  toIsoStamp,
  unwrapXmlText,
  xmlTagText,
} from "@/lib/rss";

export const NEWS_SOURCE_IDS = [
  "php",
  "laravel",
  "wordpress",
  "composer",
  "apache",
  "mysql",
  "mariadb",
  "cisa",
] as const;

export type NewsSourceId = (typeof NEWS_SOURCE_IDS)[number];

export type NewsItem = {
  title: string;
  url: string;
  sourceId: NewsSourceId;
  sourceName: string;
  publishedAt: string | null;
  summary: string | null;
  official: boolean;
};

export type NewsSourceStatus = {
  key: string;
  name: string;
  ok: boolean;
  stale: boolean;
  retrievedAt: string | null;
};

export type NewsFeed = {
  items: NewsItem[];
  sources: NewsSourceStatus[];
  retrievedAt: string | null;
  stale: boolean;
};

export const NEWS_SOURCE_FILTERS: { id: NewsSourceId; label: string }[] = [
  { id: "php", label: "php.net" },
  { id: "laravel", label: "Laravel" },
  { id: "wordpress", label: "WordPress" },
  { id: "composer", label: "Composer (GitHub)" },
  { id: "apache", label: "Apache HTTP Server" },
  { id: "mysql", label: "MySQL (GitHub releases)" },
  { id: "mariadb", label: "MariaDB" },
  { id: "cisa", label: "CISA KEV" },
];

export const NEWS_PAGE_CAP = 50;
export const CVE_ID_RE = /CVE-\d{4}-\d{4,}/i;
const SECURITY_HINT = /secur|cve|advisory|vulnerab|patch|release|hotfix|exploit|bulletin|ghsa|\brc\d+\b|\bbeta\b|\bga\b/i;
const LAMP_WORDS = ["php", "laravel", "wordpress", "apache", "httpd", "mysql", "mariadb"] as const;
const HOUR = 60 * 60;

type SourceSpec = {
  key: string;
  name: string;
  sourceId: NewsSourceId;
  url: string;
  headers?: Record<string, string>;
  cap: number;
  parse: (body: string) => NewsItem[];
};

function words(value: string): string[] {
  return value.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

export function looksSecurityRelated(title: string): boolean {
  return SECURITY_HINT.test(title);
}

export function firstCveId(value: string): string | null {
  const match = CVE_ID_RE.exec(value);
  return match ? match[0].toUpperCase() : null;
}

/** Whole-word allowlist match; Apache-only hits must be HTTP Server / httpd (not Struts, Tomcat, ...). */
export function isLampRelevant(vendorProject: string, product: string): boolean {
  const tokens = words(`${vendorProject} ${product}`);
  const hits = LAMP_WORDS.filter((word) => tokens.includes(word));
  if (hits.length === 0) return false;
  const besidesApache = hits.filter((word) => word !== "apache");
  if (besidesApache.length > 0) return true;
  const productTokens = words(product);
  return productTokens.includes("httpd") || (productTokens.includes("http") && productTokens.includes("server"));
}

export function parseSourceFilter(raw: unknown): NewsSourceId | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== "string") return null;
  return (NEWS_SOURCE_IDS as readonly string[]).includes(value) ? (value as NewsSourceId) : null;
}

export function newsHref(source: NewsSourceId | null): string {
  if (!source) return "/news";
  return `/news?source=${encodeURIComponent(source)}`;
}

function makeItem(
  sourceId: NewsSourceId,
  sourceName: string,
  title: string,
  url: string,
  publishedAt: string | null,
  summary: string | null,
): NewsItem {
  return {
    title: title.trim(),
    url: url.trim(),
    sourceId,
    sourceName,
    publishedAt,
    summary,
    official: true,
  };
}

function metadataCveLine(kind: string, title: string): string | null {
  const cve = firstCveId(title);
  return cve ? `${kind} about ${cve}.` : null;
}

function applyTitleFilter(items: NewsItem[], required: boolean): NewsItem[] {
  if (!required) return items;
  return items.filter((item) => looksSecurityRelated(item.title));
}

function capItems(items: NewsItem[], cap: number): NewsItem[] {
  return items.slice(0, cap);
}

export function normalizeNewsUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    const path = parsed.pathname.replace(/\/+$/, "") || "/";
    return `${parsed.protocol}//${parsed.host.toLowerCase()}${path}${parsed.search}`;
  } catch {
    return url.trim().toLowerCase();
  }
}

export function dedupeNewsItems(items: NewsItem[]): NewsItem[] {
  const seen = new Set<string>();
  const out: NewsItem[] = [];
  for (const item of items) {
    const urlKey = normalizeNewsUrl(item.url);
    const titleKey = `${item.sourceId}::${item.title.trim().toLowerCase()}`;
    if (seen.has(urlKey) || seen.has(titleKey)) continue;
    seen.add(urlKey);
    seen.add(titleKey);
    out.push(item);
  }
  return out;
}

export function sortNewsItems(items: NewsItem[]): NewsItem[] {
  return items.slice().sort((left, right) => {
    if (left.publishedAt && right.publishedAt) return right.publishedAt.localeCompare(left.publishedAt);
    if (left.publishedAt) return -1;
    if (right.publishedAt) return 1;
    return 0;
  });
}

function fromFeed(
  xml: string,
  baseUrl: string,
  sourceId: NewsSourceId,
  sourceName: string,
  summaryFor: (title: string) => string | null,
): NewsItem[] {
  const items: NewsItem[] = [];
  for (const parsed of parseFeedItems(xml, baseUrl)) {
    items.push(makeItem(sourceId, sourceName, parsed.title, parsed.url, parsed.publishedAt, summaryFor(parsed.title)));
  }
  return items;
}

export function parsePhpReleaseFeed(xml: string, baseUrl = "https://www.php.net/releases/feed.php"): NewsItem[] {
  const items: NewsItem[] = [];
  for (const block of extractBlocks(xml, "entry")) {
    const parsed = parseFeedEntry(block, "atom", baseUrl);
    if (!parsed) continue;
    const version = xmlTagText(block, "version");
    const tag = xmlTagText(block, "tag");
    let summary: string | null = null;
    if (version) {
      summary = tag && /secur/i.test(tag) ? `Official PHP ${version} security release.` : `Official PHP ${version} release.`;
    }
    items.push(makeItem("php", "php.net releases", parsed.title, parsed.url, parsed.publishedAt, summary));
  }
  return items;
}

export function parseGithubComposerAdvisories(payload: unknown): NewsItem[] {
  if (!Array.isArray(payload)) return [];
  const items: NewsItem[] = [];
  for (const raw of payload) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Record<string, unknown>;
    if (typeof row.withdrawn_at === "string" && row.withdrawn_at) continue;
    const ghsaId = typeof row.ghsa_id === "string" ? row.ghsa_id.trim() : "";
    const url = typeof row.html_url === "string" ? resolveFeedUrl(row.html_url) : null;
    if (!ghsaId || !url) continue;
    const headline = typeof row.summary === "string" && row.summary.trim() ? row.summary.trim() : ghsaId;
    const cve = typeof row.cve_id === "string" && CVE_ID_RE.test(row.cve_id) ? row.cve_id.toUpperCase() : null;
    const summary = cve ? `Composer ecosystem advisory ${ghsaId} (${cve}).` : `Composer ecosystem advisory ${ghsaId}.`;
    items.push(
      makeItem("composer", "GitHub Advisories (Composer)", headline, url, toIsoStamp(typeof row.published_at === "string" ? row.published_at : null), summary),
    );
  }
  return items;
}

export function parseCisaKev(payload: unknown): NewsItem[] {
  if (!payload || typeof payload !== "object") return [];
  const list = (payload as { vulnerabilities?: unknown }).vulnerabilities;
  if (!Array.isArray(list)) return [];
  const items: NewsItem[] = [];
  for (const raw of list) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Record<string, unknown>;
    const cve = typeof row.cveID === "string" && CVE_ID_RE.test(row.cveID) ? row.cveID.toUpperCase() : null;
    const vendor = typeof row.vendorProject === "string" ? row.vendorProject : "";
    const product = typeof row.product === "string" ? row.product : "";
    if (!cve || !isLampRelevant(vendor, product)) continue;
    const title = typeof row.vulnerabilityName === "string" && row.vulnerabilityName.trim() ? row.vulnerabilityName.trim() : cve;
    const added = typeof row.dateAdded === "string" ? toIsoStamp(row.dateAdded) : null;
    const productLabel = [vendor, product].filter(Boolean).join(" ");
    items.push(
      makeItem(
        "cisa",
        "CISA KEV",
        title,
        `https://nvd.nist.gov/vuln/detail/${cve}`,
        added,
        productLabel ? `CISA Known Exploited Vulnerability ${cve} affecting ${productLabel}.` : `CISA Known Exploited Vulnerability ${cve}.`,
      ),
    );
  }
  return sortNewsItems(items);
}

export function parseApacheHttpdVulns(
  html: string,
  pageUrl = "https://httpd.apache.org/security/vulnerabilities_24.html",
): NewsItem[] {
  const times: { index: number; stamp: string }[] = [];
  const timeRe = /<time\b[^>]*\bdatetime=["']([^"']+)["'][^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = timeRe.exec(html))) {
    const stamp = toIsoStamp(match[1]);
    if (stamp) times.push({ index: match.index, stamp });
  }

  const items: NewsItem[] = [];
  const headingRe = /<h3\b[^>]*\bid=["'](CVE-\d{4}-\d+)["'][^>]*>([\s\S]*?)<\/h3>/gi;
  while ((match = headingRe.exec(html))) {
    const cve = match[1].toUpperCase();
    const inner = match[2];
    const nameMatch = /<name\b[^>]*>([\s\S]*?)<\/name>/i.exec(inner);
    const shortTitle = nameMatch ? unwrapXmlText(nameMatch[1]) : "";
    const title = shortTitle ? `${cve}: ${shortTitle}` : cve;
    const preceding = times.filter((entry) => entry.index < match!.index).at(-1);
    const url = `${pageUrl}#${cve}`;
    items.push(makeItem("apache", "Apache HTTP Server", title, url, preceding?.stamp ?? null, `Official Apache HTTP Server advisory for ${cve}.`));
  }
  return items;
}

function parseJsonBody(body: string): unknown {
  try {
    return JSON.parse(body) as unknown;
  } catch {
    return null;
  }
}

const SOURCES: SourceSpec[] = [
  {
    key: "php-releases",
    name: "php.net releases",
    sourceId: "php",
    url: "https://www.php.net/releases/feed.php",
    cap: 12,
    parse: (body) => capItems(parsePhpReleaseFeed(body, "https://www.php.net/releases/feed.php"), 12),
  },
  {
    key: "php-news",
    name: "php.net news",
    sourceId: "php",
    url: "https://www.php.net/feed.atom",
    cap: 8,
    parse: (body) =>
      capItems(
        applyTitleFilter(
          fromFeed(body, "https://www.php.net/feed.atom", "php", "php.net news", (title) => metadataCveLine("Official php.net news item", title)),
          true,
        ),
        8,
      ),
  },
  {
    key: "laravel-blog",
    name: "Laravel blog",
    sourceId: "laravel",
    url: "https://laravel.com/feed",
    cap: 8,
    parse: (body) =>
      capItems(
        applyTitleFilter(
          fromFeed(body, "https://laravel.com/feed", "laravel", "Laravel blog", (title) => metadataCveLine("Official Laravel blog item", title)),
          true,
        ),
        8,
      ),
  },
  {
    key: "wp-news",
    name: "WordPress news",
    sourceId: "wordpress",
    url: "https://wordpress.org/news/feed/",
    cap: 8,
    parse: (body) =>
      capItems(
        applyTitleFilter(
          fromFeed(body, "https://wordpress.org/news/feed/", "wordpress", "WordPress news", (title) =>
            metadataCveLine("Official WordPress news item", title),
          ),
          true,
        ),
        8,
      ),
  },
  {
    key: "wp-security",
    name: "WordPress security",
    sourceId: "wordpress",
    url: "https://wordpress.org/news/category/security/feed/",
    cap: 12,
    parse: (body) =>
      capItems(
        fromFeed(body, "https://wordpress.org/news/category/security/feed/", "wordpress", "WordPress security", () => "Official WordPress security announcement."),
        12,
      ),
  },
  {
    key: "ghsa-composer",
    name: "GitHub Advisories (Composer)",
    sourceId: "composer",
    url: "https://api.github.com/advisories?ecosystem=composer&per_page=20",
    headers: githubHeaders(),
    cap: 15,
    parse: (body) => capItems(parseGithubComposerAdvisories(parseJsonBody(body)), 15),
  },
  {
    key: "apache-httpd",
    name: "Apache HTTP Server",
    sourceId: "apache",
    url: "https://httpd.apache.org/security/vulnerabilities_24.html",
    cap: 12,
    parse: (body) => capItems(parseApacheHttpdVulns(body, "https://httpd.apache.org/security/vulnerabilities_24.html"), 12),
  },
  {
    key: "mariadb",
    name: "MariaDB",
    sourceId: "mariadb",
    url: "https://mariadb.org/feed/",
    cap: 8,
    parse: (body) =>
      capItems(
        applyTitleFilter(
          fromFeed(body, "https://mariadb.org/feed/", "mariadb", "MariaDB", (title) => metadataCveLine("Official MariaDB news item", title)),
          true,
        ),
        8,
      ),
  },
  {
    key: "mysql-github",
    name: "MySQL (GitHub releases)",
    sourceId: "mysql",
    url: "https://github.com/mysql/mysql-server/releases.atom",
    cap: 8,
    parse: (body) =>
      capItems(
        fromFeed(body, "https://github.com/mysql/mysql-server/releases.atom", "mysql", "MySQL (GitHub releases)", () => "Official MySQL server release tag on GitHub."),
        8,
      ),
  },
  {
    key: "cisa-kev",
    name: "CISA KEV",
    sourceId: "cisa",
    url: "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json",
    cap: 15,
    parse: (body) => capItems(parseCisaKev(parseJsonBody(body)), 15),
  },
];

function githubHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    accept: "application/vnd.github+json",
    "x-github-api-version": "2022-11-28",
  };
  if (process.env.GITHUB_TOKEN) headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return headers;
}

async function loadSource(spec: SourceSpec): Promise<{ status: NewsSourceStatus; items: NewsItem[] }> {
  const ttlMs = secondsFromEnv("NEWS_CACHE_TTL_SECONDS", HOUR) * 1000;
  try {
    const cached = await getOrLoad({
      key: `news-${spec.key}-v1`,
      ttlMs,
      allowStale: true,
      load: () => fetchText(spec.url, spec.headers ? { headers: spec.headers } : {}, { timeoutMs: 30_000, retries: 3 }),
    });
    return {
      status: { key: spec.key, name: spec.name, ok: true, stale: cached.stale, retrievedAt: cached.storedAt },
      items: spec.parse(cached.data),
    };
  } catch (error) {
    log.error("news.source_failed", { source: spec.key, error });
    return { status: { key: spec.key, name: spec.name, ok: false, stale: false, retrievedAt: null }, items: [] };
  }
}

export async function loadNews(): Promise<NewsFeed> {
  // Rebuild GHSA headers at request time so an existing token is picked up.
  const specs = SOURCES.map((spec) => (spec.key === "ghsa-composer" ? { ...spec, headers: githubHeaders() } : spec));
  const results = await Promise.all(specs.map((spec) => loadSource(spec)));
  const sources = results.map((result) => result.status);
  const items = dedupeNewsItems(sortNewsItems(results.flatMap((result) => result.items)));
  const retrievedAt = sources
    .map((source) => source.retrievedAt)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1) ?? null;
  return {
    items,
    sources,
    retrievedAt,
    stale: sources.some((source) => source.stale),
  };
}

export function filterNewsItems(items: NewsItem[], source: NewsSourceId | null): NewsItem[] {
  if (!source) return items;
  return items.filter((item) => item.sourceId === source);
}

export function presentNewsItems(items: NewsItem[], source: NewsSourceId | null): NewsItem[] {
  return filterNewsItems(items, source).slice(0, NEWS_PAGE_CAP);
}
