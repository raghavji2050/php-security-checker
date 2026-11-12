import type { Metadata } from "next";
import Link from "next/link";
import { ComposerLockScanner } from "@/components/composer-lock-scanner";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "composer.lock scanner",
  description:
    "Paste or upload a composer.lock to check locked package versions against official Packagist security advisories. The lock file stays in your browser; only name@version is checked.",
  alternates: { canonical: new URL("/composer", SITE_URL).toString() },
};

export default function ComposerPage() {
  return (
    <main className="mx-auto w-full min-w-0 max-w-6xl px-4 py-10">
      <p className="text-sm font-medium uppercase tracking-[0.18em] text-primary">Composer</p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight">composer.lock scanner</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        Check the packages locked in your project against the official Packagist security advisories API. Parse happens
        in your browser; we never store the file and never execute anything. Results show affected packages, CVE and
        advisory links, severity when Packagist provides it, suggested fixed versions, and copy-paste{" "}
        <code className="text-xs">composer update</code> commands.
      </p>
      <p className="mt-3 text-sm">
        Maintaining a package? Check your <code className="text-xs">require.php</code> line with the{" "}
        <Link className="underline" href="/composer/php-constraint">constraint checker</Link>.
      </p>
      <ComposerLockScanner />
    </main>
  );
}
