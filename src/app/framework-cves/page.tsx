import type { Metadata } from "next";
import Link from "next/link";
import { cacheLife } from "next/cache";
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatStampWithZone } from "@/lib/format";
import {
  FRAMEWORK_PACKAGES,
  FRAMEWORK_SOURCES,
  buildFrameworkFeed,
  frameworkFeedHref,
  parseFrameworkFilter,
  severityVariant,
  type FrameworkFeedItem,
  type FrameworkId,
} from "@/lib/framework-feed";
import { log } from "@/lib/log";
import { loadAdvisoriesForPackages, type PackagistAdvisory } from "@/lib/packagist-advisories";
import { SITE_URL } from "@/lib/site";

export const maxDuration = 60;

export const metadata: Metadata = {
  title: "Laravel and Symfony CVE feed",
  description:
    "Newest security advisories for Laravel, Livewire and Symfony from Packagist, with severity, affected versions, CVE links and the composer update command.",
  alternates: { canonical: new URL("/framework-cves", SITE_URL).toString() },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type Loaded =
  | { ok: true; advisories: Record<string, PackagistAdvisory[]>; stale: boolean; retrievedAt: string }
  | { ok: false };

async function load(): Promise<Loaded> {
  "use cache";
  cacheLife("hours");
  try {
    const { advisories, stale } = await loadAdvisoriesForPackages(FRAMEWORK_PACKAGES);
    return { ok: true, advisories, stale, retrievedAt: new Date().toISOString() };
  } catch (error) {
    log.error("framework_cves_page.failed", { error });
    return { ok: false };
  }
}

export default function FrameworkCvesPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main className="mx-auto w-full min-w-0 max-w-6xl px-4 py-10">
      <p className="text-sm font-medium uppercase tracking-[0.18em] text-primary">Frameworks</p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight">Laravel and Symfony CVE feed</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        The newest security advisories for <code>laravel/framework</code>, <code>livewire/livewire</code> and{" "}
        <code>symfony/symfony</code>, straight from the Packagist security advisories API. Check your exact installed
        versions with the <Link className="underline" href="/composer">composer.lock scanner</Link>.
      </p>
      <Suspense
        fallback={
          <div className="mt-8 space-y-3" aria-busy="true">
            <p className="sr-only" role="status">Loading framework advisories…</p>
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
  const framework = parseFrameworkFilter(params.framework);
  const loaded = await load();
  if (!loaded.ok) {
    return (
      <p className="mt-8 text-muted-foreground" role="alert">
        Packagist advisories could not be loaded right now. Try again in a few minutes, or use the{" "}
        <Link className="underline" href="/laravel">Laravel</Link> and{" "}
        <Link className="underline" href="/symfony">Symfony</Link> checkers.
      </p>
    );
  }

  const items = buildFrameworkFeed(loaded.advisories, { framework });

  return (
    <div className="mt-8 space-y-8">
      {loaded.stale && (
        <p className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
          Packagist could not be reached, so this list is from a stale cache and may miss the newest advisories.
        </p>
      )}
      <p className="text-sm text-muted-foreground">
        Data last updated: {formatStampWithZone(loaded.retrievedAt, "Asia/Calcutta")}
      </p>

      <nav aria-label="Filter by framework" className="flex flex-wrap gap-2">
        <FilterLink current={framework} value={null} label="All" />
        {FRAMEWORK_SOURCES.map((source) => (
          <FilterLink key={source.id} current={framework} value={source.id} label={source.label} />
        ))}
      </nav>

      <section aria-labelledby="framework-list">
        <h2 id="framework-list" className="text-2xl font-semibold tracking-tight">Newest advisories</h2>
        <p className="mt-1 text-sm text-muted-foreground" role="status">
          Showing {items.length} advisor{items.length === 1 ? "y" : "ies"}, newest first.
        </p>
        {items.length === 0 ? (
          <p className="mt-4 text-muted-foreground">Packagist lists no advisories for this filter right now.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {items.map((item) => <AdvisoryRow key={item.advisoryId} item={item} />)}
          </ul>
        )}
      </section>

      <p className="text-sm text-muted-foreground">
        Source: <a className="underline" href="https://packagist.org/apidoc#list-security-advisories" target="_blank" rel="noopener noreferrer">Packagist security advisories API</a>{" "}
        (which aggregates GitHub Security Advisories and FriendsOfPHP). Severity is shown only when the source gives one.
        Titles and links point to the original advisory; this page is not endorsed by Laravel, Livewire or Symfony.
      </p>
    </div>
  );
}

function FilterLink({ current, value, label }: { current: FrameworkId | null; value: FrameworkId | null; label: string }) {
  const active = current === value;
  return (
    <Link
      href={frameworkFeedHref(value)}
      aria-current={active ? "page" : undefined}
      className={`rounded-md border px-3 py-1.5 text-sm ${active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-muted"}`}
    >
      {label}
    </Link>
  );
}

function AdvisoryRow({ item }: { item: FrameworkFeedItem }) {
  return (
    <li className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        {item.link ? (
          <a className="font-semibold text-primary underline-offset-2 hover:underline" href={item.link} target="_blank" rel="noopener noreferrer">
            {item.title}
          </a>
        ) : (
          <span className="font-semibold">{item.title}</span>
        )}
        <Badge variant={severityVariant(item.severity)}>{item.severity ? item.severity : "Severity not given"}</Badge>
        <Badge variant="secondary">{item.packageName}</Badge>
        <time className="text-xs text-muted-foreground" dateTime={item.reportedAt ?? undefined}>
          {formatStampWithZone(item.reportedAt, "Asia/Calcutta")}
        </time>
      </div>
      <dl className="mt-2 grid gap-1 text-sm text-muted-foreground sm:grid-cols-[auto_1fr] sm:gap-x-3">
        <dt>Affected</dt>
        <dd className="min-w-0 break-words font-mono text-xs text-foreground">{item.affectedRanges.join("  |  ") || "Not given"}</dd>
        <dt>ID</dt>
        <dd>
          {item.cveUrl ? (
            <a className="underline" href={item.cveUrl} target="_blank" rel="noopener noreferrer">{item.cve}</a>
          ) : (
            "No CVE assigned"
          )}{" "}
          · {item.advisoryId}
        </dd>
        <dt>Fix</dt>
        <dd className="min-w-0 break-words font-mono text-xs text-foreground">{item.updateCommand}</dd>
      </dl>
    </li>
  );
}
