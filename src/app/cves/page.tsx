import type { Metadata } from "next";
import Link from "next/link";
import { cacheLife } from "next/cache";
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  SEVERITIES,
  branchOptions,
  buildExplorerRows,
  countBySeverity,
  countByYear,
  filterHref,
  filterRows,
  pageList,
  parseFilters,
  sortRows,
  type ExplorerFilters,
  type ExplorerRow,
  type Severity,
} from "@/lib/cve-explorer";
import { DataUnavailableError, loadDataset } from "@/lib/dataset";
import { KEV_CATALOG_PAGE, lookupKev, type KevEntry } from "@/lib/kev";
import { log } from "@/lib/log";
import { SITE_URL } from "@/lib/site";

export const maxDuration = 300;

export const metadata: Metadata = {
  title: "PHP CVE explorer",
  description:
    "Explore every PHP interpreter CVE in NIST NVD: search, filter by year, CVSS severity and affected PHP branch, with CVEs-per-year and severity charts.",
  alternates: { canonical: new URL("/cves", SITE_URL).toString() },
};

const PAGE_SIZE = 50;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type Loaded =
  | { ok: true; rows: ExplorerRow[]; retrievedAt: string | null; stale: boolean; kev: Record<string, KevEntry>; kevOk: boolean }
  | { ok: false; message: string };

async function load(): Promise<Loaded> {
  "use cache";
  cacheLife("hours");
  try {
    const data = await loadDataset();
    const known = data.branches.map((b) => b.branch);
    const rows = buildExplorerRows(data.cves, known);
    const kev = await lookupKev(rows.map((r) => r.id));
    return { ok: true, rows, retrievedAt: data.retrievedAt, stale: data.stale, kev: kev.entries, kevOk: kev.ok };
  } catch (error) {
    if (error instanceof DataUnavailableError) return { ok: false, message: error.message };
    log.error("cves_page.failed", { error });
    return { ok: false, message: "NVD data could not be loaded right now." };
  }
}

const SEVERITY_BADGE: Record<Severity, "danger" | "warning" | "secondary" | "outline"> = {
  CRITICAL: "danger",
  HIGH: "danger",
  MEDIUM: "warning",
  LOW: "secondary",
  UNRATED: "outline",
};

const SEVERITY_BAR: Record<Severity, string> = {
  CRITICAL: "bg-danger",
  HIGH: "bg-danger/70",
  MEDIUM: "bg-warning",
  LOW: "bg-primary/60",
  UNRATED: "bg-muted-foreground/40",
};

function label(severity: Severity): string {
  return severity === "UNRATED" ? "Unrated" : severity.charAt(0) + severity.slice(1).toLowerCase();
}

