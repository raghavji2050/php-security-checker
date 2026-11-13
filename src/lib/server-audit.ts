/**
 * Server audit summary: combines the version check, php.ini audit and extension check
 * into one client-ready report. Pure helpers only; the page fetches data from our own APIs.
 */
import type { ExtensionAssessment } from "@/lib/extension-check";
import type { IniFinding } from "@/lib/ini-audit";
import { parsePhpV } from "@/lib/php-v";
import type { SecurityStatus, SupportState } from "@/lib/types";
import { parsePhpVersion } from "@/lib/version";

export type AuditVersionInput =
  | { ok: true; version: string; suffix: string | null; distro: string | null; xdebug: boolean }
  | { ok: false; error: string };

/** Accepts either full `php -v` output or a plain MAJOR.MINOR.PATCH version. */
export function readAuditVersion(input: string): AuditVersionInput {
  const text = (input ?? "").trim();
  if (!text) return { ok: false, error: "Enter a PHP version or paste php -v output." };
  const plain = text.length <= 32 ? parsePhpVersion(text) : null;
  if (plain) return { ok: true, version: plain.raw, suffix: null, distro: null, xdebug: false };
  const parsed = parsePhpV(text);
  if (!parsed.ok) return { ok: false, error: "Use MAJOR.MINOR.PATCH (for example 8.3.12) or paste the full php -v output." };
  return {
    ok: true,
    version: parsed.value.version,
    suffix: parsed.value.suffix,
    distro: parsed.value.distro,
    xdebug: parsed.value.xdebug,
  };
}

export type AuditVersionPart = {
  version: string;
  securityStatus: SecurityStatus;
  supportState: SupportState;
  supportLabel: string;
  confirmed: number;
  potential: number;
  critical: number;
  high: number;
  recommendedVersion: string | null;
  distro: string | null;
  xdebug: boolean;
};

export type AuditSummaryInput = {
  version: AuditVersionPart | null;
  ini: IniFinding[] | null;
  extensions: ExtensionAssessment[] | null;
};

export type AuditLevel = "action" | "review" | "ok" | "incomplete";

export type AuditAction = { area: "version" | "php.ini" | "extensions"; level: "action" | "review"; text: string };

export type AuditSummary = {
  level: AuditLevel;
  headline: string;
  actions: AuditAction[];
  checked: string[];
  notChecked: string[];
};

/** Builds the overall verdict and prioritised action list. Only restates data already returned by the checks. */
export function summarizeAudit(input: AuditSummaryInput): AuditSummary {
  const actions: AuditAction[] = [];
  const checked: string[] = [];
  const notChecked: string[] = [];

  const v = input.version;
  if (v) {
    checked.push(`PHP ${v.version} version check`);
    const target = v.recommendedVersion ? ` Upgrade to PHP ${v.recommendedVersion}.` : "";
    if (v.supportState === "eol") {
      actions.push({ area: "version", level: "action", text: `PHP ${v.version} is end of life on php.net (${v.supportLabel}).${target}` });
    }
    if (v.confirmed > 0) {
      const sev = [v.critical ? `${v.critical} critical` : "", v.high ? `${v.high} high` : ""].filter(Boolean).join(", ");
      actions.push({
        area: "version",
        level: "action",
        text: `${v.confirmed} confirmed CVE${v.confirmed === 1 ? "" : "s"} affect PHP ${v.version}${sev ? ` (${sev})` : ""}.${target}`,
      });
    }
    if (v.potential > 0) {
      actions.push({
        area: "version",
        level: "review",
        text: `${v.potential} CVE${v.potential === 1 ? "" : "s"} need manual verification for PHP ${v.version}.`,
      });
    }
    if (v.securityStatus === "unable_to_verify") {
      actions.push({ area: "version", level: "review", text: "Vulnerability data could not be verified right now. Re-run the check later." });
    }
    if (v.distro && (v.confirmed > 0 || v.potential > 0)) {
      actions.push({
        area: "version",
        level: "review",
        text: `This is a ${v.distro} package. Check the vendor security tracker, because fixes may be backported without a version change.`,
      });
    }
    if (v.xdebug) actions.push({ area: "version", level: "review", text: "Xdebug is loaded. Remove it from production servers." });
  } else {
    notChecked.push("PHP version");
  }

  if (input.ini) {
    checked.push(`php.ini (${input.ini.length} directive finding${input.ini.length === 1 ? "" : "s"})`);
    for (const f of input.ini) {
      if (f.level === "high") actions.push({ area: "php.ini", level: "action", text: `${f.directive}: ${f.current} → ${f.recommended}` });
      else if (f.level === "review") actions.push({ area: "php.ini", level: "review", text: `${f.directive}: ${f.current} → ${f.recommended}` });
    }
  } else {
    notChecked.push("php.ini");
  }

  if (input.extensions) {
    checked.push(`${input.extensions.length} loaded module${input.extensions.length === 1 ? "" : "s"}`);
    for (const e of input.extensions) {
      if (e.status === "confirmed_on_entered_version") {
        actions.push({ area: "extensions", level: "action", text: `${e.name}: a confirmed CVE for this PHP version mentions this extension.` });
      } else if (e.status === "potential_on_entered_version") {
        actions.push({ area: "extensions", level: "review", text: `${e.name}: a CVE mentioning this extension needs verification.` });
      }
    }
  } else {
    notChecked.push("extensions");
  }

  actions.sort((a, b) => (a.level === b.level ? 0 : a.level === "action" ? -1 : 1));

  let level: AuditLevel;
  let headline: string;
  if (checked.length === 0) {
    level = "incomplete";
    headline = "Nothing checked yet.";
  } else if (actions.some((a) => a.level === "action")) {
    level = "action";
    headline = `${actions.filter((a) => a.level === "action").length} item(s) need action.`;
  } else if (actions.length > 0) {
    level = "review";
    headline = `${actions.length} item(s) to review.`;
  } else {
    level = "ok";
    headline = "No issues found in the parts that were checked.";
  }
  return { level, headline, actions, checked, notChecked };
}

/** Plain-text/Markdown export of the summary for tickets and emails. */
export function auditSummaryMarkdown(summary: AuditSummary, label: string | null, generatedAt: string): string {
  const lines = [`# PHP server audit summary${label ? `: ${label}` : ""}`, "", `Generated ${generatedAt} with php-security-checker.vercel.app`, "", `**${summary.headline}**`, ""];
  if (summary.actions.length) {
    lines.push("| Priority | Area | Finding |", "| --- | --- | --- |");
    for (const a of summary.actions) lines.push(`| ${a.level === "action" ? "Action" : "Review"} | ${a.area} | ${a.text.replace(/\|/g, "\\|")} |`);
    lines.push("");
  }
  lines.push(`Checked: ${summary.checked.join(", ") || "nothing"}`);
  if (summary.notChecked.length) lines.push(`Not checked: ${summary.notChecked.join(", ")}`);
  return lines.join("\n");
}
