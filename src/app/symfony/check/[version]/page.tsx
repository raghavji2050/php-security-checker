import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cacheLife } from "next/cache";
import { Suspense } from "react";
import { CopyMarkdownButton } from "@/components/copy-markdown-button";
import { SymfonyForm } from "@/components/symfony-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { log } from "@/lib/log";
import { symfonyReportMarkdown } from "@/lib/markdown-report";
import { SITE_URL } from "@/lib/site";
import { checkSymfony, normalizeSymfonyVersion, type SymfonyCheck } from "@/lib/symfony-support";

export const instant = false;

type Params = { params: Promise<{ version: string }> };
type Loaded = { ok: true; result: SymfonyCheck } | { ok: false; message: string };

async function load(version: string): Promise<Loaded> {
  "use cache";
  cacheLife("hours");
  try {
    const result = await checkSymfony(version);
    if (result.supportError && result.advisoryError) {
      return { ok: false, message: "symfony.com release data and Packagist advisories are both unavailable right now." };
    }
    return { ok: true, result };
  } catch (error) {
    log.error("symfony_page.failed", { version, error });
    return { ok: false, message: "The check could not be completed right now." };
  }
}

function parseParam(value: string): string | null {
  try {
    return normalizeSymfonyVersion(decodeURIComponent(value));
  } catch {
    return null;
  }
}

const STATE_LABEL = { active: "Supported", security: "Security fixes only", eol: "End of life", unknown: "Unknown" } as const;
const STATE_VARIANT = { active: "ok", security: "warning", eol: "danger", unknown: "secondary" } as const;

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const version = parseParam((await params).version);
  if (!version) return { title: "Invalid Symfony version", robots: { index: false } };
  const loaded = await load(version);
  const canonical = new URL(`/symfony/check/${version}`, SITE_URL).toString();
  if (!loaded.ok) return { title: `Symfony ${version} security check`, alternates: { canonical }, robots: { index: false } };
  const r = loaded.result;
  const count = r.advisories ? `${r.advisories.findings.length} Packagist advisories match` : "advisories unavailable";
  return {
    title: `Symfony ${version} security and support status`,
    description: `Symfony ${version}: ${STATE_LABEL[r.support.state].toLowerCase()}, ${count}.${r.latestPatch ? ` Latest ${r.branch} patch: ${r.latestPatch}.` : ""}`.slice(0, 300),
    alternates: { canonical },
  };
}

export default function SymfonyCheckPage({ params }: Params) {
  return (
    <Suspense
      fallback={
        <main className="mx-auto w-full min-w-0 max-w-6xl px-4 py-10" aria-busy="true">
          <p className="sr-only" role="status">Loading the Symfony report…</p>
          <Skeleton className="h-8 w-72" />
          <Skeleton className="mt-8 h-64 w-full" />
        </main>
      }
    >
      <Report params={params} />
    </Suspense>
  );
}

async function Report({ params }: Params) {
  const version = parseParam((await params).version);
  if (!version) notFound();
  const loaded = await load(version);

  return (
    <main className="mx-auto w-full min-w-0 max-w-6xl px-4 py-10">
      <p className="text-sm font-medium uppercase tracking-[0.18em] text-primary">Symfony report</p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight">{`Symfony ${version} security check`}</h1>
      {loaded.ok ? <Result r={loaded.result} /> : (
        <p className="mt-3 max-w-2xl text-muted-foreground" role="alert">{loaded.message} Try again later.</p>
      )}
      <Card className="mt-8">
        <CardHeader><CardTitle>Check another Symfony version</CardTitle></CardHeader>
        <CardContent><SymfonyForm /></CardContent>
      </Card>
      <p className="mt-6 text-sm text-muted-foreground">
        Checking PHP itself? Use the <Link className="underline" href="/">PHP version checker</Link>.
      </p>
    </main>
  );
}

