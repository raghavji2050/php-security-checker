import type { Metadata } from "next";
import Link from "next/link";
import { CveCatalog } from "@/components/cve-catalog";

export const metadata: Metadata = {
  title: "PHP Runtime Vulnerabilities",
  description:
    "Browse the latest PHP runtime CVEs from NIST NVD and php/php-src advisories, with severity, affected range, fixed version, and verification status.",
};

export default function VulnerabilitiesPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10">
      <p className="text-sm font-medium uppercase tracking-[0.18em] text-primary">Records</p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight">PHP runtime vulnerabilities</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        Latest CVEs for the PHP interpreter itself, read live from NIST NVD and GitHub advisories for php/php-src. A
        fixed version is listed only when it is published on php.net. See{" "}
        <Link className="text-primary underline-offset-2 hover:underline" href="/how-it-works">how it works</Link> for
        what each status means.
      </p>
      <div className="mt-8">
        <CveCatalog />
      </div>
    </main>
  );
}
