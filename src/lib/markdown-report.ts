import type { ComposerAuditResult } from "@/lib/composer-types";
import type { SymfonyCheck } from "@/lib/symfony-support";
import type { CheckResult } from "@/lib/types";

/** Escape text for a GitHub-flavoured Markdown table cell. */
export function mdCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  return String(value).replace(/\\/g, "\\\\").replace(/\|/g, "\\|").replace(/[\r\n]+/g, " ").trim();
}

function cveLink(id: string | null, siteUrl: string, fallback: string | null): string {
  if (id) return `[${id}](${siteUrl}/cve/${id})`;
  return mdCell(fallback);
}

/** Version report as Markdown, for pasting into a GitHub issue, PR or Jira ticket. */
export function versionReportMarkdown(result: CheckResult, siteUrl: string, limit = 50): string {
  const base = siteUrl.replace(/\/$/, "");
  const c = result.counts;
  const lines = [
    `## PHP ${result.version} security check`,
    "",
    `- **Status:** ${result.securityStatusLabel}`,
    `- **Support:** ${result.support.label}${result.support.securitySupportEnd ? ` (security fixes until ${result.support.securitySupportEnd})` : ""}`,
    `- **Confirmed vulnerabilities:** ${c.confirmed} (${c.critical} critical, ${c.high} high, ${c.medium} medium, ${c.low} low${c.unrated ? `, ${c.unrated} unrated` : ""})`,
    `- **Minimum fix on this branch:** ${result.minimumFixedVersion ?? "Not verified"}`,
    `- **Recommended upgrade:** ${result.recommendedVersion ?? "Not verified"}`,
    "",
  ];
  const confirmed = result.vulnerabilities.filter((f) => f.verdict === "confirmed");
  if (confirmed.length > 0) {
    lines.push("| CVE | Severity | CVSS | Fixed in |", "| --- | --- | --- | --- |");
    for (const f of confirmed.slice(0, limit)) {
      lines.push(`| ${cveLink(f.cveId, base, f.ghsaId ?? f.id)} | ${mdCell(f.severity)} | ${mdCell(f.cvssScore?.toFixed(1))} | ${mdCell(f.fixedVersion)} |`);
    }
    if (confirmed.length > limit) lines.push("", `_…and ${confirmed.length - limit} more. Full list: ${base}/check/${result.version}_`);
    lines.push("");
  }
  lines.push(
    `Full report: ${base}/check/${result.version}`,
    `Data updated ${result.lastDataUpdate ?? "unknown"}${result.stale ? " (stale cache)" : ""}. Sources: ${result.sources.map((s) => s.name).join(", ") || "not provided"}.`,
  );
  return lines.join("\n");
}

/** composer.lock audit as Markdown. */
export function composerReportMarkdown(result: ComposerAuditResult, siteUrl: string): string {
  const base = siteUrl.replace(/\/$/, "");
  const lines = [
    "## composer.lock security check",
    "",
    `Checked ${result.packageCount} package${result.packageCount === 1 ? "" : "s"} against the Packagist security advisories API: ${result.affectedCount} affected, ${result.advisoryCount} advisor${result.advisoryCount === 1 ? "y" : "ies"}.`,
    "",
  ];
  if (result.findings.length === 0) {
    lines.push("No known advisories for these locked versions.");
  } else {
    lines.push("| Package | Installed | Advisory | Severity | Fixed in |", "| --- | --- | --- | --- | --- |");
    for (const f of result.findings) {
      const advisory = f.cve ? `[${f.cve}](${f.cveUrl ?? `https://nvd.nist.gov/vuln/detail/${f.cve}`})` : f.link ? `[${mdCell(f.advisoryId)}](${f.link})` : mdCell(f.advisoryId);
      lines.push(`| ${mdCell(f.packageName)} | ${mdCell(f.installedVersion)} | ${advisory} | ${mdCell(f.severity)} | ${mdCell(f.suggestedFixedVersions.join(", "))} |`);
    }
    if (result.updateCommands.length > 0) lines.push("", "```sh", ...result.updateCommands, "```");
  }
  lines.push("", `Checked ${result.checkedAt}${result.stale ? " (cached Packagist data)" : ""} with ${base}/composer`);
  return lines.join("\n");
}

const SYMFONY_STATE = { active: "Supported", security: "Security fixes only", eol: "End of life", unknown: "Unknown" } as const;

/** Symfony report as Markdown. Advisory rows come from Packagist only. */
export function symfonyReportMarkdown(r: SymfonyCheck, siteUrl: string): string {
  const base = siteUrl.replace(/\/$/, "");
  const findings = r.advisories?.findings ?? [];
  const lines = [
    `## Symfony ${r.version} security check`,
    "",
    `- **Support (symfony.com):** ${SYMFONY_STATE[r.support.state]}${r.branchInfo?.isLts ? " (LTS branch)" : ""}`,
    `- **Latest ${r.branch} patch:** ${r.latestPatch ?? "Unavailable"}${r.patchBehind ? " (you are behind)" : ""}`,
    `- **Packagist advisories for symfony/symfony ${r.version}:** ${r.advisories ? findings.length : "Unavailable"}`,
    "",
  ];
  if (findings.length > 0) {
    lines.push("| Advisory | Severity | Affected |", "| --- | --- | --- |");
    for (const f of findings) {
      const label = f.cve ?? f.advisoryId;
      const href = f.cveUrl ?? f.link;
      lines.push(`| ${href ? `[${mdCell(label)}](${href})` : mdCell(label)} | ${mdCell(f.severity)} | ${mdCell(f.affectedVersions)} |`);
    }
    lines.push("", "```sh", r.upgradeCommand, "```", "");
  }
  lines.push(`Full report: ${base}/symfony/check/${r.version}`);
  return lines.join("\n");
}
