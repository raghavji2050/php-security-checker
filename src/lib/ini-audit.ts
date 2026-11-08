export const MAX_INI_BYTES = 512 * 1024;

export type IniLevel = "high" | "review" | "ok" | "info";

export type IniFinding = {
  id: string;
  directive: string;
  level: IniLevel;
  current: string;
  recommended: string;
  risk: string;
  why: string;
  fix: string;
  example: string;
};

export type IniTarget = "production" | "development";

const SHELL_FUNCTIONS = ["exec", "shell_exec", "system", "passthru", "proc_open", "popen"];

export function parseIni(text: string): { ok: true; values: Record<string, string> } | { ok: false; error: string } {
  if (typeof text !== "string" || text.trim() === "") return { ok: false, error: "Paste a php.ini, or upload one." };
  if (text.length > MAX_INI_BYTES) return { ok: false, error: "File is too large (max 512 KB)." };
  if (text.includes("\0")) return { ok: false, error: "This file is not plain text." };
  if (text.includes("<?php")) return { ok: false, error: "This looks like PHP source. Paste ini directives only. Nothing is executed." };

  const values: Record<string, string> = {};
  for (const line of text.split(/\r?\n/).slice(0, 8000)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith(";") || trimmed.startsWith("#") || trimmed.startsWith("[")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim().toLowerCase();
    if (!/^[a-z0-9._-]+$/.test(key)) continue;
    values[key] = unquote(stripIniComment(trimmed.slice(eq + 1).trim()));
  }
  if (Object.keys(values).length === 0) {
    return { ok: false, error: "No key = value directives found." };
  }
  return { ok: true, values };
}