export default function CvesPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main className="mx-auto w-full min-w-0 max-w-6xl px-4 py-10">
      <p className="text-sm font-medium uppercase tracking-[0.18em] text-primary">Explorer</p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight">PHP CVE explorer</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        Every CVE that NIST NVD links to the PHP interpreter (CPE <span className="font-mono text-sm">php:php</span>).
        Search and filter by year, severity and affected branch. Branches come only from NVD version ranges; when NVD
        gives no usable range the branch is shown as unknown.
      </p>
      <Suspense
        fallback={
          <div className="mt-8 space-y-3" aria-busy="true">
            <p className="sr-only" role="status">Loading CVE data from NVD…</p>
            <Skeleton className="h-40 w-full" />
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
  const loaded = await load();
  if (!loaded.ok) {
    return (
      <p className="mt-8 text-muted-foreground" role="alert">
        {loaded.message} Try again in a few minutes, or use the{" "}
        <Link className="underline" href="/vulnerabilities">vulnerabilities list</Link>.
      </p>
    );
  }
  const filters = parseFilters(params);
  const all = loaded.rows;
  const matched = sortRows(filterRows(all, filters), filters.sort);
  const pageRaw = Number(Array.isArray(params.page) ? params.page[0] : params.page);
  const pages = Math.max(1, Math.ceil(matched.length / PAGE_SIZE));
  const page = Number.isInteger(pageRaw) && pageRaw >= 1 ? Math.min(pageRaw, pages) : 1;
  const shown = matched.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const years = countByYear(matched);
  const severities = countBySeverity(matched);
  const allYears = countByYear(all).map((y) => y.year).reverse();
  const branches = branchOptions(all);
  const filtered = Boolean(filters.q || filters.year || filters.severity || filters.branch || filters.minScore !== null || filters.sort !== "published");

  return (
    <div className="mt-8 space-y-8">
      {loaded.stale && (
        <p className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
          This NVD data is from a stale cache{loaded.retrievedAt ? ` synced ${loaded.retrievedAt}` : ""}. It may not be current.
        </p>
      )}

      <form method="get" action="/cves" className="grid gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Search ID or description</span>
          <input name="q" defaultValue={filters.q} placeholder="e.g. CVE-2024-4577 or phar" className="h-10 rounded-md border border-border bg-background px-3 text-sm" />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Year published</span>
          <select name="year" defaultValue={filters.year ? String(filters.year) : ""} className="h-10 rounded-md border border-border bg-background px-2 text-sm">
            <option value="">All years</option>
            {allYears.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Severity</span>
          <select name="severity" defaultValue={filters.severity ?? ""} className="h-10 rounded-md border border-border bg-background px-2 text-sm">
            <option value="">All severities</option>
            {SEVERITIES.map((s) => <option key={s} value={s}>{label(s)}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Affected branch</span>
          <select name="branch" defaultValue={filters.branch ?? ""} className="h-10 rounded-md border border-border bg-background px-2 text-sm">
            <option value="">All branches</option>
            {branches.map((b) => <option key={b} value={b}>PHP {b}</option>)}
            <option value="unknown">Unknown branch</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Minimum CVSS score</span>
          <select name="minScore" defaultValue={filters.minScore !== null ? String(filters.minScore) : ""} className="h-10 rounded-md border border-border bg-background px-2 text-sm">
            <option value="">Any score</option>
            <option value="4">4.0 and above</option>
            <option value="7">7.0 and above</option>
            <option value="9">9.0 and above</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Sort</span>
          <select name="sort" defaultValue={filters.sort} className="h-10 rounded-md border border-border bg-background px-2 text-sm">
            <option value="published">Newest published</option>
            <option value="cvss">CVSS score</option>
            <option value="id">CVE ID</option>
          </select>
        </label>
        <div className="flex items-end gap-2">
          <button type="submit" className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">Filter</button>
          {filtered && <Link href="/cves" className="flex h-10 items-center px-2 text-sm underline">Reset</Link>}
        </div>
      </form>

      <p className="text-sm text-muted-foreground" role="status">
        Showing <strong className="text-foreground">{matched.length}</strong> of {all.length} PHP CVEs
        {filtered ? " matching your filters" : ""}.
      </p>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <YearChart years={years} filters={filters} />
        <SeverityChart counts={severities} total={matched.length} filters={filters} />
      </div>

      <section aria-labelledby="list">
        <h2 id="list" className="text-2xl font-semibold tracking-tight">CVEs</h2>
        {loaded.kevOk && (
          <p className="mt-2 text-sm text-muted-foreground">
            {matched.filter((r) => loaded.kev[r.id]).length} of these {matched.length} CVEs are in the{" "}
            <a className="underline" href={KEV_CATALOG_PAGE} target="_blank" rel="noreferrer">CISA Known Exploited Vulnerabilities catalog</a>
            {" "}(confirmed exploited in the wild). Patch those first.
          </p>
        )}
        {shown.length === 0 ? (
          <p className="mt-4 text-muted-foreground">No CVEs match these filters.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {shown.map((row) => <CveItem key={row.id} row={row} kev={loaded.kev[row.id]} />)}
          </ul>
        )}
        {pages > 1 && (
          <nav aria-label="Pages" className="mt-6 flex flex-wrap items-center gap-2 text-sm">
            {page > 1 ? (
              <Link className="rounded-md border border-border px-3 py-1.5 hover:bg-muted" href={filterHref({ ...filters, page: page - 1 })}>
                Previous
              </Link>
            ) : (
              <span className="rounded-md border border-border px-3 py-1.5 text-muted-foreground">Previous</span>
            )}
            {pageList(page, pages).map((item, index) =>
              item === "gap" ? (
                <span key={`gap-${index}`} className="px-1 text-muted-foreground">…</span>
              ) : (
                <Link
                  key={item}
                  href={filterHref({ ...filters, page: item })}
                  aria-current={item === page ? "page" : undefined}
                  className={`min-w-9 rounded-md border px-2 py-1.5 text-center ${item === page ? "border-primary bg-accent text-foreground" : "border-border hover:bg-muted"}`}
                >
                  {item}
                </Link>
              ),
            )}
            {page < pages ? (
              <Link className="rounded-md border border-border px-3 py-1.5 hover:bg-muted" href={filterHref({ ...filters, page: page + 1 })}>
                Next
              </Link>
            ) : (
              <span className="rounded-md border border-border px-3 py-1.5 text-muted-foreground">Next</span>
            )}
            <span className="text-muted-foreground">Page {page} of {pages}</span>
          </nav>
        )}
      </section>

      <p className="text-sm text-muted-foreground">
        Source: NIST NVD CVE API 2.0, CVEs matching <span className="font-mono">cpe:2.3:a:php:php</span>, rejected records
        excluded. Severity is the CVSS v3.x base severity, or v2 when that is all NVD has (the version is shown next to the
        score). Data refreshes every few hours{loaded.retrievedAt ? `; last synced ${loaded.retrievedAt}` : ""}. This page
        is not endorsed by NVD.
      </p>
    </div>
  );
}

function YearChart({ years, filters }: { years: { year: number; count: number }[]; filters: ExplorerFilters }) {
  const max = Math.max(1, ...years.map((y) => y.count));
  return (
    <Card>
      <CardContent className="p-4">
        <h2 className="font-semibold">CVEs per year</h2>
        {years.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No dated CVEs.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <ul className="flex h-44 min-w-[480px] items-end gap-0.5" aria-label="Number of CVEs published per year">
              {years.map((y) => (
                <li key={y.year} className="flex h-full flex-1 flex-col items-center justify-end">
                  <Link
                    href={filterHref({ ...filters, year: y.year })}
                    title={`${y.year}: ${y.count} CVEs`}
                    aria-label={`${y.year}: ${y.count} CVEs`}
                    className={`w-full rounded-t-sm ${filters.year === y.year ? "bg-primary" : "bg-primary/60 hover:bg-primary"}`}
                    style={{ height: `${(y.count / max) * 100}%`, minHeight: y.count ? 2 : 0 }}
                  />
                </li>
              ))}
            </ul>
            <div className="flex min-w-[480px] justify-between pt-1 text-xs text-muted-foreground" aria-hidden="true">
              <span>{years[0].year}</span>
              <span>busiest: {years.reduce((a, b) => (b.count > a.count ? b : a)).year} ({max})</span>
              <span>{years[years.length - 1].year}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SeverityChart({ counts, total, filters }: { counts: Record<Severity, number>; total: number; filters: ExplorerFilters }) {
  return (
    <Card>
      <CardContent className="p-4">
        <h2 className="font-semibold">Severity breakdown</h2>
        <ul className="mt-4 space-y-2">
          {SEVERITIES.map((s) => (
            <li key={s}>
              <Link href={filterHref({ ...filters, severity: s })} className="grid grid-cols-[5.5rem_1fr_3rem] items-center gap-2 text-sm hover:underline">
                <span>{label(s)}</span>
                <span className="h-3 rounded-sm bg-muted/60">
                  <span className={`block h-3 rounded-sm ${SEVERITY_BAR[s]}`} style={{ width: `${total ? (counts[s] / total) * 100 : 0}%` }} />
                </span>
                <span className="text-right font-mono">{counts[s]}</span>
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">CVSS v3.x, else v2. Unrated means NVD has no score yet.</p>
      </CardContent>
    </Card>
  );
}

function CveItem({ row, kev }: { row: ExplorerRow; kev?: KevEntry }) {
  return (
    <li className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <a
          className="font-mono font-semibold text-primary underline-offset-2 hover:underline"
          href={`https://nvd.nist.gov/vuln/detail/${row.id}`}
          target="_blank"
          rel="noreferrer"
        >
          {row.id}
        </a>
        <Badge variant={SEVERITY_BADGE[row.severity]}>
          {label(row.severity)}
          {row.score !== null ? ` ${row.score.toFixed(1)}` : ""}
        </Badge>
        {kev && <KevBadge entry={kev} />}
        {row.cvssVersion && <span className="text-xs text-muted-foreground">CVSS {row.cvssVersion}</span>}
        <span className="text-xs text-muted-foreground">{row.published ?? "date unknown"}</span>
        <Link className="text-xs underline" href={`/cve/${row.id}`}>Am I affected?</Link>
      </div>
      <p className="mt-2 line-clamp-3 text-sm">{row.description || "No description in NVD."}</p>
      <p className="mt-2 text-xs text-muted-foreground">
        Branches:{" "}
        {row.branches.length ? row.branches.slice(0, 8).map((b) => `PHP ${b}`).join(", ") + (row.branches.length > 8 ? ` +${row.branches.length - 8} more` : "") : "unknown"}
        {row.checkVersions.length > 0 && (
          <>
            {" · Check: "}
            {row.checkVersions.slice(0, 3).map((v, i) => (
              <span key={v}>
                {i > 0 && ", "}
                <Link className="font-mono underline" href={`/check/${v}`}>{v}</Link>
              </span>
            ))}
          </>
        )}
      </p>
    </li>
  );
}

function KevBadge({ entry }: { entry: KevEntry }) {
  return (
    <Badge variant="danger" title={entry.dateAdded ? `Added to CISA KEV on ${entry.dateAdded}` : "Listed in CISA KEV"}>
      Exploited in the wild (CISA KEV)
    </Badge>
  );
}
