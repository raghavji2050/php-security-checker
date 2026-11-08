"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { HeaderFinding } from "@/lib/header-audit";

type HeadersResponse = {
  finalUrl: string;
  httpStatus: number;
  redirects: string[];
  headers: Record<string, string>;
  findings: HeaderFinding[];
  limitation: string;
  error?: string;
};

const LEVEL = { review: "warning", ok: "ok", info: "secondary" } as const;

export function HeadersChecker() {
  const [url, setUrl] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "error" | "done">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [result, setResult] = useState<HeadersResponse | null>(null);

  async function submit() {
    setState("loading");
    setMessage(null);
    setResult(null);
    try {
      const response = await fetch("/api/headers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const body = (await response.json()) as HeadersResponse;
      if (!response.ok) {
        setState("error");
        setMessage(body.error ?? "The URL could not be checked.");
        return;
      }
      setResult(body);
      setState("done");
    } catch {
      setState("error");
      setMessage("Could not reach the checker.");
    }
  }

  return (
    <div className="mt-8 space-y-4">
      <Card>
        <CardContent className="space-y-3 p-4 md:p-6">
          <form className="flex flex-col gap-3 sm:flex-row" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
            <label className="flex-1 text-sm">
              <span className="mb-1 block font-medium">Public URL</span>
              <Input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://example.com" inputMode="url" />
            </label>
            <Button type="submit" className="sm:self-end" disabled={state === "loading"}>{state === "loading" ? "Fetching…" : "Check headers"}</Button>
          </form>
          <p className="text-sm text-muted-foreground">
            Nothing is fetched until you submit. Only public http and https URLs on ports 80 and 443 are allowed. Local, private, and metadata addresses are refused, including redirects. The response body is discarded.
          </p>
        </CardContent>
      </Card>
      {state === "loading" && <p role="status" className="text-sm text-muted-foreground">Fetching response headers…</p>}
      {message && <p role="alert" className="text-sm text-danger">{message}</p>}
      {state === "done" && result && result.findings.length === 0 && <p className="text-sm text-muted-foreground">No header findings were produced.</p>}
      {result && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            HTTP {result.httpStatus} from {result.finalUrl}. {result.limitation}
          </p>
          <ul className="space-y-3">
            {result.findings.map((finding) => (
              <li key={finding.id} className="rounded-lg border border-border bg-card p-4 text-sm">
                <Badge variant={LEVEL[finding.level]}>{finding.level}</Badge>
                <p className="mt-2 font-medium">{finding.title}</p>
                <p className="break-words">Current: {finding.current}</p>
                <p className="text-muted-foreground">Recommended: {finding.recommended}</p>
                <p>{finding.why}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
