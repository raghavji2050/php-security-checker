"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { auditCsrfChoice, auditLaravelEnv, type ConfigFinding, type LaravelTarget } from "@/lib/laravel-config";
import type { ComposerAuditResult } from "@/lib/composer-types";

type SupportRow = {
  major: number;
  php: string;
  releaseText: string;
  bugFixesText: string;
  securityFixesText: string;
};

type LaravelResponse = {
  version: string;
  support: {
    state: string;
    detail: string;
    row: SupportRow | null;
    source: string;
    retrievedAt: string;
    stale: boolean;
  } | null;
  supportError: string | null;
  advisories: ComposerAuditResult | null;
  advisoryError: string | null;
  limitation: string;
  error?: string;
};

const LEVEL = { high: "danger", review: "warning", ok: "ok", info: "secondary" } as const;

export function LaravelChecker() {
  const [version, setVersion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LaravelResponse | null>(null);
  const [envText, setEnvText] = useState("");
  const [target, setTarget] = useState<LaravelTarget>("production");
  const [csrf, setCsrf] = useState<"enabled" | "disabled" | "unsure">("unsure");
  const [configError, setConfigError] = useState<string | null>(null);
  const [config, setConfig] = useState<ConfigFinding[] | null>(null);

  async function checkVersion() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/laravel?v=${encodeURIComponent(version.trim())}`);
      const body = (await response.json()) as LaravelResponse;
      if (!response.ok) {
        setResult(null);
        setError(body.error ?? "The check could not be completed.");
      } else {
        setResult(body);
      }
    } catch {
      setError("Could not reach the checker.");
    } finally {
      setLoading(false);
    }
  }

  function checkEnv() {
    const audited = auditLaravelEnv(envText, target);
    if ("error" in audited) {
      setConfig(null);
      setConfigError(audited.error);
      return;
    }
    setConfigError(null);
    setConfig([...audited.findings, auditCsrfChoice(csrf)]);
    setEnvText("");
  }

  return (
    <div className="mt-8 space-y-8">
      <Card>
        <CardHeader><CardTitle>Framework version</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <form className="flex flex-col gap-3 sm:flex-row" onSubmit={(event) => { event.preventDefault(); void checkVersion(); }}>
            <label className="flex-1 text-sm">
              <span className="mb-1 block font-medium">laravel/framework version</span>
              <Input value={version} onChange={(event) => setVersion(event.target.value)} placeholder="11.31.0" />
            </label>
            <Button type="submit" className="sm:self-end" disabled={loading}>{loading ? "Checking…" : "Check Laravel"}</Button>
          </form>
          <p className="text-sm text-muted-foreground">Support dates come from Laravel&apos;s release notes. Advisories come from Packagist for laravel/framework only.</p>
          {loading && <p role="status" className="text-sm text-muted-foreground">Loading the official support table and Packagist advisories…</p>}
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          {result && (
            <div className="space-y-3 text-sm">
              <p>{result.limitation}</p>
              {result.supportError && <p role="alert">{result.supportError}</p>}
              {result.support && (
                <div className="rounded-md border border-border p-3">
                  <Badge variant={result.support.state === "eol" ? "danger" : result.support.state === "active" ? "ok" : "warning"}>{result.support.state}</Badge>
                  <p className="mt-2">{result.support.detail}</p>
                  {result.support.row && (
                    <p className="mt-2 text-muted-foreground">
                      PHP {result.support.row.php}. Released {result.support.row.releaseText}. Bug fixes until {result.support.row.bugFixesText}. Security fixes until {result.support.row.securityFixesText}.
                    </p>
                  )}
                  <p className="mt-2 text-xs text-muted-foreground">
                    <a className="underline" href={result.support.source}>Release notes</a>
                    {result.support.stale ? " · stale cache" : ""} · {result.support.retrievedAt}
                  </p>
                </div>
              )}
              {result.advisoryError && <p role="alert">{result.advisoryError}</p>}
              {result.advisories && result.advisories.findings.length === 0 && <p>No Packagist advisory matched laravel/framework {result.version}.</p>}
              {result.advisories && result.advisories.findings.length > 0 && (
                <ul className="space-y-2">
                  {result.advisories.findings.map((finding) => (
                    <li key={finding.advisoryId} className="rounded-md border border-border p-3">
                      <p className="font-medium">{finding.title}</p>
                      <p className="text-muted-foreground">{finding.severity ?? "unrated"} · {finding.affectedVersions}</p>
                      {finding.link && <a className="text-primary underline" href={finding.link}>Advisory</a>}
                      {finding.updateCommand && <pre className="mt-2 overflow-x-auto rounded-md bg-muted p-2 font-mono text-xs">{finding.updateCommand}</pre>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Configuration checklist</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Paste env lines locally. APP_KEY is not sent to the server and is removed from this page after the check. This does not inspect a live app.
          </p>
          <div className="flex flex-wrap gap-2">
            {(["production", "local"] as const).map((item) => (
              <Button key={item} type="button" size="sm" variant={target === item ? "default" : "outline"} onClick={() => setTarget(item)}>
                {item}
              </Button>
            ))}
          </div>
          <textarea
            value={envText}
            onChange={(event) => setEnvText(event.target.value)}
            placeholder={"APP_ENV=production\nAPP_DEBUG=false\nAPP_KEY=base64:not-shown"}
            className="min-h-32 w-full rounded-md border border-border bg-background p-3 font-mono text-sm"
          />
          <label className="block text-sm">
            CSRF middleware for web routes
            <select className="mt-1 h-10 w-full rounded-md border border-border bg-background px-2" value={csrf} onChange={(event) => setCsrf(event.target.value as typeof csrf)}>
              <option value="unsure">I have not checked</option>
              <option value="enabled">Enabled</option>
              <option value="disabled">Disabled or broadly excepted</option>
            </select>
          </label>
          <Button type="button" onClick={checkEnv}>Review pasted values</Button>
          {configError && <p role="alert" className="text-sm text-danger">{configError}</p>}
          {config && (
            <ul className="space-y-3">
              {config.map((item) => (
                <li key={item.id} className="rounded-md border border-border p-3 text-sm">
                  <Badge variant={LEVEL[item.level]}>{item.level}</Badge>
                  <p className="mt-2 font-medium">{item.title}</p>
                  <p>Current: {item.current}</p>
                  <p className="text-muted-foreground">{item.why}</p>
                  <p>{item.fix}</p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
