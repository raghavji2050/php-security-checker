import type { Metadata } from "next";
import Link from "next/link";
import { cacheLife } from "next/cache";
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { loadBranchCatalog } from "@/lib/dataset";
import { supportLabel } from "@/lib/lifecycle";
import { log } from "@/lib/log";
import { allowsBranch, allowsNewerThan, extractConstraint, parsePhpConstraint } from "@/lib/php-constraint";
import { SITE_URL } from "@/lib/site";
import type { PhpBranch, SupportState } from "@/lib/types";
import { compareBranches } from "@/lib/version";

export const metadata: Metadata = {
  title: "composer.json PHP constraint checker",
  description:
    "Paste the PHP constraint from composer.json (like ^8.1) and see which official php.net branches it allows, and whether any of them are end of life.",
  alternates: { canonical: new URL("/composer/php-constraint", SITE_URL).toString() },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type Loaded = { ok: true; branches: PhpBranch[]; retrievedAt: string | null } | { ok: false };

async function load(): Promise<Loaded> {
  "use cache";
  cacheLife("hours");
  try {
    const data = await loadBranchCatalog();
    if (data.branches.length === 0) return { ok: false };
    return { ok: true, branches: [...data.branches].sort((a, b) => compareBranches(b.branch, a.branch)), retrievedAt: data.retrievedAt };
  } catch (error) {
    log.error("php_constraint_page.failed", { error });
    return { ok: false };
  }
}

const BADGE: Record<SupportState, "ok" | "warning" | "danger" | "outline"> = {
  active: "ok",
  security: "warning",
  eol: "danger",
  unknown: "outline",
};

export default function PhpConstraintPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main className="mx-auto w-full min-w-0 max-w-4xl px-4 py-10">
      <p className="text-sm font-medium uppercase tracking-[0.18em] text-primary">Composer</p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight">require.php constraint checker</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        Paste the <code className="text-xs">&quot;php&quot;</code> constraint from your <code className="text-xs">composer.json</code>{" "}
        <code className="text-xs">require</code> block. You will see which PHP branches it allows, using official php.net
        support dates, and whether it still lets people install your package on an end-of-life PHP.
      </p>
      <Suspense fallback={<Skeleton className="mt-8 h-64 w-full" />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Content({ searchParams }: { searchParams: SearchParams }) {
  const query = await searchParams;
  const raw = ((Array.isArray(query.c) ? query.c[0] : query.c) ?? "").slice(0, 300);
  const parsed = raw ? parsePhpConstraint(raw) : null;
  const loaded = await load();
  return (
    <>
      <Card className="mt-8">
        <CardContent className="p-4">
          <form method="get" action="/composer/php-constraint" className="flex flex-wrap gap-2">
            <label className="sr-only" htmlFor="c">PHP constraint</label>
            <input id="c" name="c" defaultValue={raw} placeholder='e.g. ^8.1 or "php": ">=8.2"' maxLength={300}
              className="h-10 w-72 max-w-full rounded-md border border-border bg-background px-3 font-mono text-sm" />
            <button type="submit" className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">Check constraint</button>
          </form>
          <p className="mt-2 text-xs text-muted-foreground">
            Supports Composer syntax: <code>^</code>, <code>~</code>, <code>*</code>, <code>&gt;=</code>/<code>&lt;</code>, hyphen ranges,
            and <code>||</code>. Stability flags like <code>@dev</code> are ignored.
          </p>
        </CardContent>
      </Card>
      {parsed && !parsed.ok && <p className="mt-4 text-sm text-warning" role="status">{parsed.error}</p>}
      {parsed?.ok && !loaded.ok && (
        <p className="mt-4 text-muted-foreground" role="alert">Official PHP branch data could not be loaded right now. Try again in a few minutes.</p>
      )}
      {parsed?.ok && loaded.ok && <Result constraint={extractConstraint(raw)} intervals={parsed.intervals} branches={loaded.branches} retrievedAt={loaded.retrievedAt} />}
    </>
  );
}

function Result({ constraint, intervals, branches, retrievedAt }: {
  constraint: string;
  intervals: Parameters<typeof allowsBranch>[0];
  branches: PhpBranch[];
  retrievedAt: string | null;
}) {
  // Show PHP 7.0 and newer, plus any older branch the constraint allows.
  const rows = branches
    .map((b) => ({ b, allowed: allowsBranch(intervals, b.branch) }))
    .filter((r) => r.allowed || compareBranches(r.b.branch, "7.0") >= 0);
  const allowed = rows.filter((r) => r.allowed);
  const eol = allowed.filter((r) => r.b.state === "eol");
  const supported = allowed.filter((r) => r.b.state === "active" || r.b.state === "security");
  const newest = branches[0]?.branch;
  const future = newest ? allowsNewerThan(intervals, newest) : false;
  const oldestSupported = [...branches].reverse().find((b) => b.state === "active" || b.state === "security");
  return (
    <section aria-labelledby="result" className="mt-8" data-testid="constraint-result">
      <h2 id="result" className="text-2xl font-semibold tracking-tight">
        <code className="font-mono">{constraint}</code> allows {allowed.length} of {rows.length} PHP branches shown
      </h2>
      {allowed.length === 0 ? (
        <p className="mt-3 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm" role="status">This constraint allows no released PHP branch.</p>
      ) : eol.length > 0 ? (
        <p className="mt-3 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm" role="status">
          <strong>Allows end-of-life PHP:</strong> {eol.map((r) => r.b.branch).join(", ")}. These branches get no security fixes from php.net.
          {oldestSupported ? <> Consider raising the floor to <code className="font-mono">^{oldestSupported.branch}</code>.</> : null}
        </p>
      ) : (
        <p className="mt-3 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm" role="status">
          Every allowed branch still gets official security fixes ({supported.map((r) => r.b.branch).join(", ")}).
        </p>
      )}
      {future && <p className="mt-2 text-sm text-muted-foreground">It also allows future PHP branches newer than {newest}, which are not released or tested yet.</p>}
      <div className="mt-4 overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left">
            <tr><th className="p-3">Branch</th><th className="p-3">Allowed?</th><th className="p-3">Support (php.net)</th><th className="p-3">Security fixes until</th></tr>
          </thead>
          <tbody>
            {rows.map(({ b, allowed: ok }) => (
              <tr key={b.branch} className="border-t border-border">
                <td className="p-3 font-mono">PHP {b.branch}</td>
                <td className="p-3">{ok ? <strong>Yes</strong> : <span className="text-muted-foreground">No</span>}</td>
                <td className="p-3"><Badge variant={BADGE[b.state]}>{supportLabel(b.state)}</Badge></td>
                <td className="p-3">{b.securitySupportEnd ?? "Not published"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Branch and support data from <a className="underline" href="https://www.php.net/supported-versions.php" target="_blank" rel="noreferrer">php.net</a>
        {retrievedAt ? `, synced ${retrievedAt}` : ""}. See the <Link className="underline" href="/php-versions">support timeline</Link> for details.
      </p>
    </section>
  );
}