function Result({ r }: { r: SymfonyCheck }) {
  const findings = r.advisories?.findings ?? [];
  return (
    <div className="mt-6 space-y-6 text-sm">
      <p className="max-w-2xl text-base text-muted-foreground">{r.limitation}</p>
      <Card>
        <CardHeader><CardTitle>Support status</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <Badge variant={STATE_VARIANT[r.support.state]}>{STATE_LABEL[r.support.state]}</Badge>
          <p>{r.support.detail}</p>
          {r.branchInfo?.isLts && <p>Symfony {r.branch} is a long-term support (LTS) branch.</p>}
          {r.minPhp && <p>Minimum PHP for Symfony {r.branch}: {r.minPhp}.</p>}
          {r.latestPatch && (
            <p>
              Latest {r.branch} patch: <strong>{r.latestPatch}</strong>.{" "}
              {r.patchBehind ? `You are behind; update to ${r.latestPatch} or later.` : "You are on the latest patch for this branch."}
            </p>
          )}
          {(r.lts || r.stable) && (
            <p className="text-muted-foreground">Current releases on symfony.com: {r.stable ? `stable ${r.stable}` : ""}{r.stable && r.lts ? ", " : ""}{r.lts ? `LTS ${r.lts}` : ""}.</p>
          )}
          {r.supportError && <p role="alert">{r.supportError}</p>}
          <p className="text-xs text-muted-foreground">
            Sources: <a className="underline" href={r.sources.releases}>releases.json</a> · <a className="underline" href={r.sources.branch}>{r.branch}.json</a>
            {r.releasesStale ? " · stale cache" : ""}{r.releasesRetrievedAt ? ` · ${r.releasesRetrievedAt}` : ""}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Known advisories for symfony/symfony {r.version}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {r.advisoryError && <p role="alert">{r.advisoryError}</p>}
          {r.advisories && findings.length === 0 && <p>No Packagist advisory matched symfony/symfony {r.version}.</p>}
          {findings.length > 0 && (
            <ul className="space-y-2">
              {findings.map((f) => (
                <li key={f.advisoryId} className="rounded-md border border-border p-3">
                  <p className="font-medium">{f.title}</p>
                  <p className="text-muted-foreground">{f.severity ?? "unrated"} · affected {f.affectedVersions}</p>
                  <p className="mt-1 space-x-3">
                    {f.cve && f.cveUrl && <a className="text-primary underline" href={f.cveUrl}>{f.cve}</a>}
                    {f.link && <a className="text-primary underline" href={f.link}>Advisory</a>}
                  </p>
                </li>
              ))}
            </ul>
          )}
          {(findings.length > 0 || r.patchBehind) && (
            <div>
              <p className="font-medium">Upgrade command</p>
              <pre className="mt-1 overflow-x-auto rounded-md bg-muted p-2 font-mono text-xs">{r.upgradeCommand}</pre>
              <p className="mt-1 text-muted-foreground">Run tests after updating. If you are on an end-of-life branch, plan a move to a supported branch.</p>
            </div>
          )}
        </CardContent>
      </Card>
      <Share r={r} />
    </div>
  );
}

function Share({ r }: { r: SymfonyCheck }) {
  const badgeUrl = new URL(`/api/symfony/badge?v=${r.version}`, SITE_URL).toString();
  const pageUrl = new URL(`/symfony/check/${r.version}`, SITE_URL).toString();
  const badgeMd = `[![Symfony ${r.version} security status](${badgeUrl})](${pageUrl})`;
  return (
    <Card className="no-print" data-testid="symfony-share">
      <CardHeader><CardTitle>Share this report</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <CopyMarkdownButton markdown={symfonyReportMarkdown(r, SITE_URL)} />
          <CopyMarkdownButton markdown={badgeMd} label="Copy badge Markdown" />
        </div>
        <p className="text-muted-foreground">README badge (updates hourly from symfony.com and Packagist data):</p>
        {/* eslint-disable-next-line @next/next/no-img-element -- live SVG badge from our own API */}
        <img src={`/api/symfony/badge?v=${r.version}`} alt={`Symfony ${r.version} security status badge`} height={20} />
        <pre className="overflow-x-auto rounded-md bg-muted p-2 font-mono text-xs">{badgeMd}</pre>
      </CardContent>
    </Card>
  );
}
