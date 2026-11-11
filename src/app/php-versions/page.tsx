import type { Metadata } from "next";
import Link from "next/link";
import { cacheLife } from "next/cache";
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { buildExplorerRows, type ExplorerRow } from "@/lib/cve-explorer";
import { loadBranchCatalog, loadDataset } from "@/lib/dataset";
import { supportLabel } from "@/lib/lifecycle";
import { SITE_URL } from "@/lib/site";
import { buildScorecard, recommendedBranch, RISK_LABEL, type RiskLevel } from "@/lib/scorecard";
import { buildTimeline, stateCounts, type Timeline } from "@/lib/timeline";
import type { PhpBranch, SupportState } from "@/lib/types";
import { parsePhpVersion } from "@/lib/version";
import { log } from "@/lib/log";

export const metadata: Metadata = {
  title: "PHP versions support timeline",
  description:
    "Timeline and risk scorecard of every recent PHP branch from official php.net and NVD data: release date, active support, security-only window, end of life, latest patch, CVE counts and current status.",
  alternates: { canonical: new URL("/php-versions", SITE_URL).toString() },
};

type Loaded =
  | { ok: true; branches: PhpBranch[]; timeline: Timeline | null; cveRows: ExplorerRow[] | null; today: string; retrievedAt: string | null; stale: boolean }
  | { ok: false; message: string };

async function load(): Promise<Loaded> {
  "use cache";
  cacheLife("hours");
  try {
    const data = await loadBranchCatalog();
    if (data.branches.length === 0) return { ok: false, message: "Official PHP branch data could not be loaded right now." };
    const today = new Date().toISOString().slice(0, 10);
    let cveRows: ExplorerRow[] | null = null;
    try {
      const dataset = await loadDataset();
      cveRows = buildExplorerRows(dataset.cves, data.branches.map((b) => b.branch));
    } catch (error) {
      log.warn("php_versions_page.nvd_unavailable", { error });
    }
    return {
      ok: true,
      branches: data.branches,
      timeline: buildTimeline(data.branches, today),
      cveRows,
      today,
      retrievedAt: data.retrievedAt,
      stale: data.stale,
    };
  } catch (error) {
    log.error("php_versions_page.failed", { error });
    return { ok: false, message: "Official PHP branch data could not be loaded right now." };
  }
}

const BADGE: Record<SupportState, "ok" | "warning" | "danger" | "outline"> = {
  active: "ok",
  security: "warning",
  eol: "danger",
  unknown: "outline",
};

function day(value: string | null): string {
  if (!value) return "Not published";
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, d)),
  );
}

const RISK_BADGE: Record<RiskLevel, "ok" | "warning" | "danger" | "outline"> = {
  lower: "ok",
  moderate: "warning",
  high: "danger",
  unknown: "outline",
};

function daysLeftText(days: number | null): string {
  if (days === null) return "Not published";
  if (days < 0) return `Ended ${Math.abs(days)} days ago`;
  if (days === 0) return "Ends today";
  return `${days} days left`;
}

function PatchLink({ version }: { version: string | null }) {
  if (!version) return <span className="text-muted-foreground">Not provided</span>;
  if (!parsePhpVersion(version)) return <span className="font-mono">{version}</span>;
  return (
    <Link className="font-mono underline underline-offset-2" href={`/check/${version}`}>
      {version}
    </Link>
  );
}

