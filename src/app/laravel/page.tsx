import type { Metadata } from "next";
import { LaravelChecker } from "@/components/laravel-checker";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Laravel version checker",
  description:
    "Check a Laravel framework version against the official support table and Packagist advisories for laravel/framework. Configuration answers stay in the browser.",
  alternates: { canonical: new URL("/laravel", SITE_URL).toString() },
};

export default function LaravelPage() {
  return (
    <main className="mx-auto w-full min-w-0 max-w-6xl px-4 py-10">
      <p className="text-sm font-medium uppercase tracking-[0.18em] text-primary">Framework</p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight">Laravel checker</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        Enter the laravel/framework version you are running. Support windows are read from Laravel&apos;s release notes.
        Advisories are Packagist records. The env checklist never leaves this browser.
      </p>
      <LaravelChecker />
    </main>
  );
}
