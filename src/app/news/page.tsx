import type { Metadata } from "next";
import Link from "next/link";
import { cacheLife } from "next/cache";
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatStampWithZone } from "@/lib/format";
import { log } from "@/lib/log";
import {
  NEWS_SOURCE_FILTERS,
  filterNewsItems,
  loadNews,
  newsHref,
  parseSourceFilter,
  presentNewsItems,
  type NewsFeed,
  type NewsItem,
  type NewsSourceId,
} from "@/lib/news";
import { SITE_URL } from "@/lib/site";

export const maxDuration = 300;

export const metadata: Metadata = {
  title: "PHP security news",
  description:
    "Headlines and links to official security news for PHP, Laravel, WordPress and the LAMP stack, from project feeds and APIs. We do not republish articles.",
  alternates: { canonical: new URL("/news", SITE_URL).toString() },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type Loaded = ({ ok: true } & NewsFeed) | { ok: false; message: string };

async function load(): Promise<Loaded> {
  "use cache";
  cacheLife("hours");
  try {
    const feed = await loadNews();
    if (feed.sources.every((source) => !source.ok) && feed.items.length === 0) {
      return { ok: false, message: "Official news feeds could not be loaded right now." };
    }
    return { ok: true, ...feed };
  } catch (error) {
    log.error("news_page.failed", { error });
    return { ok: false, message: "Official news feeds could not be loaded right now." };
  }
}

export default function NewsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main className="mx-auto w-full min-w-0 max-w-6xl px-4 py-10">
      <p className="text-sm font-medium uppercase tracking-[0.18em] text-primary">News</p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight">PHP security news</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        Recent security headlines for PHP, Laravel, WordPress and the LAMP stack. Each item is a title, source, date and
        a link to the original official page. We do not copy or republish articles.
      </p>
      <Suspense
        fallback={
          <div className="mt-8 space-y-3" aria-busy="true">
            <p className="sr-only" role="status">Loading official security news…</p>
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-96 w-full" />
          </div>
        }
      >
        <Content searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Content({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const source = parseSourceFilter(params.source);
  const loaded = await load();
  if (!loaded.ok) {
    return (
      <p className="mt-8 text-muted-foreground" role="alert">
        {loaded.message} Try again in a few minutes, or browse the{" "}
        <Link className="underline" href="/cves">CVE explorer</Link>.
      </p>
    );
  }

  const matched = presentNewsItems(loaded.items, source);
  const totalForSource = filterNewsItems(loaded.items, source).length;
  const failed = loaded.sources.filter((entry) => !entry.ok).map((entry) => entry.name);
  const stale = loaded.sources.filter((entry) => entry.stale).map((entry) => entry.name);

  return (
    <div className="mt-8 space-y-8">
      {failed.length > 0 && (
        <p className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
          Some official sources could not be loaded: {failed.join(", ")}. Other sources are shown below.
        </p>
      )}
      {stale.length > 0 && (
        <p className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
          These sources are from a stale cache and may not be current: {stale.join(", ")}.
        </p>
      )}

      <p className="text-sm text-muted-foreground">
        Data last updated: {formatStampWithZone(loaded.retrievedAt, "Asia/Calcutta")}
      </p>

      <form method="get" action="/news" className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4">
        <label className="grid min-w-[12rem] flex-1 gap-1 text-sm">
          <span className="text-muted-foreground">Source</span>
          <select name="source" defaultValue={source ?? ""} className="h-10 rounded-md border border-border bg-background px-2 text-sm">
            <option value="">All sources</option>
            {NEWS_SOURCE_FILTERS.map((entry) => (
              <option key={entry.id} value={entry.id}>{entry.label}</option>
            ))}
          </select>
        </label>
        <div className="flex items-end gap-2">
          <button type="submit" className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">Filter</button>
          {source && <Link href="/news" className="flex h-10 items-center px-2 text-sm underline">Reset</Link>}
        </div>
      </form>

      <p className="text-sm text-muted-foreground" role="status">
        Showing <strong className="text-foreground">{matched.length}</strong>
        {source ? ` ${labelFor(source)} item${matched.length === 1 ? "" : "s"}` : ` of ${totalForSource} official items`}.
      </p>

      <section aria-labelledby="news-list">
        <h2 id="news-list" className="text-2xl font-semibold tracking-tight">Headlines</h2>
        {matched.length === 0 ? (
          <p className="mt-4 text-muted-foreground">
            {source ? "No news items match this source filter right now." : "No matching items from the official feeds right now."}
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {matched.map((row) => <NewsRow key={`${row.sourceId}:${row.url}`} item={row} />)}
          </ul>
        )}
      </section>

      <p className="text-sm text-muted-foreground">
        Every item is taken from an official feed or API: php.net releases and news, the Laravel blog, WordPress.org news
        and security feeds, GitHub Security Advisories for Composer, the Apache HTTP Server vulnerabilities page, MariaDB.org,
        MySQL GitHub releases, and CISA&apos;s Known Exploited Vulnerabilities catalog (LAMP-related entries only). Headlines
        and links only — follow the original link to read the source. We do not republish articles. This page is not
        endorsed by those projects.
      </p>
    </div>
  );
}

function labelFor(source: NewsSourceId): string {
  return NEWS_SOURCE_FILTERS.find((entry) => entry.id === source)?.label ?? source;
}

function NewsRow({ item }: { item: NewsItem }) {
  return (
    <li className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <a
          className="font-semibold text-primary underline-offset-2 hover:underline"
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          {item.title}
        </a>
        <Link href={newsHref(item.sourceId)}>
          <Badge variant="secondary">{item.sourceName}</Badge>
        </Link>
        {!item.official && <Badge variant="warning">Unverified</Badge>}
        <time className="text-xs text-muted-foreground" dateTime={item.publishedAt ?? undefined}>
          {formatStampWithZone(item.publishedAt, "Asia/Calcutta")}
        </time>
      </div>
      {item.summary && <p className="mt-2 text-sm text-muted-foreground">{item.summary}</p>}
    </li>
  );
}
