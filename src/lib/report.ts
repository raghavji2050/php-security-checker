import type { CheckResult } from "@/lib/types";
import { DISTRO_BACKPORT_NOTE, upgradeCommands } from "@/lib/upgrade-commands";

export const REPORT_NOTE =
  "This is a version-based check of published PHP runtime records. It is not a full application audit. Extensions, configuration, application code, and the SAPI can change the real risk.";

/** JSON download envelope. GET /api/check stays the raw check result. */
export function buildVersionReport(result: CheckResult, now = new Date()) {
  return {
    reportType: "php-version-check" as const,
    generator: "PHP Security Checker",
    generatedAt: now.toISOString(),
    note: REPORT_NOTE,
    distroBackportNote: DISTRO_BACKPORT_NOTE,
    version: result.version,
    securityStatus: result.securityStatus,
    securityStatusLabel: result.securityStatusLabel,
    counts: result.counts,
    minimumFixedVersion: result.minimumFixedVersion,
    recommendedVersion: result.recommendedVersion,
    upgradeCommands: upgradeCommands({
      recommended: result.recommendedVersion,
      minimumFixed: result.minimumFixedVersion,
      branchLatest: result.support.latestPatch,
    }),
    sources: result.sources,
    disclaimer: result.disclaimer,
    result,
  };
}
