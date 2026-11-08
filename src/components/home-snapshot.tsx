import Link from "next/link";
import { cacheLife } from "next/cache";
import { Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { loadBranchCatalog } from "@/lib/dataset";
import { supportLabel } from "@/lib/lifecycle";
import { log } from "@/lib/log";
import { loadNews, type NewsItem } from "@/lib/news";
import type { PhpBranch } from "@/lib/types";

type BranchLoad = { ok: true; branches: PhpBranch[]; retrievedAt: string | null; stale: boolean } | { ok: false; message: string };
type NewsLoad = { ok: true; items: NewsItem[]; stale: boolean } | { ok: false; message: string };

async function loadBranches(): Promise<BranchLoad> {
  "use cache";
  cacheLife("hours");
  try {
    const data = await loadBranchCatalog();
    if (data.branches.length === 0) return { ok: false, message: "Official PHP branch data could not be loaded right now." };
    return { ok: true, branches: data.branches, retrievedAt: data.retrievedAt, stale: data.stale };
  } catch (error) {
    log.error("home.branches.failed", { error });
    return { ok: false, message: "Official PHP branch data could not be loaded right now." };
  }
}

async function loadHeadlines(): Promise<NewsLoad> {
  "use cache";
  cacheLife("hours");
  try {
    const feed = await loadNews();
    if (feed.items.length === 0) return { ok: false, message: "Official news feeds could not be loaded right now." };
    return { ok: true, items: feed.items.slice(0, 5), stale: feed.stale };
  } catch (error) {
    log.error("home.news.failed", { error });
    return { ok: false, message: "Official news feeds could not be loaded right now." };
  }
}

export function HomeSnapshot() {
  return (
    <section className="mx-auto w-full min-w-0 max-w-6xl px-4 pb-16">
      <Suspense
        fallback={
          <div className="mt-10 grid gap-4 lg:grid-cols-2" aria-busy="true">
            <p className="sr-only" role="status">Loading official PHP support data and headlines…</p>
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        }
      >
        <Snapshot />
      </Suspense>
    </section>
  );
}

async function Snapshot() {
  const [branches, news] = await Promise.all([loadBranches(), loadHeadlines()]);
  const supported = branches.ok ? branches.branches.filter((branch) => branch.state === "active" || branch.state === "security") : [];
  const active = supported.filter((branch) => branch.state === "active").length;
  const security = supported.filter((branch) => branch.state === "security").length;

  return (
    <div className="mt-10 grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Supported PHP versions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {branches.ok ? (
            <>
              <p className="text-muted-foreground">
                php.net currently lists <strong className="text-foreground">{active}</strong> {active === 1 ? "branch" : "branches"} in active
                support and <strong className="text-foreground">{security}</strong> in security-only support.
                {branches.stale ? " This copy is stale." : ""}
                {branches.retrievedAt ? ` Retrieved ${branches.retrievedAt}.` : ""}
              </p>
              <ul className="space-y-2">
                {supported.map((branch) => (
                  <li key={branch.branch} className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/70 pb-2">
                    <span>PHP {branch.branch} · {supportLabel(branch.state)}</span>
                    {branch.latestPatch ? (
                      <Link className="font-mono text-primary underline-offset-2 hover:underline" href={`/check/${branch.latestPatch}`}>
                        {branch.latestPatch}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">Latest patch not listed</span>
                    )}
                  </li>
                ))}
              </ul>
              <Link className="inline-block text-primary underline-offset-2 hover:underline" href="/php-versions">
                Open the support timeline
              </Link>
            </>
          ) : (
            <p role="alert" className="text-muted-foreground">
              {branches.message} The timeline is on <Link className="underline" href="/php-versions">PHP versions</Link>.
            </p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Latest official updates</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {news.ok ? (
            <>
              <p className="text-muted-foreground">
                Headlines and links only. Article text is not copied here.
                {news.stale ? " One or more feeds came from a stale cache." : ""}
              </p>
              <ul className="space-y-3">
                {news.items.map((item) => (
                  <li key={`${item.sourceId}-${item.url}`}>
                    <a className="font-medium text-primary underline-offset-2 hover:underline" href={item.url} target="_blank" rel="noreferrer">
                      {item.title}
                    </a>
                    <p className="text-xs text-muted-foreground">
                      {item.sourceName}
                      {item.publishedAt ? ` · ${item.publishedAt.slice(0, 10)}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
              <Link className="inline-block text-primary underline-offset-2 hover:underline" href="/news">
                All security news
              </Link>
            </>
          ) : (
            <p role="alert" className="text-muted-foreground">
              {news.message} Try the <Link className="underline" href="/news">news page</Link>.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
