"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { ExtensionAssessment } from "@/lib/extension-check";

type ResponseBody = {
  version: string | null;
  versionStatus: string | null;
  extensions: ExtensionAssessment[];
  limitation: string;
  retrievedAt: string | null;
  stale: boolean;
  error?: string;
};

const STATUS: Record<ExtensionAssessment["status"], string> = {
  confirmed_on_entered_version: "A PHP runtime CVE that mentions this extension is confirmed for the version you entered.",
  potential_on_entered_version: "A PHP runtime CVE that mentions this extension needs verification for the version you entered.",
  mentioned_not_reported_for_version: "NVD text mentions this extension, and the version check did not report those CVEs for the version you entered.",
  mentioned_version_not_checked: "NVD text mentions this extension. Enter a PHP version to see whether that runtime CVE matches.",
  no_matching_text: "No PHP runtime CVE description matched this name with the phrase rules. That is not proof it is safe.",
};

const KIND: Record<ExtensionAssessment["kind"], string> = {
  bundled: "Ships in php-src",
  moved_to_pecl: "Moved to PECL (imap, as of PHP 8.4)",
  sapi: "SAPI module",
  not_in_php_src_list: "Not in the php-src name list used here",
};

export function ExtensionChecker() {
  const [modules, setModules] = useState("");
  const [version, setVersion] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [result, setResult] = useState<ResponseBody | null>(null);

  async function submit() {
    setState("loading");
    setMessage(null);
    try {
      const response = await fetch("/api/extensions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ modules, version: version.trim() || undefined }),
      });
      const body = (await response.json()) as ResponseBody;
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

  return (
    <div className="mt-8 space-y-4">
      <Card>
        <CardContent className="space-y-3 p-4 md:p-6">
          <label className="block text-sm font-medium" htmlFor="modules">php -m output</label>
          <textarea
            id="modules"
            value={modules}
            onChange={(event) => setModules(event.target.value)}
            placeholder={"[PHP Modules]\ncurl\nopenssl\nphar"}
            className="min-h-40 w-full rounded-md border border-border bg-background p-3 font-mono text-sm"
          />
          <label className="block text-sm font-medium" htmlFor="ext-version">PHP version (optional)</label>
          <Input id="ext-version" value={version} onChange={(event) => setVersion(event.target.value)} placeholder="8.3.12" />
          <Button type="button" disabled={state === "loading"} onClick={() => void submit()}>
            {state === "loading" ? "Checking…" : "Check extensions"}
          </Button>
          <p className="text-sm text-muted-foreground">
            Only module names are sent. Outdated versus current is not assessed. Confirmed means an existing PHP runtime
            CVE mentions the extension and the version check already confirmed that CVE.
          </p>
        </CardContent>
      </Card>
      {state === "loading" && <p role="status" className="text-sm text-muted-foreground">Comparing names with NVD PHP runtime descriptions…</p>}
      {message && <p role="alert" className="text-sm text-danger">{message}</p>}
      {result && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {result.limitation}
            {result.stale ? " NVD data is from a stale cache." : ""}
            {result.retrievedAt ? ` Retrieved ${result.retrievedAt}.` : ""}
          </p>
          <ul className="space-y-3">
            {result.extensions.map((item) => (
              <li key={item.name} className="rounded-lg border border-border bg-card p-4 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono font-medium">{item.name}</span>
                  <Badge variant="outline">{KIND[item.kind]}</Badge>
                  <Badge variant={item.status === "confirmed_on_entered_version" ? "danger" : item.status === "no_matching_text" ? "secondary" : "warning"}>
                    {item.status === "no_matching_text" ? "No matching text" : `${item.mentionCount} mention${item.mentionCount === 1 ? "" : "s"}`}
                  </Badge>
                </div>
                <p className="mt-2 text-muted-foreground">{STATUS[item.status]}</p>
                <p className="mt-1 text-muted-foreground">{item.outdatedReason}</p>
                {item.mentions.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {item.mentions.map((mention) => (
                      <li key={mention.id}>
                        <a className="font-mono text-primary underline" href={`https://nvd.nist.gov/vuln/detail/${mention.id}`} target="_blank" rel="noreferrer">
                          {mention.id}
                        </a>
                        {" "}
                        {mention.severity ?? "unrated"} · {mention.verdict.replace(/_/g, " ")}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
