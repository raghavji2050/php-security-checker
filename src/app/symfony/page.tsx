import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SymfonyForm } from "@/components/symfony-form";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Symfony version checker",
  description:
    "Check a Symfony version against symfony.com support and end-of-life data and Packagist security advisories for symfony/symfony.",
  alternates: { canonical: new URL("/symfony", SITE_URL).toString() },
};

export default function SymfonyPage() {
  return (
    <main className="mx-auto w-full min-w-0 max-w-6xl px-4 py-10">
      <p className="text-sm font-medium uppercase tracking-[0.18em] text-primary">Framework</p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight">Symfony version checker</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        Enter the Symfony version you run. Support and end-of-life months come from symfony.com release data.
        Advisories are Packagist records for symfony/symfony.
      </p>
      <Card className="mt-8">
        <CardHeader><CardTitle>Framework version</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <SymfonyForm />
          <p className="text-sm text-muted-foreground">
            Installing individual symfony/* components? Scan your lock file with the <Link className="underline" href="/composer">composer.lock scanner</Link> instead.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
