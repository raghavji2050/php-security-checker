/** Shared composer scanner types (safe for client components). */

export type AffectedFinding = {
  packageName: string;
  installedVersion: string;
  isDev: boolean | null;
  advisoryId: string;
  title: string;
  link: string | null;
  cve: string | null;
  cveUrl: string | null;
  severity: string | null;
  affectedVersions: string;
  suggestedFixedVersions: string[];
  reportedAt: string | null;
  updateCommand: string;
};

export type ComposerAuditResult = {
  checkedAt: string;
  packageCount: number;
  affectedCount: number;
  advisoryCount: number;
  findings: AffectedFinding[];
  updateCommands: string[];
  stale: boolean;
  source: "packagist";
};
