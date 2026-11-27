import type { Metadata } from "next";
import Link from "next/link";
import { cacheLife } from "next/cache";
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { loadBranchCatalog } from "@/lib/dataset";
import { buildEolCountdown, countdownLabel, type EolCountdownRow } from "@/lib/eol-countdown";
import { log } from "@/lib/log";
import { recommendedBranch } from "@/lib/scorecard";
import { SITE_URL } from "@/lib/site";
import { parsePhpVersion } from "@/lib/version";

export const metadata: Metadata = {
  title: "PHP end-of-life countdown",
  description:
    "Days left until each PHP branch loses security support, from official php.net dates, with the branch to move to and php.net migration guides.",
  alternates: { canonical: new URL("/php-eol", SITE_URL).toString() },
};

type Loaded =
  | { ok: true; rows: EolCountdownRow[]; target: string | null; today: string; retrievedAt: string | null; stale: boolean }
  | { ok: false; message: string };

async function load(): Promise<Loaded> {
  "use cache";
  cacheLife("hours");
  try {
    const data = await loadBranchCatalog();
    if (data.branches.length === 0) return { ok: false, message: "Official PHP branch data could not be loaded right now." };
    const today = new Date().toISOString().slice(0, 10);
    return {
      ok: true,
      rows: buildEolCountdown(data.branches, today),
      target: recommendedBranch(data.branches),
      today,
      retrievedAt: data.retrievedAt,
      stale: data.stale,
    };
  } catch (error) {
    log.error("php_eol_page.failed", { error });
    return { ok: false, message: "Official PHP branch data could not be loaded right now." };
  }
}

function day(value: string): string {
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, d)),
  );
}

function tone(daysLeft: number): "ok" | "warning" | "danger" {
  if (daysLeft <= 90) return "danger";
  if (daysLeft <= 200) return "warning";
  return "ok";
}

export default function PhpEolPage() {
  return (
    <main className="mx-auto w-full min-w-0 max-w-4xl px-4 py-10">
      <p className="text-sm font-medium uppercase tracking-[0.18em] text-primary">Lifecycle</p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight">PHP end-of-life countdown</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        After a PHP branch reaches end of life, php.net stops shipping security fixes for it, so new vulnerabilities stay
        open. This page counts down to each upcoming end date using official php.net data and points to the branch to
        move to.
      </p>
      <Suspense
        fallback={
          <div className="mt-8 space-y-3" aria-busy="true">
            <p className="sr-only" role="status">Loading PHP branch data…</p>
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        }
      >
        <Content />
      </Suspense>
    </main>
  );
}

async function Content() {
  const loaded = await load();
  if (!loaded.ok) {
    return (
      <p className="mt-8 text-muted-foreground" role="alert">
        {loaded.message} The <Link className="underline" href="/versions">versions table</Link> retries live.
      </p>
    );
  }
  const { rows, target, today, retrievedAt, stale } = loaded;
  return (
    <>
      {target ? (
        <p className="mt-6 text-sm">
          Newest supported branch right now: <span className="font-mono font-semibold">PHP {target}</span>.{" "}
          <Link className="underline" href="/php-versions">See the full timeline</Link>.
        </p>
      ) : null}

      {rows.length === 0 ? (
        <p className="mt-8 text-muted-foreground" data-testid="eol-empty">
          No PHP branch reaches end of life in the next year according to php.net.
        </p>
      ) : (
        <ul className="mt-6 space-y-4" data-testid="eol-countdown">
          {rows.map((row) => {
            const ended = row.daysLeft < 0;
            return (
              <li key={row.branch}>
                <Card>
                  <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <h2 className="text-xl font-semibold">PHP {row.branch}</h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {ended ? "Security support ended" : "Security support ends"} on{" "}
                        <time dateTime={row.securitySupportEnd}>{day(row.securitySupportEnd)}</time>
                        {row.latestPatch ? (
                          <>
                            {" "}· last patch{" "}
                            {parsePhpVersion(row.latestPatch) ? (
                              <Link className="font-mono underline underline-offset-2" href={`/check/${row.latestPatch}`}>
                                {row.latestPatch}
                              </Link>
                            ) : (
                              <span className="font-mono">{row.latestPatch}</span>
                            )}
                          </>
                        ) : null}
                      </p>
                      <ul className="mt-3 space-y-1 text-sm">
                        {row.migrationGuide ? (
                          <li>
                            <a className="underline" href={row.migrationGuide.url} rel="noopener" target="_blank">
                              {row.migrationGuide.label}
                            </a>{" "}
                            <span className="text-muted-foreground">(php.net manual)</span>
                          </li>
                        ) : null}
                        <li>
                          <Link className="underline" href="/composer/php-constraint">
                            Check if your composer.json still allows PHP {row.branch}
                          </Link>
                        </li>
                      </ul>
                    </div>
                    <Badge variant={ended ? "danger" : tone(row.daysLeft)} className="shrink-0 self-start">
                      {countdownLabel(row.daysLeft)}
                    </Badge>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <h2 className="mt-10 text-xl font-semibold">Before you upgrade</h2>
      <ol className="mt-3 list-decimal space-y-1 pl-6 text-sm text-muted-foreground">
        <li>Read the php.net migration guide for each step (deprecated and removed features are listed there).</li>
        <li>
          Run your test suite on the new branch in CI first, and check your Composer packages support it (
          <Link className="underline" href="/composer">composer.lock scanner</Link>).
        </li>
        <li>
          Review your <Link className="underline" href="/php-ini">php.ini</Link> and{" "}
          <Link className="underline" href="/extensions">extensions</Link> on the new build.
        </li>
        <li>
          Subscribe to the <a className="underline" href="/php-versions/calendar.ics">support end dates calendar</a> so the
          next date does not surprise you.
        </li>
      </ol>

      <p className="mt-8 text-xs text-muted-foreground">
        Source: <a className="underline" href="https://www.php.net/supported-versions.php">php.net supported versions</a>.
        Counted from {day(today)} (UTC).
        {retrievedAt ? ` Data retrieved ${retrievedAt.slice(0, 10)}.` : ""}
        {stale ? " Showing the last good copy because php.net was unreachable." : ""} Linux distributions may keep
        backporting fixes to their own PHP packages after php.net end of life.
      </p>
    </>
  );
}
