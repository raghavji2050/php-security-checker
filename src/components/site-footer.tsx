import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>
          Version-based check only. This is not a security audit. Details on the{" "}
          <Link className="text-primary underline-offset-2 hover:underline" href="/about">
            About page
          </Link>
          .
        </p>
        <nav aria-label="Footer" className="flex flex-wrap gap-4">
          <Link className="hover:text-foreground" href="/how-it-works">How it works</Link>
          <Link className="hover:text-foreground" href="/cves">CVE explorer</Link>
          <Link className="hover:text-foreground" href="/php-ini">php.ini</Link>
          <Link className="hover:text-foreground" href="/headers">Headers</Link>
          <Link className="hover:text-foreground" href="/openapi.json">API</Link>
        </nav>
      </div>
    </footer>
  );
}
