import type { Metadata } from "next";
import { PhpVParser } from "@/components/php-v-parser";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Is my PHP patched? php -v output parser",
  description:
    "Paste php -v output to get the exact PHP version, distro package suffix, SAPI and thread safety, then check it for known CVEs. Runs in your browser.",
  alternates: { canonical: new URL("/php-v", SITE_URL).toString() },
};

export default function PhpVPage() {
  return (
    <main className="mx-auto w-full min-w-0 max-w-6xl px-4 py-10">
      <p className="text-sm font-medium uppercase tracking-[0.18em] text-primary">Version</p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight">Paste php -v output</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        Run <code className="text-sm">php -v</code> on your server and paste everything it prints. We pull out the exact
        version, the distribution package suffix (Ubuntu, Debian, RHEL and others), the SAPI and thread safety, then link
        you to the full CVE check for that version.
      </p>
      <PhpVParser />
    </main>
  );
}
