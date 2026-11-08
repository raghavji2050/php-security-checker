import { parsePhpVersion } from "@/lib/version";

export const DISTRO_BACKPORT_NOTE =
  "If this PHP build comes from a Linux distribution (Debian, Ubuntu, RHEL, Alpine, and others), the package may include backported security fixes that do not change the MAJOR.MINOR.PATCH string. This check cannot see those patches. A match is not proof the distro package is still vulnerable, and a clean result is not proof every fix was included. Check the distribution's own security tracker for the package you installed.";

export type UpgradeCommand = {
  id: string;
  title: string;
  command: string;
  note: string;
};

function branchOf(version: string | null): string | null {
  if (!version) return null;
  const parsed = parsePhpVersion(version);
  return parsed ? `${parsed.major}.${parsed.minor}` : null;
}

/** Copy-paste examples derived from versions the report already named. These do not claim a CVE is fixed. */
export function upgradeCommands(input: {
  recommended: string | null;
  minimumFixed: string | null;
  branchLatest: string | null;
}): UpgradeCommand[] {
  const target = input.recommended ?? input.branchLatest ?? input.minimumFixed;
  const branch = branchOf(target);
  const commands: UpgradeCommand[] = [
    {
      id: "verify",
      title: "Confirm the installed version",
      command: "php -v",
      note: "Read the MAJOR.MINOR.PATCH line. This site never runs that command for you.",
    },
  ];

  if (input.minimumFixed && input.minimumFixed !== input.recommended) {
    commands.push({
      id: "minimum",
      title: "Minimum verified fix on the current branch",
      command: `# Report named ${input.minimumFixed} as a verified fix on this branch.\n# Install that release from php.net or your platform, then run php -v.`,
      note: "A same-branch patch is not a long-term target when the branch is out of support. No package version was invented for your distro.",
    });
  }

  if (branch && target) {
    commands.push({
      id: "homebrew",
      title: "Homebrew (macOS or Linux)",
      command: `brew install php@${branch}\nphp -v`,
      note: `Installs the php@${branch} formula. Homebrew does not pin the patch ${target}. Confirm php -v after install.`,
    });
    commands.push({
      id: "docker",
      title: "Docker official PHP image",
      command: `FROM php:${target}-fpm-bookworm\n# Rebuild the image after you change the tag.`,
      note: `Example pin for the recommended patch ${target}. Confirm the tag exists in the official php image before you deploy. A floating tag such as php:${branch}-fpm is not a patch pin. See the Docker tool for the library's current mapping.`,
    });
    commands.push({
      id: "apt",
      title: "Debian or Ubuntu via the ondrej/php PPA",
      command: `sudo add-apt-repository ppa:ondrej/php\nsudo apt update\nsudo apt install php${branch}`,
      note: "ondrej/php is a community archive, not a php.net or Debian project. Review it before you use it. Distro packages can lag or carry backports this checker cannot see.",
    });
    commands.push({
      id: "composer-platform",
      title: "Composer platform (does not upgrade PHP)",
      command: `composer config platform.php ${target}`,
      note: "This only tells Composer which PHP version to resolve dependencies for. It does not change the runtime and does not fix vulnerabilities.",
    });
  }

  return commands;
}
