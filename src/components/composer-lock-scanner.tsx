"use client";

import { useCallback, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  MAX_LOCK_BYTES,
  packagesToVersionMap,
  parseComposerLock,
  type LockPackage,
  type ParseLockResult,
} from "@/lib/composer-lock";
import type { AffectedFinding, ComposerAuditResult } from "@/lib/composer-types";

const SAMPLE_LOCK = `{
  "_readme": ["sample composer.lock for the scanner demo"],
  "content-hash": "demo",
  "packages": [
    {
      "name": "guzzlehttp/psr7",
      "version": "2.4.0",
      "version_normalized": "2.4.0.0"
    },
    {
      "name": "symfony/polyfill-mbstring",
      "version": "v1.28.0",
      "version_normalized": "1.28.0.0"
    }
  ],
  "packages-dev": []
}`;

type ScanState =
  | { status: "idle" }
  | { status: "parsing" }
  | { status: "checking"; packageCount: number }
  | { status: "done"; parsed: Extract<ParseLockResult, { ok: true }>; result: ComposerAuditResult }
  | { status: "error"; message: string };

function severityVariant(severity: string | null): "danger" | "warning" | "secondary" | "ok" {
  const s = (severity ?? "").toLowerCase();
  if (s === "critical" || s === "high") return "danger";
  if (s === "medium" || s === "moderate") return "warning";
  if (s === "low") return "secondary";
  return "secondary";
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function FindingCard({ finding }: { finding: AffectedFinding }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-md border border-border p-4" data-testid="composer-finding">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={severityVariant(finding.severity)}>{finding.severity ?? "unrated"}</Badge>
        {finding.isDev ? <Badge variant="outline">dev</Badge> : null}
        <span className="font-medium">{finding.packageName}</span>
        <span className="font-mono text-xs text-muted-foreground">{finding.installedVersion}</span>
      </div>
      <p className="mt-2 text-sm">{finding.title}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Affected: <code>{finding.affectedVersions}</code>
        {finding.suggestedFixedVersions.length > 0 ? (
          <>
            {" · "}Fixed in / upgrade past:{" "}
            <code>{finding.suggestedFixedVersions.join(", ")}</code>
          </>
        ) : null}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
        {finding.link ? (
          <a className="text-primary underline" href={finding.link} target="_blank" rel="noopener noreferrer">
            Advisory
          </a>
        ) : null}
        {finding.cve && finding.cveUrl ? (
          <a className="text-primary underline" href={finding.cveUrl} target="_blank" rel="noopener noreferrer">
            {finding.cve}
          </a>
        ) : null}
        <code className="rounded bg-muted px-2 py-1 text-xs">{finding.updateCommand}</code>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={async () => {
            const ok = await copyText(finding.updateCommand);
            if (ok) {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }
          }}
        >
          {copied ? "Copied" : "Copy update"}
        </Button>
      </div>
    </div>
  );
}

