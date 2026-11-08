import type { Metadata } from "next";
import { HeadersChecker } from "@/components/headers-checker";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Security headers checker",
  description:
    "Fetch the response headers of a public URL you submit and review HSTS, CSP, nosniff, framing, and referrer policy. Private and metadata addresses are blocked.",
  alternates: { canonical: new URL("/headers", SITE_URL).toString() },
};

export default function HeadersPage() {
  return (
    <main className="mx-auto w-full min-w-0 max-w-6xl px-4 py-10">
      <p className="text-sm font-medium uppercase tracking-[0.18em] text-primary">HTTP</p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight">Security headers checker</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        Submit a public URL. The server reads response headers only, with timeouts and blocks for local, private,
        link-local, and cloud-metadata targets. It does not crawl the site or run exploits.
      </p>
      <HeadersChecker />
    </main>
  );
}
