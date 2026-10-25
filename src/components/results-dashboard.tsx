"use client";

import { Check, ChevronDown, Copy, Download, ExternalLink, Link2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatStampWithZone } from "@/lib/format";
import type { CheckResult, Finding, SecurityStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUS_CLASS: Record<SecurityStatus, string> = {
  vulnerable: "bg-[#9f1239] text-white",
  caution: "bg-[#b45309] text-white",
  no_known_issues: "bg-[#047857] text-white",
  unable_to_verify: "bg-[#44403c] text-white",
};

function formatDay(value: string | null): string {
  if (!value) return "Not provided";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return value;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function formatStamp(value: string | null): string {
  if (!value) return "Not provided";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(date) + " UTC";
}

function severityVariant(severity: string | null): "danger" | "warning" | "secondary" | "outline" {
  if (severity === "CRITICAL" || severity === "HIGH") return "danger";
  if (severity === "MEDIUM") return "warning";
  if (severity === "LOW") return "secondary";
  return "outline";
}

function summaryText(result: CheckResult): string {
  const lines = [
    `PHP ${result.version}`,
    `Support: ${result.support.label}`,
    `Status: ${result.securityStatusLabel}`,
    `Confirmed vulnerabilities: ${result.counts.confirmed}`,
    `Critical: ${result.counts.critical}`,
    `High: ${result.counts.high}`,
    `Confirmed RCE-related: ${result.counts.rce}`,
    `Minimum fix on this branch: ${result.minimumFixedVersion ?? "Not verified"}`,
    `Recommended upgrade: ${result.recommendedVersion ?? "Not verified"}`,
    `Data updated: ${formatStamp(result.lastDataUpdate)}${result.stale ? " (stale)" : ""}`,
    result.disclaimer,
  ];
  return lines.join("\n");
}

export function ResultsDashboard({ result }: { result: CheckResult }) {
  const [severity, setSeverity] = useState("all");
  const [rceOnly, setRceOnly] = useState(false);
  const [sortDesc, setSortDesc] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [copied, setCopied] = useState<"results" | "link" | null>(null);

  const rows = useMemo(() => {
    const filtered = result.vulnerabilities.filter((finding) => {
      if (rceOnly && !finding.rce) return false;
      if (severity === "all") return true;
      if (severity === "unknown") return !finding.severity;
      return finding.severity === severity;
    });
    return filtered.sort((a, b) => {
      const delta = (a.cvssScore ?? -1) - (b.cvssScore ?? -1);
      return sortDesc ? -delta : delta;
    });
  }, [result.vulnerabilities, severity, rceOnly, sortDesc]);

  async function copyResults() {
    await navigator.clipboard.writeText(summaryText(result));
    setCopied("results");
  }

  async function share() {
    const url = new URL("/", window.location.origin);
    url.searchParams.set("v", result.version);
    try {
      await navigator.clipboard.writeText(url.toString());
      setCopied("link");
    } catch {
      window.prompt("Copy this link", url.toString());
    }
  }

  function downloadJson() {
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = `php-${result.version}-security-check.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(href);
  }

  return (
    <section aria-live="polite" className="mt-8 flex flex-col gap-5">
      <div className={cn("rounded-lg p-5 shadow-sm", STATUS_CLASS[result.securityStatus])}>
        <p className="text-xs font-medium uppercase tracking-[0.16em] opacity-80">Security status</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight">{result.securityStatusLabel}</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 opacity-95">{result.statusExplanation}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={() => void copyResults()}>
          {copied === "results" ? <Check /> : <Copy />}
          Copy results
        </Button>
        <Button type="button" variant="outline" onClick={() => void share()}>
          {copied === "link" ? <Check /> : <Link2 />}
          Copy link
        </Button>
        <Button type="button" variant="outline" onClick={downloadJson}>
          <Download />
          Download JSON
        </Button>
      </div>
      <p className="-mt-2 text-sm text-muted-foreground">
        Data last updated: {formatStampWithZone(result.lastDataUpdate)}
        {result.stale ? " · cached copy, the live source was unavailable, so this result may be incomplete" : ""}
      </p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Current version" value={result.version} mono />
        <Stat label="Official support" value={result.support.label} detail={`PHP ${result.support.branch}`} />
        <Stat label="Known vulnerabilities" value={String(result.counts.confirmed)} detail={`${result.counts.potential} need verification`} />
        <Stat label="Critical / high" value={`${result.counts.critical} / ${result.counts.high}`} detail="Confirmed findings only" />
        <Stat label="RCE-related CVEs" value={String(result.counts.rce)} detail="Confirmed, with a stated basis" />
        <Stat label="Minimum security fix" value={result.minimumFixedVersion ?? "Not verified"} mono />
        <Stat label="Recommended upgrade" value={result.recommendedVersion ?? "Not verified"} mono />
        <Stat
          label="Last data update"
          value={formatStamp(result.lastDataUpdate)}
          detail={result.stale ? "Stale cache" : "Fresh cache"}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upgrade recommendation</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm leading-6">
          <div>
            <p className="font-medium">Minimum security fix on PHP {result.support.branch}</p>
            <p className="text-muted-foreground">{result.minimumFixedNote}</p>
          </div>
          <div>
            <p className="font-medium">Recommended long-term release</p>
            <p className="text-muted-foreground">{result.recommendedNote}</p>
          </div>
          <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
            {result.compatibilityNotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Support timeline</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <Fact label="Initial release" value={formatDay(result.support.initialReleaseDate)} />
          <Fact label="Active support end" value={formatDay(result.support.activeSupportEnd)} />
          <Fact label="Security support end" value={formatDay(result.support.securitySupportEnd)} />
          <Fact label="Latest patch on branch" value={result.support.latestPatch ?? "Not provided"} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Remote Code Execution & Shell Execution Risk</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm leading-6">
          <p className="text-muted-foreground">
            This section lists matched records whose CWE or description indicates remote code execution, command
            injection, shell execution, CGI argument injection, code execution, or unsafe runtime behavior. The
            basis is shown for each one. A matching version does not prove the bug is exploitable: the SAPI,
            operating system, web server, and extensions decide whether the vulnerable code path exists.
          </p>
          {result.rceVulnerabilities.length === 0 ? (
            <p>No RCE-classified records matched this version in the current data.</p>
          ) : (
            <ul className="space-y-3">
              {result.rceVulnerabilities.map((finding) => (
                <li key={finding.id} className="rounded-md border border-border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono font-medium">{finding.cveId ?? finding.ghsaId ?? finding.id}</span>
                    <Badge variant={finding.verdict === "confirmed" ? "danger" : "warning"}>{finding.verdictLabel}</Badge>
                    <Badge variant={severityVariant(finding.severity)}>{finding.severity ?? "Not provided"}</Badge>
                  </div>
                  <p className="mt-2 text-muted-foreground">{finding.description}</p>
                  <p className="mt-2">Affected versions: {finding.affectedVersions}</p>
                  <p>Fixed version: {finding.fixedVersion ?? "Not verified"}</p>
                  <p>CVSS: {finding.cvssScore ?? "Not provided"}{finding.cvssVersion ? ` (v${finding.cvssVersion})` : ""}</p>
                  {finding.prerequisites.length > 0 && (
                    <p>Documented prerequisites: {finding.prerequisites.join("; ")}</p>
                  )}
                  <p className="mt-1">Classification basis: {finding.rce?.basis.map((item) => item.detail).join("; ")}</p>
                  {finding.advisoryUrl && (
                    <a className="mt-2 inline-flex items-center gap-1 text-primary underline-offset-2 hover:underline" href={finding.advisoryUrl} target="_blank" rel="noreferrer">
                      Official advisory <ExternalLink className="size-3" />
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Vulnerability table</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter severity">
            {["all", "CRITICAL", "HIGH", "MEDIUM", "LOW", "unknown"].map((item) => (
              <Button
                key={item}
                type="button"
                size="sm"
                variant={severity === item ? "default" : "outline"}
                onClick={() => setSeverity(item)}
              >
                {item === "all" ? "All severities" : item === "unknown" ? "Not provided" : item}
              </Button>
            ))}
            <Button type="button" size="sm" variant={rceOnly ? "default" : "outline"} onClick={() => setRceOnly((value) => !value)}>
              RCE only
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setSortDesc((value) => !value)}>
              Sort CVSS {sortDesc ? "high to low" : "low to high"}
            </Button>
          </div>

          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>CVE</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>CVSS</TableHead>
                  <TableHead>Affected versions</TableHead>
                  <TableHead>Fixed version</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6}>No rows match these filters.</TableCell>
                  </TableRow>
                )}
                {rows.map((finding) => (
                  <FindingRows key={finding.id} finding={finding} open={openId === finding.id} onToggle={() => setOpenId(openId === finding.id ? null : finding.id)} />
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="space-y-3 md:hidden">
            {rows.length === 0 && <p className="text-sm text-muted-foreground">No rows match these filters.</p>}
            {rows.map((finding) => (
              <article key={finding.id} className="rounded-md border border-border min-w-0 p-3 text-sm [overflow-wrap:anywhere]">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-mono font-medium">{finding.cveId ?? finding.id}</p>
                  <Badge variant={severityVariant(finding.severity)}>{finding.severity ?? "Not provided"}</Badge>
                </div>
                <p className="mt-2">CVSS {finding.cvssScore ?? "Not provided"}</p>
                <p className="mt-1 text-muted-foreground">{finding.affectedVersions}</p>
                <p className="mt-1">Fixed: {finding.fixedVersion ?? "Not verified"}</p>
                <FindingDetails finding={finding} />
              </article>
            ))}
          </div>
        </CardContent>
      </Card>

      {(result.warnings.length > 0 || result.notes.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle>Data notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            {result.warnings.map((warning) => (
              <p key={warning}>{warning}</p>
            ))}
            {result.notes.map((note) => (
              <p key={note}>{note}</p>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Sources</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {result.sources.map((source) => (
            <p key={source.name}>
              <a className="underline-offset-2 hover:underline" href={source.url} target="_blank" rel="noreferrer">
                {source.name}
              </a>
              <span className="text-muted-foreground">
                {" "}
                · {source.retrievedAt ? formatStamp(source.retrievedAt) : "not retrieved"}
                {source.stale ? " · stale" : ""}
              </span>
            </p>
          ))}
        </CardContent>
      </Card>
    </section>
  );
}

function Stat({ label, value, detail, mono = false }: { label: string; value: string; detail?: string; mono?: boolean }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className={cn("mt-1 text-lg font-semibold", mono && "font-mono")}>{value}</p>
        {detail && <p className="text-xs text-muted-foreground">{detail}</p>}
      </CardContent>
    </Card>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-medium">{value}</p>
    </div>
  );
}

function FindingRows({ finding, open, onToggle }: { finding: Finding; open: boolean; onToggle: () => void }) {
  return (
    <>
      <TableRow>
        <TableCell className="font-mono">
          <div>{finding.cveId ?? finding.id}</div>
          <div className="mt-1 text-xs text-muted-foreground">{finding.verdictLabel}</div>
        </TableCell>
        <TableCell>
          <Badge variant={severityVariant(finding.severity)}>{finding.severity ?? "Not provided"}</Badge>
        </TableCell>
        <TableCell>{finding.cvssScore ?? "Not provided"}</TableCell>
        <TableCell className="max-w-xs">{finding.affectedVersions}</TableCell>
        <TableCell>{finding.fixedVersion ?? "Not verified"}</TableCell>
        <TableCell>
          <Button type="button" size="sm" variant="ghost" onClick={onToggle} aria-expanded={open}>
            Details <ChevronDown className={cn("transition-transform", open && "rotate-180")} />
          </Button>
        </TableCell>
      </TableRow>
      {open && (
        <TableRow>
          <TableCell colSpan={6}>
            <FindingDetails finding={finding} />
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function FindingDetails({ finding }: { finding: Finding }) {
  return (
    <div className="min-w-0 space-y-2 py-1 text-sm leading-6 [overflow-wrap:anywhere]">
      <p>{finding.description || "No description was published."}</p>
      <p className="text-muted-foreground">{finding.fixedVersionNote}</p>
      {finding.prerequisites.length > 0 && <p>Prerequisites: {finding.prerequisites.join("; ")}</p>}
      {finding.conflictNotes.length > 0 && <p>Conflict: {finding.conflictNotes.join(" ")}</p>}
      {finding.rce && <p>RCE basis: {finding.rce.basis.map((item) => item.detail).join("; ")}</p>}
      <p className="text-muted-foreground">
        Sources: {finding.sources.map((source) => source.name).join(", ") || "Not provided"}
      </p>
      {finding.advisoryUrl && (
        <a className="inline-flex items-center gap-1 text-primary hover:underline" href={finding.advisoryUrl} target="_blank" rel="noreferrer">
          Open advisory <ExternalLink className="size-3" />
        </a>
      )}
    </div>
  );
}
