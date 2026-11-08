import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Checker } from "@/components/checker";
import { HomeSnapshot } from "@/components/home-snapshot";
import { Skeleton } from "@/components/ui/skeleton";
import { toolLinks } from "@/lib/nav";

export const metadata: Metadata = {
  title: { absolute: "PHP Security Checker · Secure your PHP applications" },
  description:
    "Check a PHP version against official vulnerability records, then review php.ini, extensions, Laravel, WordPress core, security headers, and Docker tags. Real data only.",
};

export default function HomePage() {
  return (
    <main>
      <section className="mx-auto min-w-0 max-w-6xl px-4 pb-2 pt-10 md:pt-16">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-primary">PHP Developer Security Toolkit</p>
        <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight text-balance md:text-6xl">
          Secure Your PHP Applications
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-8 text-muted-foreground">
          Start with the installed PHP version. Then review configuration, framework versions, response headers, and
          container tags. Results come from official records. This is not a full application audit.
        </p>
        <ul className="mt-6 flex gap-2 overflow-x-auto pb-1">
          <li>
            <a className="inline-flex whitespace-nowrap rounded-full border border-border bg-card px-3 py-1.5 text-sm hover:bg-muted" href="#checker">
              Check a version
            </a>
          </li>
          {toolLinks().map((link) => (
            <li key={link.href}>
              <Link className="inline-flex whitespace-nowrap rounded-full border border-border bg-card px-3 py-1.5 text-sm hover:bg-muted" href={link.href}>
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <Suspense fallback={<div className="mx-auto max-w-6xl px-4 py-8"><Skeleton className="h-64 w-full" /></div>}>
        <Checker />
      </Suspense>
      <HomeSnapshot />
    </main>
  );
}
