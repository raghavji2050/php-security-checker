import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cacheLife } from "next/cache";
import { Suspense } from "react";
import { ResultsDashboard } from "@/components/results-dashboard";
import { Skeleton } from "@/components/ui/skeleton";
import { checkVersion } from "@/lib/check";
import { DataUnavailableError } from "@/lib/dataset";
import { SITE_URL } from "@/lib/site";
import type { CheckResult } from "@/lib/types";
import { parsePhpVersion } from "@/lib/version";

// Result pages are rendered on the server and cached for a few hours, so the full report
// is in the HTML for search engines and no-JavaScript readers. The route blocks on the report
// instead of streaming a skeleton first.
export const instant = false;

type Params = { params: Promise<{ version: string }> };

type Loaded = { ok: true; result: CheckResult } | { ok: false; message: string };

async function load(raw: string): Promise<Loaded> {
  "use cache";
  cacheLife("hours");
  try {
    return { ok: true, result: await checkVersion(raw) };
  } catch (error) {
    if (error instanceof DataUnavailableError) return { ok: false, message: error.message };
    console.error("version page check failed");
    return { ok: false, message: "The check could not be completed right now." };
  }
}

function parseParam(value: string) {
  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    // Malformed percent-encoding (e.g. /check/%E0) is a bad version, not a server error.
    return null;
  }
  if (decoded.length > 32) return null;
  return parsePhpVersion(decoded);
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const version = parseParam((await params).version);
  if (!version) return { title: "Invalid PHP version", robots: { index: false } };
  const loaded = await load(version.raw);
  const canonical = new URL(`/check/${version.raw}`, SITE_URL).toString();
  if (!loaded.ok) {
    return {
      title: `PHP ${version.raw} security check`,
      description: `Known vulnerabilities and support status for PHP ${version.raw}.`,
      alternates: { canonical },
      robots: { index: false },
    };
  }
  const r = loaded.result;
  const fix = r.minimumFixedVersion ? ` Minimum fix: ${r.minimumFixedVersion}.` : "";
  const upgrade = r.recommendedVersion ? ` Recommended upgrade: ${r.recommendedVersion}.` : "";
  return {
    title: `PHP ${r.version} vulnerabilities and security status`,
    description: `PHP ${r.version}: ${r.securityStatusLabel}, ${r.counts.confirmed} confirmed known vulnerabilities (${r.counts.critical} critical, ${r.counts.high} high), support ${r.support.label}.${fix}${upgrade}`.slice(0, 300),
    alternates: { canonical },
  };
}

export default function CheckVersionPage({ params }: Params) {
  return (
    <Suspense fallback={<main className="mx-auto w-full min-w-0 max-w-6xl px-4 py-10"><Skeleton className="h-64 w-full" /></main>}>
      <Report params={params} />
    </Suspense>
  );
}

async function Report({ params }: Params) {
  const version = parseParam((await params).version);
  if (!version) notFound();
  const loaded = await load(version.raw);

  return (
    <main className="mx-auto w-full min-w-0 max-w-6xl px-4 py-10">
      <p className="text-sm font-medium uppercase tracking-[0.18em] text-primary">Version report</p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight">PHP {version.raw} security check</h1>
      {loaded.ok ? (
        <>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            PHP {loaded.result.version} is <strong>{loaded.result.securityStatusLabel.toLowerCase()}</strong>:{" "}
            {loaded.result.counts.confirmed} confirmed known vulnerabilities ({loaded.result.counts.critical} critical,{" "}
            {loaded.result.counts.high} high, {loaded.result.counts.rce} RCE-related). Support status:{" "}
            {loaded.result.support.label}.
            {loaded.result.recommendedVersion ? ` Recommended upgrade: PHP ${loaded.result.recommendedVersion}.` : ""}
          </p>
          <div className="mt-8">
            <ResultsDashboard result={loaded.result} />
          </div>
        </>
      ) : (
        <p className="mt-3 max-w-2xl text-muted-foreground" role="alert">
          {loaded.message} Try again later or use the <Link className="underline" href={`/?v=${version.raw}`}>live checker</Link>.
        </p>
      )}
      <p className="mt-8 text-sm text-muted-foreground">
        Check another version on the <Link className="underline" href="/">homepage</Link>.
      </p>
    </main>
  );
}
