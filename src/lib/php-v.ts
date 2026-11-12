/**
 * Parser for pasted `php -v` output. Pure and browser-safe: the text never leaves the page.
 * Distro hints only describe the package suffix; they never claim a backport exists.
 */
import { parsePhpVersion } from "@/lib/version";

export type PhpVParse = {
  version: string;
  /** Everything after MAJOR.MINOR.PATCH in the version token, e.g. "-1ubuntu2.20". */
  suffix: string | null;
  /** Pre-release tag when the build is not a stable release (RC1, beta2, alpha1, dev). */
  preRelease: string | null;
  distro: string | null;
  sapi: string | null;
  threadSafety: "ZTS" | "NTS" | null;
  built: string | null;
  zendEngine: string | null;
  opcache: boolean;
  xdebug: boolean;
};

export type PhpVResult = { ok: true; value: PhpVParse } | { ok: false; error: string };

const HEAD = /PHP\s+(\d{1,2}\.\d{1,2}\.\d{1,3})([^\s(]*)\s*(?:\(([^)]*)\))?([^\n]*)/;

export function distroOf(suffix: string | null): string | null {
  if (!suffix) return null;
  const s = suffix.toLowerCase();
  if (s.includes("deb.sury.org")) return "Ondřej Surý packages (deb.sury.org)";
  if (s.includes("ubuntu")) return "Ubuntu";
  if (/(^|[^a-z])deb\d+|~deb|debian/.test(s)) return "Debian";
  if (/\.el\d|el\d+_?\d*/.test(s)) return "RHEL family (RHEL, AlmaLinux, Rocky)";
  if (s.includes("amzn")) return "Amazon Linux";
  if (/\.fc\d+/.test(s)) return "Fedora";
  if (/-r\d+$/.test(s)) return "Alpine";
  return null;
}

export function parsePhpV(input: string): PhpVResult {
  const text = input.slice(0, 5000);
  const m = HEAD.exec(text);
  if (!m) return { ok: false, error: "No \"PHP x.y.z\" line found. Paste the full output of php -v." };
  const parsed = parsePhpVersion(m[1]);
  if (!parsed) return { ok: false, error: `"${m[1]}" is not a MAJOR.MINOR.PATCH version.` };
  const rawSuffix = m[2] || "";
  const pre = /^-?(RC\d*|alpha\d*|beta\d*|dev)/i.exec(rawSuffix);
  const rest = `${m[3] ?? ""} ${m[4] ?? ""} ${text}`;
  const built = /\(built:\s*([^)]+?)\s*\)/i.exec(text)?.[1]?.replace(/\s+/g, " ") ?? null;
  const ts = /\bZTS\b/.test(rest) ? "ZTS" : /\bNTS\b/.test(rest) ? "NTS" : null;
  const sapi = m[3] && !/^built:/i.test(m[3]) ? m[3].trim() : null;
  return {
    ok: true,
    value: {
      version: parsed.raw,
      suffix: rawSuffix || null,
      preRelease: pre ? pre[1] : null,
      distro: distroOf(rawSuffix || null),
      sapi,
      threadSafety: ts,
      built,
      zendEngine: /Zend Engine v([\d.]+)/i.exec(text)?.[1] ?? null,
      opcache: /Zend OPcache/i.test(text),
      xdebug: /Xdebug/i.test(text),
    },
  };
}
