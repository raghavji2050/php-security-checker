"use client";

import { useMemo, useState } from "react";
import { CopyMarkdownButton } from "@/components/copy-markdown-button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  badgeSnippets,
  buildWorkflowYaml,
  FAIL_ON_OPTIONS,
  normalizeActionPhpVersion,
  WORKFLOW_PATH,
  type FailOn,
} from "@/lib/github-action";

function Toggle({ checked, onChange, label, testId }: { checked: boolean; onChange: (v: boolean) => void; label: string; testId: string }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={checked} onChange={(e) => onChange(e.target.checked)} data-testid={testId} />
      {label}
    </label>
  );
}

export function WorkflowGenerator({ siteUrl }: { siteUrl: string }) {
  const [auto, setAuto] = useState(true);
  const [phpVersion, setPhpVersion] = useState("8.3.12");
  const [scanComposer, setScanComposer] = useState(true);
  const [failOn, setFailOn] = useState<FailOn>("any");
  const [prComment, setPrComment] = useState(true);
  const versionOk = auto || normalizeActionPhpVersion(phpVersion) !== null;
  const yaml = useMemo(
    () => buildWorkflowYaml({ phpVersion: auto ? "" : phpVersion, scanComposer, failOn, prComment, siteUrl }),
    [auto, phpVersion, scanComposer, failOn, prComment, siteUrl],
  );
  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Toggle checked={auto} onChange={setAuto} label="Auto-detect PHP version from the repo" testId="gha-auto" />
            <label className="block text-sm">
              <span className="mb-1 block font-medium">PHP version in production</span>
              <Input value={phpVersion} disabled={auto} onChange={(e) => setPhpVersion(e.target.value)} placeholder="8.3.12" aria-invalid={!versionOk} data-testid="gha-php" />
            </label>
            {!versionOk && <p role="alert" className="text-sm text-danger">Use an exact release such as 8.3.12.</p>}
          </div>
          <div className="space-y-2">
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Fail CI on</span>
              <select
                className="h-12 w-full rounded-md border border-border bg-card px-3 text-base"
                value={failOn}
                onChange={(e) => setFailOn(e.target.value as FailOn)}
                data-testid="gha-fail-on"
              >
                {FAIL_ON_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
            <p className="text-xs text-muted-foreground">{FAIL_ON_OPTIONS.find((o) => o.value === failOn)?.hint}</p>
            <Toggle checked={scanComposer} onChange={setScanComposer} label="Scan composer.lock packages" testId="gha-composer" />
            <Toggle checked={prComment} onChange={setPrComment} label="Post fix commands as a PR comment" testId="gha-comment" />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-mono text-sm text-muted-foreground">{WORKFLOW_PATH}</p>
          <CopyMarkdownButton markdown={yaml} label="Copy workflow" testId="copy-workflow" />
        </div>
        <pre className="max-h-[28rem] overflow-auto rounded-lg border bg-muted/40 p-4 text-xs" data-testid="gha-yaml">
          <code>{yaml}</code>
        </pre>
      </CardContent>
    </Card>
  );
}

export function BadgeGenerator({ siteUrl, initial = "8.3.12" }: { siteUrl: string; initial?: string }) {
  const [version, setVersion] = useState(initial);
  const snippets = badgeSnippets(version, siteUrl);
  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <label className="block text-sm sm:max-w-xs">
          <span className="mb-1 block font-medium">PHP version</span>
          <Input value={version} onChange={(e) => setVersion(e.target.value)} placeholder="8.3.12" data-testid="badge-php" />
        </label>
        {snippets ? (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm text-muted-foreground">Live preview:</span>
              <a href={snippets.reportUrl}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={snippets.imageUrl.replace(siteUrl.replace(/\/+$/, ""), "")} alt={`PHP ${version} security status`} height={20} data-testid="badge-preview" />
              </a>
            </div>
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-medium">Markdown (README)</h3>
                <CopyMarkdownButton markdown={snippets.markdown} label="Copy Markdown" testId="copy-badge-markdown" />
              </div>
              <pre className="mt-2 overflow-x-auto rounded-lg border bg-muted/40 p-3 text-xs"><code>{snippets.markdown}</code></pre>
            </div>
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-medium">HTML</h3>
                <CopyMarkdownButton markdown={snippets.html} label="Copy HTML" testId="copy-badge-html" />
              </div>
              <pre className="mt-2 overflow-x-auto rounded-lg border bg-muted/40 p-3 text-xs"><code>{snippets.html}</code></pre>
            </div>
          </>
        ) : (
          <p role="alert" className="text-sm text-danger">Use an exact release such as 8.3.12.</p>
        )}
      </CardContent>
    </Card>
  );
}
