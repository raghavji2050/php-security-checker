"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type WordPressResponse = {
  version: string;
  status: "latest" | "outdated" | "insecure" | null;
  listed: boolean;
  latest: string[];
  summary: string;
  source: string;
  retrievedAt: string;
  stale: boolean;
  limitation: string;
  error?: string;
};

export function WordPressChecker() {
  const [version, setVersion] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "error" | "done">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [result, setResult] = useState<WordPressResponse | null>(null);

  async function submit() {
    setState("loading");
    setMessage(null);
    try {
      const response = await fetch(`/api/wordpress?v=${encodeURIComponent(version.trim())}`);
      const body = (await response.json()) as WordPressResponse;
      if (!response.ok) {
        setResult(null);
        setState("error");
        setMessage(body.error ?? "The check could not be completed.");
        return;
      }
      setResult(body);
      setState("done");
    } catch {
      setState("error");
      setMessage("Could not reach the checker.");
    }
  }

  const variant = result?.status === "insecure" ? "danger" : result?.status === "latest" ? "ok" : "warning";

  return (
    <div className="mt-8 space-y-4">
      <Card>
        <CardContent className="space-y-3 p-4 md:p-6">
          <form className="flex flex-col gap-3 sm:flex-row" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
            <label className="flex-1 text-sm">
              <span className="mb-1 block font-medium">WordPress core version</span>
              <Input value={version} onChange={(event) => setVersion(event.target.value)} placeholder="6.4.2" />
            </label>
            <Button type="submit" className="sm:self-end" disabled={state === "loading"}>{state === "loading" ? "Checking…" : "Check core"}</Button>
          </form>
          <p className="text-sm text-muted-foreground">Status labels are copied from WordPress.org&apos;s core stable-check API. Plugins and themes are not checked, and no CVE list is created.</p>
        </CardContent>
      </Card>
      {state === "loading" && <p role="status" className="text-sm text-muted-foreground">Asking WordPress.org for the published core status…</p>}
      {message && <p role="alert" className="text-sm text-danger">{message}</p>}
      {result && (
        <Card>
          <CardContent className="space-y-2 p-4 text-sm">
            <Badge variant={result.listed ? variant : "outline"}>{result.status ?? "not listed"}</Badge>
            <p>{result.summary}</p>
            {result.latest.length > 0 && <p>WordPress.org currently marks as latest: {result.latest.join(", ")}.</p>}
            <p className="text-muted-foreground">{result.limitation}</p>
            <p className="text-xs text-muted-foreground">
              <a className="underline" href={result.source}>api.wordpress.org stable-check</a>
              {result.stale ? " · stale cache" : ""} · {result.retrievedAt}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
