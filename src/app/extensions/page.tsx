import type { Metadata } from "next";
import { ExtensionChecker } from "@/components/extension-checker";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "PHP extension checker",
  description:
    "Paste php -m output. Bundled extensions are named from the PHP manual. Confirmed issues come only from PHP runtime CVEs that mention the extension.",
  alternates: { canonical: new URL("/extensions", SITE_URL).toString() },
};

export default function ExtensionsPage() {
  return (
    <main className="mx-auto w-full min-w-0 max-w-6xl px-4 py-10">
      <p className="text-sm font-medium uppercase tracking-[0.18em] text-primary">Extensions</p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight">PHP extension checker</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        See which modules from <span className="font-mono text-sm">php -m</span> ship with php-src, and which PHP runtime
        CVEs mention them. This does not invent extension CVEs and does not decide whether a build is outdated.
      </p>
      <ExtensionChecker />
    </main>
  );
}
