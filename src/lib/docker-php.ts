import { compareVersions, parsePhpVersion } from "@/lib/version";

export const DOCKER_LIBRARY_URL = "https://raw.githubusercontent.com/docker-library/php/master/versions.json";
export const DOCKER_LIBRARY_DOC = "https://github.com/docker-library/php/blob/master/versions.json";

export type LibraryBranch = {
  branch: string;
  version: string | null;
  versionRaw: string;
  variants: string[];
};

export type ParsedPhpImage = {
  input: string;
  officialPhp: boolean;
  tag: string | null;
  digest: boolean;
  phpVersion: string | null;
  phpBranch: string | null;
  majorOnly: boolean;
  prerelease: boolean;
  floating: boolean;
  variant: string | null;
};

export type DockerLevel = "review" | "info";

export type DockerFinding = {
  id: string;
  level: DockerLevel;
  line: number | null;
  title: string;
  detail: string;
};

export function parseDockerLibraryPhp(json: unknown): LibraryBranch[] {
  if (!json || typeof json !== "object") return [];
  const branches: LibraryBranch[] = [];
  for (const [key, value] of Object.entries(json)) {
    if (!value || typeof value !== "object" || key.endsWith("-rc")) continue;
    const record = value as { version?: unknown; variants?: unknown };
    const versionRaw = typeof record.version === "string" ? record.version : "";
    const parsed = parsePhpVersion(versionRaw);
    if (!parsed && !/^\d+\.\d+$/.test(key)) continue;
    const variants = Array.isArray(record.variants) ? record.variants.filter((item): item is string => typeof item === "string") : [];
    branches.push({
      branch: parsed ? `${parsed.major}.${parsed.minor}` : key,
      version: parsed?.raw ?? null,
      versionRaw,
      variants,
    });
  }
  return branches.sort((a, b) => a.branch.localeCompare(b.branch, undefined, { numeric: true }));
}

const IMAGE_RE = /^(?:(?:[\w.-]+(?::\d+)?\/)?(?:library\/)?)?php(?::([^@\s]+))?(?:@(sha256:[a-f0-9]{64}))?$/i;

export function parsePhpImageRef(input: string): ParsedPhpImage | { ok: false; reason: string } {
  const raw = input.trim();
  if (!raw || raw.length > 300) return { ok: false, reason: "Enter an image reference such as php:8.3-fpm or php:8.3.26-fpm-bookworm." };
  const match = IMAGE_RE.exec(raw);
  if (!match) {
    return {
      input: raw,
      officialPhp: false,
      tag: null,
      digest: raw.includes("@sha256:"),
      phpVersion: null,
      phpBranch: null,
      majorOnly: false,
      prerelease: false,
      floating: false,
      variant: null,
    };
  }
  const tag = match[1] ?? null;
  const digest = Boolean(match[2]);
  if (!tag || tag === "latest") {
    return { input: raw, officialPhp: true, tag, digest, phpVersion: null, phpBranch: null, majorOnly: false, prerelease: false, floating: true, variant: null };
  }
  const prerelease = /^(\d+\.\d+\.\d+)(?:[-.]?(?:RC|alpha|beta|dev)\d*)(?:-([\w.-]+))?$/i.exec(tag);
  if (prerelease) {
    return {
      input: raw,
      officialPhp: true,
      tag,
      digest,
      phpVersion: null,
      phpBranch: null,
      majorOnly: false,
      prerelease: true,
      floating: true,
      variant: prerelease[2] ?? null,
    };
  }
  const full = /^(\d+\.\d+\.\d+)(?:-([\w.-]+))?$/.exec(tag);
  if (full) {
    const version = parsePhpVersion(full[1]);
    return {
      input: raw,
      officialPhp: true,
      tag,
      digest,
      phpVersion: version?.raw ?? null,
      phpBranch: version ? `${version.major}.${version.minor}` : null,
      majorOnly: false,
      prerelease: false,
      floating: false,
      variant: full[2] ?? null,
    };
  }
  const branch = /^(\d+\.\d+)(?:-([\w.-]+))?$/.exec(tag);
  if (branch) {
    return {
      input: raw,
      officialPhp: true,
      tag,
      digest,
      phpVersion: null,
      phpBranch: branch[1],
      majorOnly: false,
      prerelease: false,
      floating: true,
      variant: branch[2] ?? null,
    };
  }
  const major = /^(\d+)(?:-([\w.-]+))?$/.exec(tag);
  if (major) {
    return {
      input: raw,
      officialPhp: true,
      tag,
      digest,
      phpVersion: null,
      phpBranch: null,
      majorOnly: true,
      prerelease: false,
      floating: true,
      variant: major[2] ?? null,
    };
  }
  return { input: raw, officialPhp: true, tag, digest, phpVersion: null, phpBranch: null, majorOnly: false, prerelease: false, floating: true, variant: tag };
}

export function libraryBranchFor(branches: LibraryBranch[], phpBranch: string | null): LibraryBranch | null {
  if (!phpBranch) return null;
  return branches.find((branch) => branch.branch === phpBranch) ?? null;
}

