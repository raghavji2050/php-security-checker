/**
 * Extension names that appear in the php-src `ext/` tree for current PHP 8 releases.
 * Names only, from the PHP manual extension index (https://www.php.net/manual/en/extensions.alphabetical.php).
 * This is not a vulnerability list and a custom build may omit any of them.
 * imap moved to PECL in PHP 8.4 and is tracked separately.
 */
export const BUNDLED_EXTENSIONS = [
  "bcmath", "bz2", "calendar", "ctype", "curl", "date", "dba", "dom", "enchant", "exif", "ffi", "fileinfo",
  "filter", "ftp", "gd", "gettext", "gmp", "hash", "iconv", "intl", "json", "ldap", "libxml", "mbstring",
  "mysqli", "mysqlnd", "oci8", "odbc", "opcache", "openssl", "pcntl", "pcre", "pdo", "pdo_dblib", "pdo_firebird",
  "pdo_mysql", "pdo_oci", "pdo_odbc", "pdo_pgsql", "pdo_sqlite", "pgsql", "phar", "posix", "random", "readline",
  "reflection", "session", "shmop", "simplexml", "snmp", "soap", "sockets", "sodium", "spl", "sqlite3", "standard",
  "sysvmsg", "sysvsem", "sysvshm", "tidy", "tokenizer", "xml", "xmlreader", "xmlwriter", "xsl", "zip", "zlib",
] as const;

export const MOVED_TO_PECL = ["imap"] as const;

export const SAPI_MODULES = ["apache2handler", "cgi-fcgi", "cli", "embed", "fpm-fcgi", "isapi", "litespeed", "phpdbg"] as const;

const BUNDLED = new Set<string>(BUNDLED_EXTENSIONS);
const PECL = new Set<string>(MOVED_TO_PECL);
const SAPIS = new Set<string>(SAPI_MODULES);

export const OUTDATED_NOT_ASSESSED =
  "Not assessed. This tool has no official feed of current extension versions, so it will not call an extension outdated or current.";

export type ExtensionKind = "bundled" | "moved_to_pecl" | "sapi" | "not_in_php_src_list";

export type ExtensionVerdict = "confirmed" | "potential" | "not_reported_for_version" | "version_not_checked";

export type ExtensionMention = {
  id: string;
  severity: string | null;
  verdict: ExtensionVerdict;
};

export type ExtensionStatus =
  | "confirmed_on_entered_version"
  | "potential_on_entered_version"
  | "mentioned_not_reported_for_version"
  | "mentioned_version_not_checked"
  | "no_matching_text";

export type ExtensionAssessment = {
  name: string;
  kind: ExtensionKind;
  outdated: null;
  outdatedReason: string;
  status: ExtensionStatus;
  mentions: ExtensionMention[];
  mentionCount: number;
};

export type MentionSource = {
  id: string;
  description: string;
  severity: string | null;
};

const ALIASES: Record<string, RegExp[]> = {
  curl: [/\blibcurl\b/i, /\bext\/curl\b/i, /\bcurl extension\b/i],
  openssl: [/\bopenssl\b/i, /\bext\/openssl\b/i],
  phar: [/\bphar\b/i],
  gd: [/\bext\/gd\b/i, /\bgd extension\b/i, /\blibgd\b/i],
  sodium: [/\blibsodium\b/i, /\bext\/sodium\b/i, /\bsodium extension\b/i],
  mbstring: [/\bmbstring\b/i],
  libxml: [/\blibxml2?\b/i, /\bext\/libxml\b/i],
  simplexml: [/\bsimplexml\b/i, /\bext\/simplexml\b/i],
  dom: [/\bext\/dom\b/i, /\bdom extension\b/i],
  xml: [/\bext\/xml\b/i, /\bext\/libxml\b/i, /\blibxml2?\b/i],
  zip: [/\bext\/zip\b/i, /\bzip extension\b/i, /\blibzip\b/i],
  intl: [/\bext\/intl\b/i, /\bintl extension\b/i],
  exif: [/\bext\/exif\b/i, /\bexif extension\b/i],
  soap: [/\bext\/soap\b/i, /\bsoap extension\b/i],
  ftp: [/\bext\/ftp\b/i, /\bftp extension\b/i],
  fileinfo: [/\bext\/fileinfo\b/i, /\bfileinfo\b/i],
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function normalizeExtensionName(raw: string): string | null {
  const trimmed = raw.trim().toLowerCase().replace(/^zend\s+/, "");
  if (trimmed === "opcache" || trimmed === "optimizer+" || trimmed === "optimizer") return "opcache";
  if (!/^[a-z0-9_]{2,40}$/.test(trimmed)) return null;
  return trimmed;
}

export function extensionKind(name: string): ExtensionKind {
  if (SAPIS.has(name)) return "sapi";
  if (BUNDLED.has(name)) return "bundled";
  if (PECL.has(name)) return "moved_to_pecl";
  return "not_in_php_src_list";
}

/** Conservative phrase match against an official description. Short generic names are not bare words. */
export function mentionsExtension(description: string, name: string): boolean {
  const patterns = ALIASES[name] ?? [
    new RegExp(`\\bext/${escapeRegExp(name)}\\b`, "i"),
    new RegExp(`\\b${escapeRegExp(name)} extension\\b`, "i"),
    new RegExp(`\\bphp_${escapeRegExp(name)}\\b`, "i"),
  ];
  return patterns.some((pattern) => pattern.test(description));
}

export function parsePhpModules(text: string): { ok: true; names: string[] } | { ok: false; error: string } {
  if (typeof text !== "string" || text.trim() === "") return { ok: false, error: "Paste the output of php -m." };
  if (text.length > 64 * 1024) return { ok: false, error: "That paste is too large." };
  if (text.includes("<?php") || text.includes("\0")) return { ok: false, error: "Paste php -m output, not PHP source." };
  const names: string[] = [];
  const seen = new Set<string>();
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("[") || trimmed.startsWith(";")) continue;
    const name = normalizeExtensionName(trimmed.split(/\s+=>/)[0] ?? "");
    if (!name || seen.has(name)) continue;
    seen.add(name);
    names.push(name);
    if (names.length > 80) return { ok: false, error: "Too many module names (max 80)." };
  }
  if (names.length === 0) return { ok: false, error: "No module names found." };
  return { ok: true, names };
}

export function assessExtensions(
  names: string[],
  records: MentionSource[],
  verdicts: Map<string, "confirmed" | "potential"> | null,
): ExtensionAssessment[] {
  return names.map((name) => {
    const matched = records.filter((record) => mentionsExtension(record.description, name));
    const mentions: ExtensionMention[] = matched.slice(0, 5).map((record) => {
      const verdict = verdicts?.get(record.id);
      let label: ExtensionVerdict = "version_not_checked";
      if (verdicts) label = verdict ?? "not_reported_for_version";
      return { id: record.id, severity: record.severity, verdict: label };
    });
    let status: ExtensionStatus = "no_matching_text";
    if (mentions.some((item) => item.verdict === "confirmed")) status = "confirmed_on_entered_version";
    else if (mentions.some((item) => item.verdict === "potential")) status = "potential_on_entered_version";
    else if (mentions.some((item) => item.verdict === "not_reported_for_version")) status = "mentioned_not_reported_for_version";
    else if (mentions.length > 0) status = "mentioned_version_not_checked";
    return {
      name,
      kind: extensionKind(name),
      outdated: null,
      outdatedReason: OUTDATED_NOT_ASSESSED,
      status,
      mentions,
      mentionCount: matched.length,
    };
  });
}
