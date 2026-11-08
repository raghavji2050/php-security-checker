export type ConfigLevel = "high" | "review" | "ok" | "info";

export type ConfigFinding = {
  id: string;
  level: ConfigLevel;
  title: string;
  current: string;
  recommended: string;
  why: string;
  fix: string;
};

export type LaravelTarget = "production" | "local";

const PLACEHOLDER = /^(base64:)?(somerandomstring|changeme|secret|your-key|xxx+)$/i;

/** Read KEY=VALUE lines. Values are only used inside the audit and must not be returned. */
export function parseEnvLines(text: string): Map<string, string> | { error: string } {
  if (typeof text !== "string") return { error: "Paste env lines as text." };
  if (text.length > 64 * 1024) return { error: "That paste is too large (max 64 KB)." };
  if (text.includes("\0")) return { error: "This file is not plain text." };
  const values = new Map<string, string>();
  for (const line of text.split(/\r?\n/).slice(0, 2000)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    if (!/^[A-Z0-9_]+$/.test(key)) continue;
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values.set(key, value);
  }
  return values;
}

function boolish(value: string | undefined): boolean | null {
  if (value === undefined) return null;
  const normalized = value.trim().toLowerCase();
  if (["true", "1", "(true)"].includes(normalized)) return true;
  if (["false", "0", "(false)", ""].includes(normalized)) return false;
  return null;
}

function finding(partial: ConfigFinding): ConfigFinding {
  return partial;
}

/**
 * Checklist from values the user pasted. APP_KEY is never copied into the result.
 * This does not read a live application.
 */