function stripIniComment(raw: string): string {
  if (raw.startsWith('"')) {
    const end = raw.indexOf('"', 1);
    return end === -1 ? raw : raw.slice(0, end + 1);
  }
  if (raw.startsWith("'")) {
    const end = raw.indexOf("'", 1);
    return end === -1 ? raw : raw.slice(0, end + 1);
  }
  const comment = raw.search(/\s[;#]/);
  return comment === -1 ? raw : raw.slice(0, comment).trim();
}

function unquote(raw: string): string {
  const value = raw.trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}

export function iniBool(value: string | undefined): boolean | null {
  if (value === undefined) return null;
  const normalized = value.trim().toLowerCase();
  if (["1", "on", "true", "yes"].includes(normalized)) return true;
  if (["0", "off", "false", "no", ""].includes(normalized)) return false;
  return null;
}

/** Bytes, or null when the token is not a plain PHP shorthand size. 0 stays 0 (unlimited for several directives). */
export function parseIniSize(value: string | undefined): number | null {
  if (value === undefined) return null;
  const match = /^(\d+)\s*([KMG])?$/i.exec(value.trim());
  if (!match) return null;
  const amount = Number(match[1]);
  const unit = (match[2] || "").toUpperCase();
  const multiplier = unit === "G" ? 1024 ** 3 : unit === "M" ? 1024 ** 2 : unit === "K" ? 1024 : 1;
  return amount * multiplier;
}

function shown(value: string | undefined): string {
  if (value === undefined) return "Not set in this file";
  if (value === "") return "Empty";
  return value;
}

function finding(partial: IniFinding): IniFinding {
  return partial;
}

/**
 * Audit pasted directives. Missing keys are "not set", not assumed to be the PHP default,
 * because php.ini-development and php.ini-production differ.
 */
export function auditIni(values: Record<string, string>, target: IniTarget = "production"): IniFinding[] {
  const get = (key: string) => values[key.toLowerCase()];
  const out: IniFinding[] = [];

  const display = iniBool(get("display_errors"));
  if (display === true && target === "production") {
    out.push(finding({
      id: "display_errors",
      directive: "display_errors",
      level: "high",
      current: shown(get("display_errors")),
      recommended: "Off for production",
      risk: "High for a production SAPI",
      why: "Errors shown to browsers can reveal paths, queries, and code. Development machines often want this on.",
      fix: "Set display_errors = Off and log_errors = On. Keep display on only for a local development file.",
      example: "display_errors = Off\nlog_errors = On",
    }));
  } else if (display === true) {
    out.push(finding({
      id: "display_errors",
      directive: "display_errors",
      level: "info",
      current: shown(get("display_errors")),
      recommended: "On is normal for development",
      risk: "Low while this file stays off production",
      why: "Showing errors locally helps debugging. Do not ship this file as the production configuration.",
      fix: "Use a separate production ini with display_errors = Off.",
      example: "display_errors = Off",
    }));
  } else if (display === false) {
    out.push(finding({
      id: "display_errors",
      directive: "display_errors",
      level: "ok",
      current: shown(get("display_errors")),
      recommended: "Off for production",
      risk: "No issue in this file",
      why: "Browsers are not sent PHP error text from this directive.",
      fix: "Keep log_errors enabled so failures are still recorded.",
      example: "log_errors = On",
    }));
  } else {
    out.push(finding({
      id: "display_errors",
      directive: "display_errors",
      level: "review",
      current: "Not set in this file",
      recommended: "Off for production",
      risk: "Depends on the ini template",
      why: "php.ini-development defaults this to On and php.ini-production to Off. This paste does not say which one is active.",
      fix: "Confirm with php -i | grep display_errors, then set Off on production.",
      example: "display_errors = Off",
    }));
  }

  const expose = iniBool(get("expose_php"));
  out.push(finding({
    id: "expose_php",
    directive: "expose_php",
    level: expose === false ? "ok" : "review",
    current: shown(get("expose_php")),
    recommended: "Off",
    risk: expose === false ? "No issue in this file" : "Low — version disclosure",
    why: "On adds an X-Powered-By header and can expose the PHP version. The PHP default is On. Hiding the header does not patch vulnerabilities.",
    fix: "Set expose_php = Off if you do not need the header.",
    example: "expose_php = Off",
  }));

  const allowInclude = iniBool(get("allow_url_include"));
  out.push(finding({
    id: "allow_url_include",
    directive: "allow_url_include",
    level: allowInclude === true ? "high" : allowInclude === false ? "ok" : "info",
    current: shown(get("allow_url_include")),
    recommended: "Off",
    risk: allowInclude === true ? "High — remote include" : "PHP's default is Off",
    why: "On lets include/require load remote URLs when an attacker controls the path. Very few applications need it.",
    fix: "Set allow_url_include = Off.",
    example: "allow_url_include = Off",
  }));

  const allowFopen = iniBool(get("allow_url_fopen"));
  out.push(finding({
    id: "allow_url_fopen",
    directive: "allow_url_fopen",
    level: allowFopen === false ? "ok" : "review",
    current: shown(get("allow_url_fopen")),
    recommended: "Off only if the application does not fetch remote URLs through fopen wrappers",
    risk: "Depends on the application",
    why: "On lets fopen, file_get_contents, and include-style wrappers reach remote URLs. That increases SSRF risk when a URL is attacker-controlled. Turning it off also breaks libraries that use those wrappers, including some Composer and CMS code. This is a review, not a blanket Off.",
    fix: "Leave it On if the app needs it, and pass only URLs you chose. Set Off when every outbound request uses an HTTP client you can restrict.",
    example: "allow_url_fopen = Off",
  }));

  const disabledRaw = get("disable_functions");
  const disabled = new Set(
    (disabledRaw ?? "")
      .split(/[\s,]+/)
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean),
  );
  const stillEnabled = SHELL_FUNCTIONS.filter((name) => !disabled.has(name));
  out.push(finding({
    id: "disable_functions",
    directive: "disable_functions",
    level: disabledRaw === undefined || stillEnabled.length === SHELL_FUNCTIONS.length ? "review" : stillEnabled.length === 0 ? "ok" : "info",
    current: disabledRaw === undefined ? "Not set in this file" : disabledRaw.trim() === "" ? "Empty" : disabledRaw,
    recommended: "Disable shell functions the application does not call",
    risk: "Depends on whether the app shells out",
    why: "exec, shell_exec, system, passthru, proc_open, and popen are required by some tools (image conversion, queues, deploy scripts) and dangerous if user input reaches them. Disabling all of them will break those apps.",
    fix: stillEnabled.length === 0
      ? "No change required for the shell functions checked here."
      : `Still enabled in this file: ${stillEnabled.join(", ")}. Disable only the ones the application does not use.`,
    example: "disable_functions = exec,passthru,shell_exec,system,popen,proc_open",
  }));

  const openBasedir = get("open_basedir");
  out.push(finding({
    id: "open_basedir",
    directive: "open_basedir",
    level: openBasedir && openBasedir.trim() !== "" ? "info" : "review",
    current: shown(openBasedir),
    recommended: "A path list that covers the app, its temp files, and sessions — when you know those paths",
    risk: "Limits file access; a wrong path breaks the app",
    why: "Empty or unset means PHP does not add its own directory jail. Setting it too tightly breaks uploads, sessions, or Composer. The operating system user should still be limited.",
    fix: "Set it to the application root plus the real session and upload directories. Confirm with a request after the change.",
    example: "open_basedir = /var/www/app:/tmp",
  }));

  pushCookie(out, "session.cookie_httponly", get("session.cookie_httponly"), "1", "Stops JavaScript from reading the session cookie.", "session.cookie_httponly = 1");
  const secure = iniBool(get("session.cookie_secure"));
  out.push(finding({
    id: "session.cookie_secure",
    directive: "session.cookie_secure",
    level: secure === true ? "ok" : "review",
    current: shown(get("session.cookie_secure")),
    recommended: "1 on HTTPS sites",
    risk: secure === true ? "No issue in this file" : "Session cookie may be sent over HTTP",
    why: "1 marks the session cookie Secure. That is what you want on HTTPS. It will stop the cookie from being stored on an HTTP-only development site.",
    fix: "Set session.cookie_secure = 1 for production HTTPS. Leave it off only for HTTP development.",
    example: "session.cookie_secure = 1",
  }));

  const sameSite = (get("session.cookie_samesite") ?? "").trim().toLowerCase();
  out.push(finding({
    id: "session.cookie_samesite",
    directive: "session.cookie_samesite",
    level: sameSite === "lax" || sameSite === "strict" ? "ok" : "review",
    current: shown(get("session.cookie_samesite")),
    recommended: "Lax or Strict",
    risk: sameSite === "none" ? "None sends the cookie on cross-site requests" : "Cross-site cookie behaviour is unset in this file",
    why: "Lax blocks most cross-site POST cookies and still allows normal link navigation. Strict is tighter and can break some return flows. None requires Secure and is for intentional cross-site cookies.",
    fix: "Prefer Lax unless the application has a documented reason for Strict or None.",
    example: "session.cookie_samesite = Lax",
  }));

  const strict = iniBool(get("session.use_strict_mode"));
  out.push(finding({
    id: "session.use_strict_mode",
    directive: "session.use_strict_mode",
    level: strict === true ? "ok" : "review",
    current: shown(get("session.use_strict_mode")),
    recommended: "1",
    risk: "Session fixation via uninitialized IDs",
    why: "1 makes PHP reject session IDs it did not create. Turning it on can drop old cookies once, which logs users out.",
    fix: "Set session.use_strict_mode = 1. Expect existing sessions to be recreated.",
    example: "session.use_strict_mode = 1",
  }));

  const uploads = iniBool(get("file_uploads"));
  out.push(finding({
    id: "file_uploads",
    directive: "file_uploads",
    level: uploads === false ? "info" : "ok",
    current: shown(get("file_uploads")),
    recommended: "Off only when the application never accepts uploads",
    risk: uploads === false ? "Uploads are disabled" : "Uploads stay available",
    why: "Many applications need uploads. Disabling them is safer only when no feature requires a file. This tool does not inspect upload handlers.",
    fix: uploads === false ? "Leave Off if you do not accept files." : "Keep On if you accept files, and review the size limits below.",
    example: "file_uploads = On",
  }));

  const uploadMax = parseIniSize(get("upload_max_filesize"));
  const postMax = parseIniSize(get("post_max_size"));
  if (uploadMax !== null && postMax !== null && postMax !== 0 && uploadMax !== 0 && postMax < uploadMax) {
    out.push(finding({
      id: "upload_sizes",
      directive: "upload_max_filesize / post_max_size",
      level: "review",
      current: `upload_max_filesize=${shown(get("upload_max_filesize"))}, post_max_size=${shown(get("post_max_size"))}`,
      recommended: "post_max_size at least as large as upload_max_filesize",
      risk: "Uploads fail, or the effective limit is the smaller post size",
      why: "PHP rejects a request body larger than post_max_size before the upload limit is applied. 0 on post_max_size means unlimited and was not flagged.",
      fix: "Raise post_max_size, or lower upload_max_filesize, so a legitimate upload fits in the body.",
      example: "upload_max_filesize = 8M\npost_max_size = 12M",
    }));
  } else if ((uploadMax !== null && uploadMax > 64 * 1024 * 1024) || (postMax !== null && postMax > 64 * 1024 * 1024)) {
    out.push(finding({
      id: "upload_sizes",
      directive: "upload_max_filesize / post_max_size",
      level: "review",
      current: `upload_max_filesize=${shown(get("upload_max_filesize"))}, post_max_size=${shown(get("post_max_size"))}`,
      recommended: "A limit that matches the largest file you actually accept",
      risk: "Large bodies can tie up PHP workers",
      why: "Some applications need big uploads. A very high limit is a review, not automatically wrong.",
      fix: "Lower the values if you do not accept large files. Keep them if you do, and enforce the same limit in the application.",
      example: "upload_max_filesize = 8M\npost_max_size = 12M",
    }));
  } else {
    out.push(finding({
      id: "upload_sizes",
      directive: "upload_max_filesize / post_max_size",
      level: uploadMax === null && postMax === null ? "info" : "ok",
      current: `upload_max_filesize=${shown(get("upload_max_filesize"))}, post_max_size=${shown(get("post_max_size"))}`,
      recommended: "post_max_size >= upload_max_filesize, both finite for web SAPIs",
      risk: "No size conflict in this file",
      why: "Either the sizes were not both set, or post_max_size can hold the upload.",
      fix: "Confirm the effective values with php -i if this file is not the only ini.",
      example: "upload_max_filesize = 8M\npost_max_size = 12M",
    }));
  }

  const maxExec = get("max_execution_time");
  const maxExecNumber = maxExec === undefined ? null : Number(maxExec);
  out.push(finding({
    id: "max_execution_time",
    directive: "max_execution_time",
    level: maxExecNumber === 0 ? "review" : "info",
    current: shown(maxExec),
    recommended: "A finite value for web requests",
    risk: maxExecNumber === 0 ? "A stuck request can hold a worker" : "Depends on the SAPI",
    why: "0 means unlimited. CLI jobs often need 0. A web SAPI usually wants a finite cap. Long exports and queues may need more than 30 seconds, so this is not a fixed number.",
    fix: "Set a finite max_execution_time for php-fpm or Apache. Keep 0 for CLI if you need it.",
    example: "max_execution_time = 30",
  }));

  const reporting = get("error_reporting");
  const reportingOff = reporting !== undefined && ["0", "off", "false"].includes(reporting.trim().toLowerCase());
  const logErrors = iniBool(get("log_errors"));
  out.push(finding({
    id: "error_reporting",
    directive: "error_reporting",
    level: reportingOff ? "review" : "info",
    current: shown(reporting),
    recommended: "E_ALL, with display_errors Off in production",
    risk: reportingOff ? "Errors are silenced" : "No change forced",
    why: "Turning reporting off hides defects. Production should log them instead of printing them. This tool does not decode every bitmask.",
    fix: "Use E_ALL (or E_ALL & ~E_DEPRECATED if you have a reason) and log_errors = On.",
    example: "error_reporting = E_ALL\nlog_errors = On\ndisplay_errors = Off",
  }));
  if (logErrors === false && display !== true) {
    out.push(finding({
      id: "log_errors",
      directive: "log_errors",
      level: "review",
      current: shown(get("log_errors")),
      recommended: "On when display_errors is Off",
      risk: "Failures may leave no record",
      why: "If errors are neither displayed nor logged, you lose the signal that something failed.",
      fix: "Set log_errors = On and a log path outside the web root.",
      example: "log_errors = On\nerror_log = /var/log/php_errors.log",
    }));
  }

  const pathInfo = get("cgi.fix_pathinfo");
  if (pathInfo !== undefined && iniBool(pathInfo) === true) {
    out.push(finding({
      id: "cgi.fix_pathinfo",
      directive: "cgi.fix_pathinfo",
      level: "review",
      current: pathInfo,
      recommended: "0 when PHP is executed as CGI",
      risk: "Depends on the SAPI",
      why: "cgi.fix_pathinfo=1 has been part of CGI argument-confusion issues when the web server passes a crafted path to the CGI SAPI. php-fpm usually does not use this path. This is not a claim that your server is exploitable.",
      fix: "Prefer php-fpm. If you still use CGI, set cgi.fix_pathinfo = 0 and retest routes.",
      example: "cgi.fix_pathinfo = 0",
    }));
  }

  return out;
}

function pushCookie(out: IniFinding[], directive: string, value: string | undefined, recommended: string, why: string, example: string) {
  const flag = iniBool(value);
  out.push(finding({
    id: directive,
    directive,
    level: flag === true ? "ok" : flag === false ? "high" : "review",
    current: shown(value),
    recommended,
    risk: flag === true ? "No issue in this file" : "Session cookie can be read by script",
    why,
    fix: `Set ${directive} = ${recommended}.`,
    example,
  }));
}
