import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cacheLife } from "next/cache";
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toExplorerRow, type ExplorerRow } from "@/lib/cve-explorer";
import { cveFaq, fixRows, isAffected, normalizeCveId, pickRanges, type FixRow, type RangeSource } from "@/lib/cve-page";
import { DataUnavailableError, loadDataset } from "@/lib/dataset";
import { EPSS_PAGE, formatPercentile, formatProbability, lookupEpss, type EpssLookup } from "@/lib/epss";
import { featuredAdvisory, type FeaturedAdvisory } from "@/lib/featured-advisories";
import { KEV_CATALOG_PAGE, lookupKev, type KevEntry } from "@/lib/kev";
import { relatedCves, type RelatedCve } from "@/lib/related-cves";
import { jsonLdString } from "@/lib/faq";
import { log } from "@/lib/log";
import { SITE_URL } from "@/lib/site";

export const maxDuration = 300;

// Like /check/[version]: a dynamic route rendered on demand and cached for hours.
export const instant = false;

type Params = Promise<{ id: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type Loaded =
  | { ok: true; found: false }
  | { ok: true; found: true; row: ExplorerRow; source: RangeSource; rows: FixRow[]; nvdRetrievedAt: string | null; kev: KevEntry | null; kevOk: boolean; epss: EpssLookup; related: RelatedCve[] }
  | { ok: false; message: string };

async function load(id: string): Promise<Loaded> {
  "use cache";
  cacheLife("hours");
  try {
    const data = await loadDataset();
    const cve = data.cves.find((c) => c.id === id);
    if (!cve) return { ok: true, found: false };
    const source = pickRanges(cve);
    const [kev, epss] = await Promise.all([lookupKev([id]), lookupEpss(id)]);
    const known = data.branches.map((b) => b.branch);
    const row = toExplorerRow(cve, known);
    return {
      ok: true,
      found: true,
      row,
      epss,
      related: relatedCves(row, data.cves.map((c) => toExplorerRow(c, known))),
      source,
      rows: fixRows(source.ranges),
      nvdRetrievedAt: data.retrievedAt,
      kev: kev.entries[id] ?? null,
      kevOk: kev.ok,
    };
  } catch (error) {
    if (error instanceof DataUnavailableError) return { ok: false, message: error.message };
    log.error("cve_page.failed", { id, error });
    return { ok: false, message: "CVE data could not be loaded right now." };
  }
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const id = normalizeCveId((await params).id);
  // notFound() here (not only in the streamed body) so unknown IDs get a real 404 status.
  if (!id) notFound();
  const canonical = new URL(`/cve/${id}`, SITE_URL).toString();
  const loaded = await load(id);
  if (loaded.ok && !loaded.found) notFound();
  const fixed = loaded.ok && loaded.found ? loaded.rows.filter((r) => r.fixed).map((r) => r.fixed) : [];
  return {
    title: `${id}: am I affected?`,
    description: fixed.length
      ? `Check if your PHP version is affected by ${id}. Fixed in PHP ${fixed.slice(0, 4).join(", ")}, per official data.`
      : `Check if your PHP version is affected by ${id}, with affected ranges from official NVD and php.net data.`,
    alternates: { canonical },
  };
}

export default function CvePage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  return (
    <main className="mx-auto w-full min-w-0 max-w-4xl px-4 py-10">
      <Suspense
        fallback={
          <div className="space-y-3" aria-busy="true">
            <p className="sr-only" role="status">Loading CVE data…</p>
            <Skeleton className="h-12 w-2/3" />
            <Skeleton className="h-64 w-full" />
          </div>
        }
      >
        <Content params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

function label(severity: string): string {
  return severity === "UNRATED" ? "Unrated" : severity.charAt(0) + severity.slice(1).toLowerCase();
}

async function Content({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const id = normalizeCveId((await params).id);
  if (!id) notFound();
  const loaded = await load(id);
  if (loaded.ok && !loaded.found) notFound();
  if (!loaded.ok) {
    return (
      <>
        <h1 className="text-4xl font-semibold tracking-tight">{id}</h1>
        <p className="mt-6 text-muted-foreground" role="alert">
          {loaded.message} Try again in a few minutes, or open{" "}
          <a className="underline" href={`https://nvd.nist.gov/vuln/detail/${id}`} target="_blank" rel="noreferrer">{id} on NVD</a>.
        </p>
      </>
    );
  }
  const query = await searchParams;
  const vRaw = (Array.isArray(query.v) ? query.v[0] : query.v) ?? "";
  const answer = vRaw ? isAffected(loaded.source.ranges, vRaw) : null;
  const { row, source, rows } = loaded;
  const faq = cveFaq(id, source, rows);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((f) => ({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: f.answer } })),
  };
  const danger = row.severity === "CRITICAL" || row.severity === "HIGH";
  const advisory = featuredAdvisory(id);

  return (
    <article>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(jsonLd) }} />
      <p className="text-sm font-medium uppercase tracking-[0.18em] text-primary">Am I affected?</p>
      <h1 className="mt-2 font-mono text-4xl font-semibold tracking-tight">{id}</h1>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        <Badge variant={danger ? "danger" : row.severity === "MEDIUM" ? "warning" : "outline"}>
          {label(row.severity)}
          {row.score !== null ? ` ${row.score.toFixed(1)}` : ""}
        </Badge>
        {loaded.kev && <Badge variant="danger">Exploited in the wild (CISA KEV)</Badge>}
        {row.cvssVersion && <span className="text-muted-foreground">CVSS {row.cvssVersion}</span>}
        <span className="text-muted-foreground">Published {row.published ?? "date unknown"}</span>
      </div>
      <p className="mt-4 text-muted-foreground">{row.description || "No description in NVD."}</p>
      {loaded.kev ? (
        <div className="mt-4 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm" data-testid="kev-callout">
          <strong>Actively exploited.</strong> CISA lists {id} in its{" "}
          <a className="underline" href={KEV_CATALOG_PAGE} target="_blank" rel="noreferrer">Known Exploited Vulnerabilities catalog</a>
          {loaded.kev.dateAdded ? <> (added {loaded.kev.dateAdded})</> : null}
          {loaded.kev.ransomware === "Known" ? <>, with known use in ransomware campaigns</> : null}. Treat this as a patch-now issue.
        </div>
      ) : loaded.kevOk ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Not in the <a className="underline" href={KEV_CATALOG_PAGE} target="_blank" rel="noreferrer">CISA KEV catalog</a> as of the last sync. That means no confirmed exploitation is listed there, not that it is safe.
        </p>
      ) : null}
      <Epss epss={loaded.epss} />
      {advisory && <PhpNetAdvisory a={advisory} />}

      <Card className="mt-8">
        <CardContent className="p-4">
          <h2 className="font-semibold">Check your PHP version</h2>
          <form method="get" action={`/cve/${id}`} className="mt-3 flex flex-wrap gap-2">
            <label className="sr-only" htmlFor="v">PHP version (MAJOR.MINOR.PATCH)</label>
            <input id="v" name="v" defaultValue={vRaw.slice(0, 32)} placeholder="e.g. 8.2.12" maxLength={32}
              className="h-10 w-48 rounded-md border border-border bg-background px-3 font-mono text-sm" />
            <button type="submit" className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">Check</button>
          </form>
          {answer && <Answer id={id} answer={answer} source={source.name} />}
        </CardContent>
      </Card>

      <section aria-labelledby="fixed" className="mt-8">
        <h2 id="fixed" className="text-2xl font-semibold tracking-tight">Fixed versions by branch</h2>
        {rows.length === 0 ? (
          <p className="mt-3 text-muted-foreground">{source.name} gives no usable version range for this CVE. Check the official references below.</p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left">
                <tr><th className="p-3">Branch</th><th className="p-3">Affected ({source.name})</th><th className="p-3">Fixed in</th></tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="p-3 font-mono">{r.branch ? `PHP ${r.branch}` : "—"}</td>
                    <td className="p-3">{r.affected}</td>
                    <td className="p-3 font-mono">
                      {r.fixed ? <Link className="underline" href={`/check/${r.fixed}`}>{r.fixed}</Link> : <span className="font-sans text-muted-foreground">not stated</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          &quot;Fixed in&quot; is shown only when the source gives an exact upper bound. Any later patch in the same branch also has the fix.
          Linux distributions (Ubuntu, Debian, RHEL) often backport fixes without changing the PHP version number.
        </p>
      </section>

      {loaded.related.length > 0 && (
        <section aria-labelledby="related" className="mt-8">
          <h2 id="related" className="text-2xl font-semibold tracking-tight">Related CVEs</h2>
          <p className="mt-1 text-sm text-muted-foreground">Other PHP CVEs that NVD lists for the same branches.</p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2" data-testid="related-cves">
            {loaded.related.map((r) => (
              <li key={r.id} className="rounded-md border border-border px-3 py-2 text-sm">
                <Link className="font-mono font-medium underline" href={`/cve/${r.id}`}>{r.id}</Link>{" "}
                <span className="text-muted-foreground">
                  {label(r.severity)}{r.score !== null ? ` ${r.score.toFixed(1)}` : ""} · PHP {r.sharedBranches.join(", ")}
                  {r.published ? ` · ${r.published}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="faq" className="mt-8">
        <h2 id="faq" className="text-2xl font-semibold tracking-tight">Questions</h2>
        <dl className="mt-3 space-y-4">
          {faq.map((f) => (
            <div key={f.question}>
              <dt className="font-medium">{f.question}</dt>
              <dd className="mt-1 text-sm text-muted-foreground">{f.answer}</dd>
            </div>
          ))}
        </dl>
      </section>

      <p className="mt-8 text-sm text-muted-foreground">
        Sources: <a className="underline" href={`https://nvd.nist.gov/vuln/detail/${id}`} target="_blank" rel="noreferrer">{id} on NIST NVD</a>
        {source.name === "php.net" && <> and the <a className="underline" href="https://www.php.net/ChangeLog-8.php" target="_blank" rel="noreferrer">php.net ChangeLog</a></>}.
        {loaded.nvdRetrievedAt ? ` NVD data synced ${loaded.nvdRetrievedAt}.` : ""} See all PHP CVEs in the{" "}
        <Link className="underline" href={`/cves?q=${id}`}>CVE explorer</Link>.
      </p>
    </article>
  );
}

function PhpNetAdvisory({ a }: { a: FeaturedAdvisory }) {
  return (
    <Card className="mt-6" data-testid="php-net-advisory">
      <CardContent className="space-y-2 p-4 text-sm">
        <h2 className="text-lg font-semibold">php.net security advisory: {a.title}</h2>
        {a.nickname && <p className="text-muted-foreground">Often called &ldquo;{a.nickname}&rdquo; in news coverage (not an official php.net name).</p>}
        <p>
          Published by php.net on {a.published}. Fixed in PHP{" "}
          {a.fixedIn.map((v, i) => (
            <span key={v}>{i > 0 ? ", " : ""}<Link className="font-mono underline" href={`/check/${v}`}>{v}</Link></span>
          ))}
          . PHP 8.1 and older get no official release; php.net points to distribution/LTS vendor backports.
        </p>
        <p className="font-medium">If you cannot update right away (php.net says these reduce exposure but do not make you safe):</p>
        <ul className="list-disc space-y-1 pl-5">
          {a.mitigations.map((m) => <li key={m}>{m}</li>)}
        </ul>
        <p className="text-xs text-muted-foreground">
          Sources: <a className="underline" href={a.advisoryUrl} target="_blank" rel="noreferrer">php.net advisory</a> ·{" "}
          <a className="underline" href={a.ghsaUrl} target="_blank" rel="noreferrer">{a.ghsaId}</a>
          {a.relatedCves.length > 0 && <> · Fixed together with {a.relatedCves.map((c) => <Link key={c} className="font-mono underline" href={`/cve/${c}`}>{c}</Link>)}</>}
        </p>
      </CardContent>
    </Card>
  );
}

function Epss({ epss }: { epss: EpssLookup }) {
  const link = <a className="underline" href={EPSS_PAGE} target="_blank" rel="noreferrer">FIRST EPSS</a>;
  if (!epss.ok) {
    return <p className="mt-3 text-xs text-muted-foreground" data-testid="epss">Exploit probability ({link}): Unavailable right now.</p>;
  }
  if (!epss.score) {
    return <p className="mt-3 text-xs text-muted-foreground" data-testid="epss">Exploit probability ({link}): no score published for this CVE.</p>;
  }
  const s = epss.score;
  return (
    <p className="mt-3 text-sm" data-testid="epss">
      <strong>Exploit probability ({link}):</strong> {formatProbability(s.epss)} chance of exploitation activity in the next 30 days
      ({formatPercentile(s.percentile)} of all scored CVEs){s.date ? `, scored ${s.date}` : ""}. EPSS is a likelihood estimate, not proof of attacks.
    </p>
  );
}

function Answer({ id, answer, source }: { id: string; answer: ReturnType<typeof isAffected>; source: string }) {
  if (answer.kind === "invalid") {
    return <p className="mt-3 text-sm text-warning" role="status">Enter a full version like 8.2.12 (MAJOR.MINOR.PATCH).</p>;
  }
  if (answer.kind === "unknown") {
    return <p className="mt-3 text-sm" role="status">{source} gives no version range for {id}, so PHP {answer.version} can&apos;t be checked automatically.</p>;
  }
  if (answer.kind === "not_affected") {
    return (
      <p className="mt-3 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm" role="status">
        PHP {answer.version} is <strong>not in any affected range</strong> that {source} lists for {id}. Other CVEs may still apply:{" "}
        <Link className="underline" href={`/check/${answer.version}`}>full check for {answer.version}</Link>.
      </p>
    );
  }
  return (
    <p className="mt-3 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm" role="status">
      PHP {answer.version} <strong>is in an affected range</strong> for {id}
      {answer.fixed ? <>. Upgrade to <Link className="font-mono underline" href={`/check/${answer.fixed}`}>{answer.fixed}</Link> or later.</> : ". The source gives no exact fixed release for this branch; move to a supported branch."}{" "}
      <Link className="underline" href={`/check/${answer.version}`}>Full report for {answer.version}</Link>.
    </p>
  );
}
