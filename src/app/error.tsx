"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

// Shown when a page throws while rendering. Internal details stay in the server logs;
// only the opaque digest is shown so a report can be matched to a log line.
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto w-full min-w-0 max-w-6xl px-4 py-16">
      <p className="text-sm font-medium uppercase tracking-[0.18em] text-primary">Error</p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground" role="alert">
        This page could not be loaded right now. It is usually a temporary problem with an upstream data source. Please
        try again.
      </p>
      {error.digest ? (
        <p className="mt-2 font-mono text-xs text-muted-foreground">Reference: {error.digest}</p>
      ) : null}
      <div className="mt-6 flex flex-wrap gap-3">
        <Button onClick={() => reset()}>Try again</Button>
        <Button asChild variant="outline">
          <Link href="/">Go to homepage</Link>
        </Button>
      </div>
    </main>
  );
}
