import type { Metadata } from "next";
import Link from "next/link";
import { cacheLife } from "next/cache";
import { Suspense } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { changelogDiff } from "@/lib/changelog-diff";
import { loadDataset } from "@/lib/dataset";
import { log } from "@/lib/log";
import { SITE_URL } from "@/lib/site";
import type { ChangelogIndex } from "@/lib/types";

export const maxDuration = 300;

export const metadata: Metadata = {
  title: "Security fixes between two PHP versions",
  description:
    "Pick two PHP patch versions on the same branch and see every security fix (CVE and GHSA) you gain by upgrading, from the official php.net ChangeLog.",
  alternates: { canonical: new URL("/changes", SITE_URL).toString() },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type Loaded = { ok: true; index: ChangelogIndex; releases: Record<string, string[]> } | { ok: false };

async function load(): Promise<Loaded> {
  "use cache";
  cacheLife("hours");
  try {
    const data = await loadDataset();
    if (Object.keys(data.changelog).length === 0) return { ok: false };
    return { ok: true, index: data.changelog, releases: Object.fromEntries(data.branches.map((b) => [b.branch, b.releases])) };
  } catch (error) {
    log.error("changes_page.failed", { error });
    return { ok: false };
  }
}

function one(v: string | string[] | undefined): string {
  return ((Array.isArray(v) ? v[0] : v) ?? "").trim().slice(0, 32);
}

export default function ChangesPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main className="mx-auto w-full min-w-0 max-w-4xl px-4 py-10">
      <p className="text-sm font-medium uppercase tracking-[0.18em] text-primary">Upgrade</p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight">What changed between two PHP versions</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        Enter the version you run and the one you plan to move to on the same branch. You will see each release in between
        and the security fixes (CVE and GHSA IDs) that the official php.net ChangeLog lists for it.
      </p>
      <Suspense fallback={<Skeleton className="mt-8 h-64 w-full" />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Content({ searchParams }: { searchParams: SearchParams }) {
  const q = await searchParams;
  const from = one(q.from);
  const to = one(q.to);
  const loaded = from && to ? await load() : null;
  const branch = /^(\d+\.\d+)\./.exec(from)?.[1] ?? "";
  const diff = loaded?.ok ? changelogDiff(from, to, loaded.index, loaded.releases[branch] ?? []) : null;
  return (
    <>
      <Card className="mt-8">
        <CardContent className="p-4">
          <form method="get" action="/changes" className="flex flex-wrap items-end gap-2">
            <div>
              <label className="block text-sm font-medium" htmlFor="from">Current version</label>
              <input id="from" name="from" defaultValue={from} placeholder="8.3.10" maxLength={32}
                className="mt-1 h-10 w-36 rounded-md border border-border bg-background px-3 font-mono text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium" htmlFor="to">Upgrade to</label>
              <input id="to" name="to" defaultValue={to} placeholder="8.3.14" maxLength={32}
                className="mt-1 h-10 w-36 rounded-md border border-border bg-background px-3 font-mono text-sm" />
            </div>
            <button type="submit" className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">Compare</button>
          </form>
        </CardContent>
      </Card>
      {loaded && !loaded.ok && <p className="mt-4 text-muted-foreground" role="alert">The php.net ChangeLog could not be loaded right now. Try again in a few minutes.</p>}
      {diff && !diff.ok && <p className="mt-4 text-sm text-warning" role="status">{diff.error}</p>}
      {diff?.ok && (
        <section aria-labelledby="diff" className="mt-8" data-testid="changes-result">
          <h2 id="diff" className="text-2xl font-semibold tracking-tight">
            PHP {diff.from} → {diff.to}: {diff.releases.length} release{diff.releases.length === 1 ? "" : "s"}, {diff.securityIds.length} security ID{diff.securityIds.length === 1 ? "" : "s"} (CVE/GHSA)
          </h2>
          <ul className="mt-4 space-y-3">
            {diff.releases.map((r) => (
              <li key={r.version} className="rounded-md border border-border px-3 py-2 text-sm">
                <a className="font-mono font-medium underline" href={`https://www.php.net/ChangeLog-${r.version.split(".")[0]}.php#${r.version}`} target="_blank" rel="noreferrer">
                  PHP {r.version}
                </a>
                {r.securityIds.length === 0 ? (
                  <span className="text-muted-foreground"> · no CVE or GHSA listed (bug fixes only)</span>
                ) : (
                  <span>
                    {" "}· security:{" "}
                    {r.securityIds.map((id, i) => (
                      <span key={id}>
                        {i > 0 ? ", " : ""}
                        {id.startsWith("CVE-") ? (
                          <Link className="font-mono underline" href={`/cve/${id}`}>{id}</Link>
                        ) : (
                          <a className="font-mono underline" href={`https://github.com/php/php-src/security/advisories/${id}`} target="_blank" rel="noreferrer">{id}</a>
                        )}
                      </span>
                    ))}
                  </span>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">One issue can have both a CVE and a GHSA ID, so the ID count can be higher than the number of distinct bugs.</p>
          <p className="mt-3 text-sm">
            Full report for the target: <Link className="underline" href={`/check/${diff.to}`}>PHP {diff.to}</Link>. Source: the{" "}
            <a className="underline" href={`https://www.php.net/ChangeLog-${diff.from.split(".")[0]}.php`} target="_blank" rel="noreferrer">php.net ChangeLog</a>.
          </p>
        </section>
      )}
    </>
  );
}
