import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false },
};

export default function NotFound() {
  return (
    <main className="mx-auto w-full min-w-0 max-w-6xl px-4 py-16">
      <p className="text-sm font-medium uppercase tracking-[0.18em] text-primary">404</p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight">Page not found</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        This page doesn&apos;t exist. If you were checking a version, use the full MAJOR.MINOR.PATCH format, for example{" "}
        <Link className="underline" href="/check/8.3.14">/check/8.3.14</Link>.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/">Check a PHP version</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/vulnerabilities">Browse vulnerabilities</Link>
        </Button>
      </div>
    </main>
  );
}
