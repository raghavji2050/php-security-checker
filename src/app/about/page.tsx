import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DISCLAIMER } from "@/lib/types";

export const metadata: Metadata = {
  title: "About",
  description:
    "What PHP Security Checker does and refuses to do, its data sources, privacy, and the full disclaimer for version-based checks.",
};

export default function AboutPage() {
  return (
    <main className="mx-auto w-full min-w-0 max-w-6xl px-4 py-10">
      <p className="text-sm font-medium uppercase tracking-[0.18em] text-primary">About</p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight">About PHP Security Checker</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        A public lookup for one question: does the official record say this installed PHP release is inside a known
        runtime vulnerability range, and which supported release is the sensible upgrade?
      </p>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>What you can enter</CardTitle>
          </CardHeader>
          <CardContent className="text-sm leading-6 text-muted-foreground">
            A PHP version such as 8.1.12, plus optional files you paste yourself: composer.lock (parsed in the browser),
            php.ini, php -m output, a Laravel or WordPress version, a Dockerfile, or one public URL for response
            headers. There is no account. The headers tool is the only feature that connects out, and only to the URL
            you submit.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>What it will not do</CardTitle>
          </CardHeader>
          <CardContent className="text-sm leading-6 text-muted-foreground">
            It does not run PHP, shell commands, or exploit payloads. The headers check reads response headers for one
            URL and refuses private targets. Version ranges and advisories are read from the published sources, not
            invented in the application.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Privacy</CardTitle>
          </CardHeader>
          <CardContent className="text-sm leading-6 text-muted-foreground">
            Recent versions you check are stored in this browser only. The server caches upstream API responses so it
            can respect NVD rate limits. API keys stay in environment variables.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Limits</CardTitle>
          </CardHeader>
          <CardContent className="text-sm leading-6 text-muted-foreground">
            NVD ranges are sometimes wider than php.net&apos;s own affected list. When those sources disagree, the
            result stays unverified. A clean result only means the checked data had no confirmed match.
          </CardContent>
        </Card>
      </div>
      <Card id="disclaimer" className="mt-4 scroll-mt-24">
        <CardHeader>
          <CardTitle>Disclaimer</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
          <p>{DISCLAIMER}</p>
          <p>
            Data comes from NIST NVD, php.net release and support pages, the PHP ChangeLog, and GitHub Security
            Advisories for php/php-src. Nothing here scans your server or runs the version you type.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