export default function PhpVersionsPage() {
  return (
    <main className="mx-auto w-full min-w-0 max-w-6xl px-4 py-10">
      <p className="text-sm font-medium uppercase tracking-[0.18em] text-primary">Lifecycle</p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight">PHP versions support timeline</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        When each PHP branch was released, how long it gets bug fixes, when it drops to security fixes only, and when it
        reaches end of life. All dates come from official php.net data.
      </p>
      <Suspense
        fallback={
          <div className="mt-8 space-y-3" aria-busy="true">
            <p className="sr-only" role="status">Loading PHP branch data…</p>
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-80 w-full" />
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
  const { branches, timeline, today } = loaded;
  const counts = stateCounts(branches);
  const supported = branches.filter((b) => b.state === "active" || b.state === "security");
  const scorecard = buildScorecard(branches, loaded.cveRows, today);
  const target = recommendedBranch(scorecard);

  return (
    <div className="mt-8 space-y-8">
      {loaded.stale && (
        <p className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
          This data is from a stale cache{loaded.retrievedAt ? ` synced ${loaded.retrievedAt}` : ""}. It may not be current.
        </p>
      )}

      <section aria-labelledby="summary" className="grid gap-3 sm:grid-cols-3">
        <h2 id="summary" className="sr-only">Summary</h2>
        {(["active", "security", "eol"] as const).map((state) => (
          <Card key={state}>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">{supportLabel(state)}</p>
              <p className="mt-1 text-3xl font-semibold">{counts[state]}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {state === "eol"
                  ? "branches with no more fixes"
                  : branches
                      .filter((b) => b.state === state)
                      .map((b) => b.branch)
                      .join(", ") || "none"}
              </p>
            </CardContent>
          </Card>
        ))}
      </section>

      {scorecard.length > 0 && (
        <section aria-labelledby="scorecard">
          <h2 id="scorecard" className="text-2xl font-semibold tracking-tight">Branch risk scorecard</h2>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Which branch is safest to run today? The risk label comes only from the official php.net support state.
            CVE counts are NVD records whose affected-version ranges map to that branch, so they show how much has been
            reported, not what is still open: the latest patch of a supported branch includes the published fixes.
            {target ? ` Suggested upgrade target: PHP ${target}.` : ""}
          </p>
          <Card className="mt-4">
            <CardContent className="overflow-x-auto p-0">
              <table className="w-full min-w-[640px] text-sm">
                <caption className="sr-only">Risk scorecard for each PHP branch</caption>
                <thead className="border-b text-left text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-4 py-2 font-medium">Branch</th>
                    <th scope="col" className="px-4 py-2 font-medium">Risk</th>
                    <th scope="col" className="px-4 py-2 font-medium">Support</th>
                    <th scope="col" className="px-4 py-2 font-medium">Security fixes</th>
                    <th scope="col" className="px-4 py-2 font-medium">NVD CVEs</th>
                    <th scope="col" className="px-4 py-2 font-medium">Critical or high</th>
                    <th scope="col" className="px-4 py-2 font-medium">Latest patch</th>
                  </tr>
                </thead>
                <tbody>
                  {scorecard.map((row) => (
                    <tr key={row.branch} className="border-b last:border-0">
                      <th scope="row" className="px-4 py-2 text-left font-mono font-medium">PHP {row.branch}</th>
                      <td className="px-4 py-2"><Badge variant={RISK_BADGE[row.risk]}>{RISK_LABEL[row.risk]}</Badge></td>
                      <td className="px-4 py-2">{supportLabel(row.state)}</td>
                      <td className="px-4 py-2">{daysLeftText(row.daysOfSecuritySupportLeft)}</td>
                      <td className="px-4 py-2">
                        {row.cveCount === null ? (
                          <span className="text-muted-foreground">Unavailable</span>
                        ) : (
                          <Link className="underline underline-offset-2" href={`/cves?branch=${row.branch}`}>{row.cveCount}</Link>
                        )}
                      </td>
                      <td className="px-4 py-2">{row.criticalHighCount ?? <span className="text-muted-foreground">Unavailable</span>}</td>
                      <td className="px-4 py-2"><PatchLink version={row.latestPatch} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
          {loaded.cveRows === null && (
            <p className="mt-2 text-sm text-muted-foreground" role="status">NVD data could not be loaded right now, so CVE counts are hidden.</p>
          )}
        </section>
      )}

      {timeline && (
        <section aria-labelledby="timeline">
          <h2 id="timeline" className="text-2xl font-semibold tracking-tight">Support timeline</h2>
          <div className="mt-3 flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-2"><span className="inline-block h-3 w-6 rounded-sm bg-ok" aria-hidden="true" />Active support</span>
            <span className="flex items-center gap-2"><span className="inline-block h-3 w-6 rounded-sm bg-warning" aria-hidden="true" />Security fixes only</span>
            <span className="flex items-center gap-2"><span className="inline-block h-3 w-0.5 bg-primary" aria-hidden="true" />Today ({day(today)})</span>
          </div>
          <Card className="mt-4">
            <CardContent className="overflow-x-auto p-4">
              <div className="min-w-[640px]">
                <div className="relative ml-16 h-6 text-xs text-muted-foreground" aria-hidden="true">
                  {timeline.years.map((y) => (
                    <span key={y.year} className="absolute -translate-x-1/2" style={{ left: `${y.left}%` }}>
                      {y.year}
                    </span>
                  ))}
                </div>
                <ul className="space-y-2">
                  {timeline.rows.map((row) => (
                    <li key={row.branch} className="flex items-center gap-2">
                      <span className="w-14 shrink-0 font-mono text-sm font-medium">{row.branch}</span>
                      <div
                        className="relative h-6 flex-1 rounded-sm bg-muted/40"
                        role="img"
                        aria-label={`PHP ${row.branch}: released ${day(row.initialReleaseDate)}, active support until ${day(row.activeSupportEnd)}, security fixes until ${day(row.securitySupportEnd)}. ${supportLabel(row.state)}.`}
                      >
                        {timeline.years.map((y) => (
                          <span key={y.year} className="absolute inset-y-0 w-px bg-border" style={{ left: `${y.left}%` }} aria-hidden="true" />
                        ))}
                        <span
                          className={`absolute inset-y-1 rounded-l-sm bg-ok ${row.state === "eol" ? "opacity-50" : ""}`}
                          style={{ left: `${row.active.left}%`, width: `${row.active.width}%` }}
                        />
                        <span
                          className={`absolute inset-y-1 rounded-r-sm bg-warning ${row.state === "eol" ? "opacity-50" : ""}`}
                          style={{ left: `${row.security.left}%`, width: `${row.security.width}%` }}
                        />
                        {timeline.today !== null && (
                          <span className="absolute -inset-y-1 w-0.5 bg-primary" style={{ left: `${timeline.today}%` }} aria-hidden="true" />
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
          <p className="mt-2 text-sm text-muted-foreground">Faded bars are branches that have reached end of life.</p>
        </section>
      )}

      <section aria-labelledby="branches">
        <h2 id="branches" className="text-2xl font-semibold tracking-tight">Branch details</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(timeline?.rows ?? []).map((row) => (
            <Card key={row.branch}>
              <CardContent className="space-y-2 p-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-mono text-xl font-semibold">PHP {row.branch}</h3>
                  <Badge variant={BADGE[row.state]}>{supportLabel(row.state)}</Badge>
                </div>
                <dl className="grid grid-cols-2 gap-x-2 gap-y-1 text-sm">
                  <dt className="text-muted-foreground">Released</dt><dd>{day(row.initialReleaseDate)}</dd>
                  <dt className="text-muted-foreground">Active support</dt><dd>{day(row.activeSupportEnd)}</dd>
                  <dt className="text-muted-foreground">Security fixes</dt><dd>{day(row.securitySupportEnd)}</dd>
                  <dt className="text-muted-foreground">Latest patch</dt><dd><PatchLink version={row.latestPatch} /></dd>
                </dl>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {supported.length > 0 && (
        <p className="text-sm text-muted-foreground">
          Still supported: {supported.map((b) => `PHP ${b.branch}`).join(", ")}. Check your exact version on the{" "}
          <Link className="underline" href="/">homepage</Link> or see every branch in the{" "}
          <Link className="underline" href="/versions">versions table</Link>.
        </p>
      )}
      <p className="text-sm text-muted-foreground">
        Sources: php.net supported-versions and end-of-life pages, the php.net releases JSON, the published support
        schedule and the NVD CVE API for the scorecard counts. Data refreshes every few hours{loaded.retrievedAt ? `; last synced ${loaded.retrievedAt}` : ""}.
      </p>
    </div>
  );
}
