"use client";

import { Printer } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { CopyMarkdownButton } from "@/components/copy-markdown-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { ExtensionAssessment } from "@/lib/extension-check";
import { auditIni, parseIni, type IniFinding } from "@/lib/ini-audit";
import {
  auditSummaryMarkdown,
  readAuditVersion,
  summarizeAudit,
  type AuditSummary,
  type AuditVersionPart,
} from "@/lib/server-audit";
import type { CheckResult } from "@/lib/types";

type Report = {
  label: string | null;
  generatedAt: string;
  summary: AuditSummary;
  version: AuditVersionPart | null;
  ini: IniFinding[] | null;
  extensions: ExtensionAssessment[] | null;
  notes: string[];
};

const LEVEL: Record<AuditSummary["level"], { variant: "danger" | "warning" | "ok" | "secondary"; label: string }> = {
  action: { variant: "danger", label: "Action needed" },
  review: { variant: "warning", label: "Review" },
  ok: { variant: "ok", label: "No issues found" },
  incomplete: { variant: "secondary", label: "Incomplete" },
};

export function ServerAudit() {
  const [label, setLabel] = useState("");
  const [versionText, setVersionText] = useState("");
  const [iniText, setIniText] = useState("");
  const [modules, setModules] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<Report | null>(null);

  async function build() {
    setError(null);
    const notes: string[] = [];
    const parsedVersion = versionText.trim() ? readAuditVersion(versionText) : null;
    if (parsedVersion && !parsedVersion.ok) return setError(parsedVersion.error);
    let ini: IniFinding[] | null = null;
    if (iniText.trim()) {
      const parsed = parseIni(iniText);
      if (!parsed.ok) return setError(`php.ini: ${parsed.error}`);
      ini = auditIni(parsed.values, "production");
    }
    if (!parsedVersion && !ini && !modules.trim()) return setError("Add at least one input: PHP version, php.ini or php -m output.");

    setBusy(true);
    let version: AuditVersionPart | null = null;
    let extensions: ExtensionAssessment[] | null = null;
    try {
      if (parsedVersion?.ok) {
        const response = await fetch(`/api/check?v=${encodeURIComponent(parsedVersion.version)}`);
        if (response.ok) {
          const result = (await response.json()) as CheckResult;
          version = {
            version: result.version,
            securityStatus: result.securityStatus,
            supportState: result.support.state,
            supportLabel: result.support.label,
            confirmed: result.counts.confirmed,
            potential: result.counts.potential,
            critical: result.counts.critical,
            high: result.counts.high,
            recommendedVersion: result.recommendedVersion,
            distro: parsedVersion.distro,
            xdebug: parsedVersion.xdebug,
          };
        } else {
          notes.push(`Version check failed (HTTP ${response.status}); the version is not included in this summary.`);
        }
      }
      if (modules.trim()) {
        const response = await fetch("/api/extensions", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ modules, version: parsedVersion?.ok ? parsedVersion.version : undefined }),
        });
        const body = (await response.json().catch(() => ({}))) as { extensions?: ExtensionAssessment[]; error?: string };
        if (response.ok && body.extensions) extensions = body.extensions;
        else notes.push(`Extension check failed: ${body.error ?? `HTTP ${response.status}`}.`);
      }
    } catch {
      notes.push("Could not reach the checker for part of this audit.");
    } finally {
      setBusy(false);
    }
    setReport({
      label: label.trim().slice(0, 80) || null,
      generatedAt: new Date().toISOString().slice(0, 16).replace("T", " ") + " UTC",
      summary: summarizeAudit({ version, ini, extensions }),
      version,
      ini,
      extensions,
      notes,
    });
  }

  return (
    <div className="mt-8 space-y-6">
      <Card className="no-print">
        <CardContent className="space-y-4 p-4 md:p-6">
          <div>
            <label className="block text-sm font-medium" htmlFor="audit-label">Server or client name (optional, shown on the report)</label>
            <Input id="audit-label" value={label} maxLength={80} onChange={(e) => setLabel(e.target.value)} placeholder="acme-prod-web-1" />
          </div>
          <div>
            <label className="block text-sm font-medium" htmlFor="audit-version">PHP version or php -v output</label>
            <textarea id="audit-version" value={versionText} maxLength={5000} onChange={(e) => setVersionText(e.target.value)}
              placeholder={"8.3.12\nor paste: PHP 8.1.2-1ubuntu2.20 (cli) ..."}
              className="min-h-20 w-full rounded-md border border-border bg-background p-3 font-mono text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium" htmlFor="audit-ini">php.ini (optional, read in your browser)</label>
            <textarea id="audit-ini" value={iniText} onChange={(e) => setIniText(e.target.value)} placeholder={"display_errors = Off\nexpose_php = Off"}
              className="min-h-28 w-full rounded-md border border-border bg-background p-3 font-mono text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium" htmlFor="audit-modules">php -m output (optional, only module names are sent)</label>
            <textarea id="audit-modules" value={modules} onChange={(e) => setModules(e.target.value)} placeholder={"[PHP Modules]\ncurl\nopenssl"}
              className="min-h-28 w-full rounded-md border border-border bg-background p-3 font-mono text-sm" />
          </div>
          <Button type="button" disabled={busy} onClick={() => void build()}>{busy ? "Building…" : "Build audit summary"}</Button>
          <p className="text-xs text-muted-foreground">
            php.ini is parsed in your browser. The version goes to our /api/check and module names to /api/extensions. Nothing is stored.
          </p>
          {error && <p role="status" className="text-sm text-danger">{error}</p>}
        </CardContent>
      </Card>

      {report && (
        <Card data-testid="audit-report">
          <CardHeader>
            <CardTitle>PHP server audit summary{report.label ? `: ${report.label}` : ""}</CardTitle>
            <p className="text-sm text-muted-foreground">Generated {report.generatedAt} · php-security-checker.vercel.app</p>
          </CardHeader>
          <CardContent className="space-y-5 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={LEVEL[report.summary.level].variant} data-testid="audit-level">{LEVEL[report.summary.level].label}</Badge>
              <span className="font-medium">{report.summary.headline}</span>
            </div>
            {report.notes.map((note) => <p key={note} className="text-warning">{note}</p>)}

            {report.summary.actions.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead><tr className="border-b border-border"><th className="py-2 pr-3">Priority</th><th className="py-2 pr-3">Area</th><th className="py-2">Finding</th></tr></thead>
                  <tbody>
                    {report.summary.actions.map((a, i) => (
                      <tr key={i} className="border-b border-border/60 align-top">
                        <td className="py-2 pr-3"><Badge variant={a.level === "action" ? "danger" : "warning"}>{a.level === "action" ? "Action" : "Review"}</Badge></td>
                        <td className="py-2 pr-3 font-mono">{a.area}</td>
                        <td className="py-2">{a.text}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {report.version && (
              <section>
                <h2 className="font-semibold">PHP version</h2>
                <p className="mt-1">
                  PHP {report.version.version}: {report.version.supportLabel}; {report.version.confirmed} confirmed and {report.version.potential} to verify.
                  {report.version.recommendedVersion ? ` Recommended: PHP ${report.version.recommendedVersion}.` : ""}{" "}
                  <Link className="text-primary underline" href={`/check/${report.version.version}`}>Full CVE report</Link>
                </p>
              </section>
            )}
            {report.ini && (
              <section>
                <h2 className="font-semibold">php.ini (production target)</h2>
                <p className="mt-1">
                  {report.ini.filter((f) => f.level === "high").length} high, {report.ini.filter((f) => f.level === "review").length} to review,{" "}
                  {report.ini.filter((f) => f.level === "ok").length} fine. <Link className="text-primary underline" href="/php-ini">Details per directive</Link>
                </p>
              </section>
            )}
            {report.extensions && (
              <section>
                <h2 className="font-semibold">Loaded modules</h2>
                <p className="mt-1 font-mono text-xs">{report.extensions.map((e) => e.name).join(", ")}</p>
              </section>
            )}
            <p className="text-muted-foreground">
              Checked: {report.summary.checked.join(", ") || "nothing"}.
              {report.summary.notChecked.length > 0 ? ` Not checked: ${report.summary.notChecked.join(", ")}.` : ""} CVE data comes
              from NVD and support dates from php.net. Distribution packages may include backported fixes.
            </p>
            <div className="no-print flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => window.print()}><Printer />Print / save as PDF</Button>
              <CopyMarkdownButton markdown={auditSummaryMarkdown(report.summary, report.label, report.generatedAt)} />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
