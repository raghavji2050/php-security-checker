import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "About",
  description: "What PHP Security Checker does, and what it refuses to do.",
};

export default function AboutPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10">
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
            Only a version string such as 8.1.12. There is no account, and the app never asks for server credentials,
            paths, or a URL to scan.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>What it will not do</CardTitle>
          </CardHeader>
          <CardContent className="text-sm leading-6 text-muted-foreground">
            It does not run PHP, shell commands, or exploit payloads. It does not probe websites. Version ranges are
            read from NVD, php.net, and GitHub, not invented in the application.
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
    </main>
  );
}
