import { compareBranches, compareVersions, parsePhpVersion, versionBranch } from "@/lib/version";
import { supportLabel } from "@/lib/lifecycle";
import type { Finding, PhpBranch } from "@/lib/types";

export type UpgradeAdvice = {
  minimumFixedVersion: string | null;
  minimumFixedStatus: "verified" | "not_verified" | "unavailable";
  minimumFixedNote: string;
  recommendedVersion: string | null;
  recommendedNote: string;
  compatibilityNotes: string[];
};

export function chooseRecommendedBranch(branches: PhpBranch[]): PhpBranch | null {
  const supported = branches.filter((branch) => branch.state === "active" || branch.state === "security");
  const active = supported.filter((branch) => branch.state === "active");
  const pool = active.length > 0 ? active : supported;
  return (
    [...pool].sort((a, b) => compareBranches(b.branch, a.branch)).find((branch) => branch.latestPatch) ??
    null
  );
}

export function buildUpgradeAdvice(
  versionRaw: string,
  userBranch: PhpBranch | null,
  branches: PhpBranch[],
  confirmed: Finding[],
): UpgradeAdvice {
  const recommended = chooseRecommendedBranch(branches);
  const recommendedVersion = recommended?.latestPatch ?? null;
  const compatibilityNotes = compatibilityCopy(versionRaw, userBranch, recommended, branches);

  if (!userBranch) {
    return {
      minimumFixedVersion: null,
      minimumFixedStatus: "unavailable",
      minimumFixedNote:
        "This version is not on a branch published by php.net, so a same-branch security fix cannot be verified.",
      recommendedVersion,
      recommendedNote: recommendedVersion
        ? `${recommendedVersion} is the newest patched release on a branch php.net still supports (${recommended?.branch}, ${supportLabel(recommended!.state).toLowerCase()}). It is the long-term target. No release is claimed to be vulnerability-free.`
        : "No supported PHP release could be read from php.net, so a long-term upgrade target is not verified.",
      compatibilityNotes,
    };
  }

  const verifiedFixes = confirmed
    .filter((finding) => finding.fixedVersion && finding.fixedVersionStatus === "verified")
    .map((finding) => finding.fixedVersion as string);
  const missingFix = confirmed.some((finding) => finding.fixedVersionStatus !== "verified" || !finding.fixedVersion);
  let minimumFixedVersion: string | null = null;
  let minimumFixedStatus: UpgradeAdvice["minimumFixedStatus"] = "unavailable";
  let minimumFixedNote: string;

  if (confirmed.length === 0) {
    minimumFixedNote =
      "No confirmed issue in this dataset names a patch you still need on this branch. That is not a claim the branch is free of vulnerabilities.";
  } else if (missingFix || verifiedFixes.length !== confirmed.length) {
    minimumFixedStatus = "not_verified";
    minimumFixedNote =
      "At least one confirmed issue does not have a single verified fixed release on this branch. The minimum security fix is not verified. Use the advisory links instead of assuming a patch level.";
  } else {
    minimumFixedVersion = verifiedFixes.reduce((highest, candidate) => {
      const left = parsePhpVersion(highest);
      const right = parsePhpVersion(candidate);
      if (!left || !right) return highest;
      return compareVersions(right, left) > 0 ? candidate : highest;
    });
    const parsedMinimum = parsePhpVersion(minimumFixedVersion);
    const parsedUser = parsePhpVersion(versionRaw);
    if (parsedMinimum && parsedUser && compareVersions(parsedUser, parsedMinimum) >= 0) {
      minimumFixedVersion = null;
      minimumFixedNote = "The verified fixes for these confirmed issues are already included in the version you entered.";
      minimumFixedStatus = "verified";
    } else {
      minimumFixedStatus = "verified";
      const eolNote =
        userBranch.state === "eol"
          ? ` PHP ${userBranch.branch} is end of life, so ${minimumFixedVersion} is only the newest verified fix on that unsupported branch. It is not a recommended long-term target.`
          : ` Staying on ${userBranch.branch} means you still need to plan for the end of support on ${userBranch.securitySupportEnd ?? "the published security date"}.`;
      minimumFixedNote = `${minimumFixedVersion} is the lowest release on PHP ${userBranch.branch} that contains every verified fix for the confirmed issues in this result.${eolNote}`;
    }
  }

  const recommendedNote = recommendedVersion
    ? `${recommendedVersion} is the latest patch on PHP ${recommended?.branch}, which php.net lists as ${supportLabel(recommended!.state).toLowerCase()}. It is the long-term upgrade, chosen because the branch is still supported. This check does not claim that release is vulnerability-free.`
    : "A supported long-term release could not be verified from php.net data.";

  return {
    minimumFixedVersion,
    minimumFixedStatus,
    minimumFixedNote,
    recommendedVersion,
    recommendedNote,
    compatibilityNotes,
  };
}

function compatibilityCopy(
  versionRaw: string,
  userBranch: PhpBranch | null,
  recommended: PhpBranch | null,
  branches: PhpBranch[],
): string[] {
  const notes = [
    "No PHP release should be treated as vulnerability-free. New issues are published after this dataset was synced, and some bugs depend on how PHP is installed.",
  ];
  if (!userBranch) {
    notes.push("The branch could not be matched to php.net's supported-versions or end-of-life lists.");
    return notes;
  }
  if (userBranch.state === "eol") {
    notes.push(
      `PHP ${userBranch.branch} no longer receives upstream fixes. Running its last patch still leaves the installation unsupported.`,
    );
  } else if (userBranch.state === "security") {
    notes.push(
      `PHP ${userBranch.branch} receives security fixes only until ${userBranch.securitySupportEnd ?? "the published end date"}. Bugfix releases have stopped.`,
    );
  }
  if (recommended && recommended.branch !== userBranch.branch) {
    const guides = migrationGuides(userBranch.branch, recommended.branch, branches);
    notes.push(
      `Moving from ${userBranch.branch} to ${recommended.branch} can change language behavior, removed extensions, and default settings. Review each migration guide before upgrading: ${guides.join(", ")}.`,
    );
  } else if (recommended && recommended.latestPatch === versionRaw) {
    notes.push("The version you entered is the newest patched release on the newest supported branch in this dataset.");
  }
  return notes;
}

function migrationGuides(fromBranch: string, toBranch: string, branches: PhpBranch[]): string[] {
  const [start, end] = [fromBranch, toBranch].sort(compareBranches);
  const between = branches
    .map((branch) => branch.branch)
    .filter((branch) => compareBranches(branch, start) > 0 && compareBranches(branch, end) <= 0)
    .sort(compareBranches);
  const targets = between.length > 0 ? between : [toBranch];
  return targets.map((branch) => `https://www.php.net/manual/en/migration${branch.replace(".", "")}.php`);
}

export function userBranchOf(versionRaw: string, branches: PhpBranch[]): PhpBranch | null {
  const parsed = parsePhpVersion(versionRaw);
  if (!parsed) return null;
  return branches.find((branch) => branch.branch === versionBranch(parsed)) ?? null;
}