export function compareTagToLibrary(parsed: ParsedPhpImage, branches: LibraryBranch[]): string {
  if (!parsed.officialPhp) return "This reference is not the official php image (php or library/php). The library file is not applied to it.";
  if (parsed.prerelease) return "The tag looks like a pre-release. It is not compared to a stable patch.";
  if (parsed.digest && !parsed.tag) return "A digest does not name a PHP version. This tool does not pull the image.";
  if (parsed.majorOnly || (parsed.floating && !parsed.phpBranch)) {
    return "php:latest and major-only tags move. versions.json does not define one patch for them. Pick a MAJOR.MINOR or a full patch tag.";
  }
  const library = libraryBranchFor(branches, parsed.phpBranch);
  if (!library?.version) return `No stable patch for ${parsed.phpBranch ?? "this tag"} was listed in the docker-library versions.json that was read.`;
  if (parsed.floating) {
    return `Floating tag. docker-library/php versions.json currently maps ${parsed.phpBranch} to ${library.version}. A later rebuild can change what the tag installs. Pin a patch tag to make a version check reproducible.`;
  }
  if (!parsed.phpVersion) return "The tag did not include a patch this checker could read.";
  const left = parsePhpVersion(parsed.phpVersion);
  const right = parsePhpVersion(library.version);
  if (!left || !right) return "The versions could not be compared.";
  const order = compareVersions(left, right);
  if (order === 0) return `The tag's patch matches ${library.version}, which versions.json currently lists for PHP ${library.branch}.`;
  if (order < 0) {
    return `versions.json currently lists PHP ${library.branch} as ${library.version}. This tag names ${parsed.phpVersion}, which is older than that library patch. That is a base-image note, not a CVE finding.`;
  }
  return `This tag names ${parsed.phpVersion}, which is newer than ${library.version} currently listed for PHP ${library.branch}. The library file may be behind, or the tag may not have been published. The registry was not contacted.`;
}

export function secureDockerfileExample(patch: string | null): string {
  const tag = patch ? `php:${patch}-fpm-bookworm` : "php:<patch>-fpm-bookworm";
  return [`FROM ${tag}`, "# Pin a patch tag from the official php image. Rebuild when you move to a newer patch.", "# Use a non-root user when the application allows it. Port 80 binding may still need root or a capability.", "USER www-data"].join("\n");
}

const FROM_RE = /^\s*FROM\s+(?:--platform=\S+\s+)?(?:"([^"]+)"|'([^']+)'|(\S+))(?:\s+[Aa][Ss]\s+(\S+))?\s*(?:#.*)?$/;
const USER_RE = /^\s*USER\s+(\S+)/i;
const COPY_RE = /^\s*(COPY|ADD)\s+(.+)$/i;

export function analyzeDockerfile(text: string): { ok: true; images: ParsedPhpImage[]; findings: DockerFinding[] } | { ok: false; error: string } {
  if (typeof text !== "string" || text.trim() === "") return { ok: false, error: "Paste a Dockerfile." };
  if (text.length > 200 * 1024) return { ok: false, error: "Dockerfile is too large (max 200 KB)." };
  const lines = text.split(/\r?\n/).slice(0, 2000);
  const images: ParsedPhpImage[] = [];
  const findings: DockerFinding[] = [];
  let stage = 0;
  let stageUser: string | null = null;
  let stageLine = 0;
  let sawFrom = false;

  const closeStage = () => {
    if (!sawFrom) return;
    if (!stageUser || stageUser === "root" || stageUser === "0") {
      findings.push({
        id: `user-${stage}`,
        level: "review",
        line: stageLine,
        title: "Stage may run as root",
        detail: stageUser
          ? `USER ${stageUser} keeps this stage as root. Official php images default to root. Use USER www-data when the app does not need to bind a privileged port or write outside its directory.`
          : "No USER instruction was seen in this stage. The official php image defaults to root. That is normal for a build stage and worth changing in the final stage when the app can run as www-data.",
      });
    }
  };

  lines.forEach((line, index) => {
    const lineNo = index + 1;
    const from = FROM_RE.exec(line);
    if (from) {
      closeStage();
      sawFrom = true;
      stage += 1;
      stageLine = lineNo;
      stageUser = null;
      const image = from[1] || from[2] || from[3] || "";
      const parsed = parsePhpImageRef(image);
      if ("ok" in parsed) return;
      images.push(parsed);
      if (!parsed.officialPhp) {
        findings.push({ id: `from-${lineNo}`, level: "info", line: lineNo, title: "Base image is not official php", detail: `${image} is not interpreted as the official php image. This tool does not scan image contents.` });
      } else if (parsed.floating) {
        findings.push({ id: `from-${lineNo}`, level: "review", line: lineNo, title: "PHP tag is not pinned to a patch", detail: `${image} can move when the library rebuilds. Pin MAJOR.MINOR.PATCH if you want a reproducible version check.` });
      } else if (parsed.phpVersion) {
        findings.push({ id: `from-${lineNo}`, level: "info", line: lineNo, title: "Patch tag found", detail: `${image} names PHP ${parsed.phpVersion}. Check that version on /check/${parsed.phpVersion}. Image contents were not scanned.` });
      }
      return;
    }
    const user = USER_RE.exec(line);
    if (user) stageUser = user[1];
    const copy = COPY_RE.exec(line);
    if (copy) {
      const args = copy[2];
      if (/(^|\s)(\.env\b|id_rsa\b|[^/\s]+\.(pem|key))(\s|$)/i.test(args)) {
        findings.push({ id: `secret-${lineNo}`, level: "review", line: lineNo, title: "Possible secret copied into the image", detail: "A COPY or ADD argument looks like .env, a private key, or a certificate key. Secrets in image layers stay in the history. Mount them at runtime instead." });
      }
      if (/^ADD\s+/i.test(line) && /https?:\/\//i.test(args)) {
        findings.push({ id: `add-url-${lineNo}`, level: "info", line: lineNo, title: "ADD fetches a remote URL", detail: "Remote ADD downloads a file at build time. Prefer a pinned COPY of a file you verified, or a checksum." });
      }
    }
  });
  closeStage();
  if (!sawFrom) return { ok: false, error: "No FROM instruction found." };
  return { ok: true, images, findings };
}

