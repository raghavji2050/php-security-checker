import type { Metadata } from "next";
import { WordPressChecker } from "@/components/wordpress-checker";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "WordPress core version check",
  description:
    "Look up a WordPress core version in the official api.wordpress.org stable-check feed. No plugin or theme coverage, and no invented CVEs.",
  alternates: { canonical: new URL("/wordpress", SITE_URL).toString() },
};

export default function WordPressPage() {
  return (
    <main className="mx-auto w-full min-w-0 max-w-6xl px-4 py-10">
      <p className="text-sm font-medium uppercase tracking-[0.18em] text-primary">Core</p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight">WordPress core check</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        Compare a core version with the status WordPress.org publishes (latest, outdated, or insecure). This does not
        inspect a live site, plugins, or themes.
      </p>
      <WordPressChecker />
    </main>
  );
}
