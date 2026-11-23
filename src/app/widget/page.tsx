import type { Metadata } from "next";
import { Card, CardContent } from "@/components/ui/card";
import { embedSnippets } from "@/lib/status-widget";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "PHP support status widget",
  description:
    "Embed a live PHP support-status card on your site or README: active, security-only and end-of-life PHP branches from official php.net data.",
  alternates: { canonical: new URL("/widget", SITE_URL).toString() },
};

export default function WidgetPage() {
  const snippets = embedSnippets(SITE_URL);
  const src = "/api/widget/php-status";
  return (
    <main className="mx-auto w-full min-w-0 max-w-4xl px-4 py-10">
      <p className="text-sm font-medium uppercase tracking-[0.18em] text-primary">Docs</p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight">PHP support status widget</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        A small image card that shows which PHP branches are in active support, security-fixes only, or end of life. It
        reads the same official php.net data as the rest of this site and refreshes about once an hour. No script, no
        cookies, no sign-up.
      </p>

      <h2 className="mt-8 text-xl font-semibold">Live preview</h2>
      <Card className="mt-3">
        <CardContent className="p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="PHP support status" width={300} className="max-w-full" />
        </CardContent>
      </Card>

      <h2 className="mt-8 text-xl font-semibold">HTML</h2>
      <pre className="mt-3 overflow-x-auto rounded-lg border bg-muted/40 p-4 text-sm">
        <code>{snippets.html}</code>
      </pre>

      <h2 className="mt-8 text-xl font-semibold">Markdown (README)</h2>
      <pre className="mt-3 overflow-x-auto rounded-lg border bg-muted/40 p-4 text-sm">
        <code>{snippets.markdown}</code>
      </pre>

      <p className="mt-8 text-sm text-muted-foreground">
        Prefer JSON? Use <a className="underline" href="/api/php-versions">/api/php-versions</a>. Support dates are from
        php.net; if the source is unreachable the card says so instead of guessing.
      </p>
    </main>
  );
}