export function ComposerLockScanner() {
  const [text, setText] = useState("");
  const [state, setState] = useState<ScanState>({ status: "idle" });
  const [fileName, setFileName] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const runScan = useCallback(async (source: string) => {
    const parsed = parseComposerLock(source);
    if (!parsed.ok) {
      setState({ status: "error", message: parsed.message });
      return;
    }

    setState({ status: "checking", packageCount: parsed.packages.length });
    const packages = parsed.packages.map((p: LockPackage) => ({
      name: p.name,
      version: p.version,
      isDev: p.isDev,
    }));

    try {
      const res = await fetch("/api/composer-advisories", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ packages }),
      });
      const body = (await res.json()) as ComposerAuditResult & { error?: string; code?: string };
      if (!res.ok) {
        setState({
          status: "error",
          message: body.error || `Check failed (HTTP ${res.status}).`,
        });
        return;
      }
      setState({ status: "done", parsed, result: body });
    } catch {
      setState({
        status: "error",
        message: "Could not reach the advisory API. Check your connection and retry.",
      });
    }
  }, []);

  const onFile = useCallback(
    async (file: File | null) => {
      if (!file) return;
      if (file.size > MAX_LOCK_BYTES) {
        setState({
          status: "error",
          message: `File is too large (max ${Math.floor(MAX_LOCK_BYTES / (1024 * 1024))} MB).`,
        });
        return;
      }
      setFileName(file.name);
      const content = await file.text();
      setText(content);
      await runScan(content);
    },
    [runScan],
  );

  return (
    <div className="mt-8 grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Paste or upload composer.lock</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <label htmlFor="composer-lock" className="sr-only">
            composer.lock JSON
          </label>
          <textarea
            id="composer-lock"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={12}
            spellCheck={false}
            placeholder='{ "packages": [ { "name": "vendor/package", "version": "1.2.3" } ], "packages-dev": [] }'
            className="w-full rounded-md border border-border bg-background p-3 font-mono text-sm"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              onClick={() => void runScan(text)}
              disabled={!text.trim() || state.status === "checking"}
            >
              {state.status === "checking" ? "Checking advisories…" : "Scan lock file"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => fileRef.current?.click()}
              disabled={state.status === "checking"}
            >
              Upload composer.lock
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".lock,application/json,text/plain"
              className="hidden"
              onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setFileName(null);
                setText(SAMPLE_LOCK);
                void runScan(SAMPLE_LOCK);
              }}
              disabled={state.status === "checking"}
            >
              Try a sample
            </Button>
            {fileName ? <span className="text-xs text-muted-foreground">Loaded: {fileName}</span> : null}
          </div>
          <p className="text-xs text-muted-foreground">
            Parsed only in your browser. The lock file is never uploaded — only the package name and version list is
            sent to check Packagist security advisories. Nothing is stored. Max {Math.floor(MAX_LOCK_BYTES / (1024 * 1024))}{" "}
            MB.
          </p>
        </CardContent>
      </Card>

      {state.status === "error" ? (
        <Card aria-live="polite">
          <CardHeader>
            <CardTitle>Could not scan</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">{state.message}</CardContent>
        </Card>
      ) : null}

      {state.status === "checking" ? (
        <Card aria-busy="true" aria-live="polite">
          <CardContent className="py-6 text-sm text-muted-foreground">
            Checking {state.packageCount} package{state.packageCount === 1 ? "" : "s"} against Packagist…
          </CardContent>
        </Card>
      ) : null}

      {state.status === "done" ? (
        <Card aria-live="polite" data-testid="composer-report">
          <CardHeader>
            <CardTitle>
              {state.result.advisoryCount === 0
                ? "No known advisories for these locked versions"
                : `${state.result.affectedCount} affected package${state.result.affectedCount === 1 ? "" : "s"} · ${state.result.advisoryCount} advisory${state.result.advisoryCount === 1 ? "" : "ies"}`}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm">
            <p className="text-muted-foreground">
              Checked {state.result.packageCount} package{state.result.packageCount === 1 ? "" : "s"} (
              {state.parsed.packageCount} prod
              {state.parsed.devPackageCount ? ` + ${state.parsed.devPackageCount} dev` : ""}) against the official{" "}
              <a
                className="text-primary underline"
                href="https://packagist.org/api/security-advisories/"
                target="_blank"
                rel="noopener noreferrer"
              >
                Packagist security advisories
              </a>{" "}
              API
              {state.result.stale ? " (cached copy; live Packagist was slow or unavailable)" : ""}.
            </p>

            {state.result.advisoryCount === 0 ? (
              <div className="rounded-md border border-ok/40 bg-ok/10 p-4 text-sm" data-testid="composer-clean">
                This lock looks clean for the advisories Packagist currently lists. That is not a full audit — keep
                Composer and your dependencies updated.
              </div>
            ) : (
              <>
                {state.result.updateCommands.length > 0 ? (
                  <div className="rounded-md border border-border bg-muted/40 p-3">
                    <p className="mb-2 font-medium">Suggested updates</p>
                    <pre className="overflow-x-auto text-xs leading-relaxed">
                      {state.result.updateCommands.join("\n")}
                    </pre>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="mt-2"
                      onClick={() => void copyText(state.result.updateCommands.join("\n"))}
                    >
                      Copy all commands
                    </Button>
                  </div>
                ) : null}
                <div className="grid gap-3">
                  {state.result.findings.map((finding) => (
                    <FindingCard key={`${finding.packageName}:${finding.advisoryId}`} finding={finding} />
                  ))}
                </div>
              </>
            )}

            <p className="text-xs text-muted-foreground">
              Debug: {Object.keys(packagesToVersionMap(state.parsed.packages)).length} unique names · content-hash{" "}
              {state.parsed.lockContentHash}
            </p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