export function auditLaravelEnv(text: string, target: LaravelTarget): { findings: ConfigFinding[] } | { error: string } {
  const parsed = parseEnvLines(text);
  if ("error" in parsed) return parsed;
  if (parsed.size === 0) return { error: "No KEY=VALUE lines found." };
  const findings: ConfigFinding[] = [];
  const debug = boolish(parsed.get("APP_DEBUG"));
  const env = parsed.get("APP_ENV")?.trim();

  if (env === undefined) {
    findings.push(finding({
      id: "app_env",
      level: "review",
      title: "APP_ENV",
      current: "Not in the paste",
      recommended: target === "production" ? "production" : "local",
      why: "Laravel uses APP_ENV to choose configuration. This paste does not include it.",
      fix: "Set APP_ENV=production on the live app and local (or testing) elsewhere.",
    }));
  } else if (target === "production" && env !== "production") {
    findings.push(finding({
      id: "app_env",
      level: "review",
      title: "APP_ENV",
      current: env || "Empty",
      recommended: "production",
      why: "You marked this as a production checklist, and APP_ENV is not production. That can leave debug tooling or looser defaults active.",
      fix: "Set APP_ENV=production for the live environment.",
    }));
  } else {
    findings.push(finding({
      id: "app_env",
      level: "ok",
      title: "APP_ENV",
      current: env || "Empty",
      recommended: target === "production" ? "production" : "local or testing",
      why: "The value matches the environment you selected.",
      fix: "No change from this checklist.",
    }));
  }

  if (target === "production" && debug === true) {
    findings.push(finding({
      id: "app_debug",
      level: "high",
      title: "APP_DEBUG",
      current: "true",
      recommended: "false in production",
      why: "APP_DEBUG=true can render stack traces, environment details, and queries to visitors.",
      fix: "Set APP_DEBUG=false, then reload config (php artisan config:clear) so a cached config does not keep the old value.",
    }));
  } else if (target === "production" && debug === null) {
    findings.push(finding({
      id: "app_debug",
      level: "review",
      title: "APP_DEBUG",
      current: "Not in the paste",
      recommended: "false in production",
      why: "Stock Laravel .env.example sets APP_DEBUG=true. If this line is missing, confirm the effective value. A cached config can also override the file.",
      fix: "Set APP_DEBUG=false for production and clear the config cache.",
    }));
  } else if (debug === false) {
    findings.push(finding({
      id: "app_debug",
      level: "ok",
      title: "APP_DEBUG",
      current: "false",
      recommended: "false in production",
      why: "Debug output is off in the pasted value.",
      fix: "Keep it false on production.",
    }));
  } else {
    findings.push(finding({
      id: "app_debug",
      level: "info",
      title: "APP_DEBUG",
      current: debug === true ? "true" : "Not a boolean",
      recommended: "true is normal for local development",
      why: "Local debugging often needs APP_DEBUG=true. Do not use that value on production.",
      fix: "Use false when this environment is exposed.",
    }));
  }

  const key = parsed.get("APP_KEY");
  if (key === undefined) {
    findings.push(finding({
      id: "app_key",
      level: "review",
      title: "APP_KEY",
      current: "Not in the paste",
      recommended: "A generated key",
      why: "Laravel uses APP_KEY for encryption and cookie integrity. This paste does not show whether it is set. The value is never displayed.",
      fix: "Run php artisan key:generate on the server if the key is empty. Do not commit the key.",
    }));
  } else if (key.trim() === "") {
    findings.push(finding({
      id: "app_key",
      level: "high",
      title: "APP_KEY",
      current: "Empty",
      recommended: "A generated key",
      why: "An empty APP_KEY breaks encryption and signed cookies.",
      fix: "Run php artisan key:generate and keep the key out of git.",
    }));
  } else if (PLACEHOLDER.test(key.trim())) {
    findings.push(finding({
      id: "app_key",
      level: "high",
      title: "APP_KEY",
      current: "Looks like a placeholder",
      recommended: "A key from php artisan key:generate",
      why: "The pasted value matches a common placeholder. The value itself is not shown.",
      fix: "Generate a new key and rotate anything that was encrypted with the placeholder.",
    }));
  } else {
    findings.push(finding({
      id: "app_key",
      level: "ok",
      title: "APP_KEY",
      current: "Set (value hidden)",
      recommended: "A unique generated key per environment",
      why: "A non-empty key was present. This check does not judge its entropy and does not store it.",
      fix: "Keep a different key in each environment. Do not paste it into tickets.",
    }));
  }

  const sameSite = parsed.get("SESSION_SAME_SITE")?.trim().toLowerCase();
  if (sameSite === undefined) {
    findings.push(finding({
      id: "session_same_site",
      level: "info",
      title: "SESSION_SAME_SITE",
      current: "Not in the paste",
      recommended: "lax or strict",
      why: "Stock Laravel config/session.php uses lax when the env var is missing. Confirm that file if you changed it.",
      fix: "Set SESSION_SAME_SITE=lax unless you have a reason to use strict or none.",
    }));
  } else if (sameSite === "lax" || sameSite === "strict") {
    findings.push(finding({
      id: "session_same_site",
      level: "ok",
      title: "SESSION_SAME_SITE",
      current: sameSite,
      recommended: "lax or strict",
      why: "Lax or strict limits cross-site cookie sending.",
      fix: "No change from this checklist.",
    }));
  } else {
    findings.push(finding({
      id: "session_same_site",
      level: "review",
      title: "SESSION_SAME_SITE",
      current: sameSite || "Empty",
      recommended: "lax or strict",
      why: "none sends the session cookie on cross-site requests and needs SESSION_SECURE_COOKIE=true. Other values are not the stock Laravel options.",
      fix: "Use lax or strict for a normal session.",
    }));
  }

  const secure = boolish(parsed.get("SESSION_SECURE_COOKIE"));
  if (target === "production" && secure !== true) {
    findings.push(finding({
      id: "session_secure",
      level: "review",
      title: "SESSION_SECURE_COOKIE",
      current: parsed.get("SESSION_SECURE_COOKIE") === undefined ? "Not in the paste" : parsed.get("SESSION_SECURE_COOKIE") || "Empty",
      recommended: "true on HTTPS production",
      why: "Without the Secure flag, the session cookie can be sent on plain HTTP. Stock config does not force it when the env var is missing. HTTP-only local sites cannot use true.",
      fix: "Set SESSION_SECURE_COOKIE=true when the site is served over HTTPS.",
    }));
  } else if (secure === true) {
    findings.push(finding({
      id: "session_secure",
      level: "ok",
      title: "SESSION_SECURE_COOKIE",
      current: "true",
      recommended: "true on HTTPS",
      why: "The session cookie is marked Secure in the paste.",
      fix: "Keep it true on HTTPS.",
    }));
  }

  return { findings };
}

export function auditCsrfChoice(choice: "enabled" | "disabled" | "unsure"): ConfigFinding {
  if (choice === "disabled") {
    return {
      id: "csrf",
      level: "high",
      title: "CSRF middleware",
      current: "You reported it is disabled or broadly excepted",
      recommended: "Enabled for cookie-authenticated web routes",
      why: "Laravel's web middleware group enables VerifyCsrfToken. Disabling it is reasonable for a token API that does not use the session cookie, and unsafe for browser forms that do.",
      fix: "Keep the middleware for web routes. Limit $except to endpoints that have their own proof, and do not put every route there.",
    };
  }
  if (choice === "enabled") {
    return {
      id: "csrf",
      level: "ok",
      title: "CSRF middleware",
      current: "You reported it is enabled",
      recommended: "Enabled for cookie-authenticated web routes",
      why: "This tool did not read the application. The answer is the one you selected.",
      fix: "No change from this answer.",
    };
  }
  return {
    id: "csrf",
    level: "info",
    title: "CSRF middleware",
    current: "Not answered",
    recommended: "Enabled for cookie-authenticated web routes",
    why: "This tool does not open your project or a live site, so it cannot see VerifyCsrfToken.",
    fix: "Check app/Http/Middleware and bootstrap/app.php (or Kernel.php) yourself.",
  };
}
