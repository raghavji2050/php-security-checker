export type HeaderLevel = "review" | "ok" | "info";

export type HeaderFinding = {
  id: string;
  level: HeaderLevel;
  title: string;
  current: string;
  recommended: string;
  why: string;
};

function hstsMaxAge(value: string): number {
  const match = /max-age=\s*(\d+)/i.exec(value);
  return match ? Number(match[1]) : 0;
}

function hasFrameAncestors(csp: string | undefined): boolean {
  return Boolean(csp && /(?:^|;)\s*frame-ancestors\s+/i.test(csp));
}

/** Assess response headers the caller already fetched. No network. */
export function auditSecurityHeaders(headers: Record<string, string>, finalUrl: string): HeaderFinding[] {
  const lower: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) lower[key.toLowerCase()] = value;
  const https = finalUrl.startsWith("https:");
  const findings: HeaderFinding[] = [];

  const hsts = lower["strict-transport-security"];
  if (!https) {
    findings.push({
      id: "hsts",
      level: "info",
      title: "Strict-Transport-Security",
      current: hsts ? "Present on an HTTP response" : "Not set",
      recommended: "Serve HTTPS, then set a max-age",
      why: "Browsers ignore HSTS on plain HTTP. A missing header here is not scored as a production HTTPS failure.",
    });
  } else if (!hsts) {
    findings.push({
      id: "hsts",
      level: "review",
      title: "Strict-Transport-Security",
      current: "Not set",
      recommended: "max-age of at least six months on HTTPS responses",
      why: "Without HSTS, a visitor can be sent to HTTP on a later visit if something downgrades the link.",
    });
  } else if (hstsMaxAge(hsts) < 15_552_000) {
    findings.push({
      id: "hsts",
      level: "review",
      title: "Strict-Transport-Security",
      current: hsts,
      recommended: "max-age of at least six months",
      why: "A missing or very short max-age drops the browser out of HSTS quickly. preload is optional and not required here.",
    });
  } else {
    findings.push({
      id: "hsts",
      level: "ok",
      title: "Strict-Transport-Security",
      current: hsts,
      recommended: "A long max-age on HTTPS",
      why: "The HTTPS response includes a long HSTS max-age.",
    });
  }

  const csp = lower["content-security-policy"];
  const reportOnly = lower["content-security-policy-report-only"];
  if (!csp && reportOnly) {
    findings.push({
      id: "csp",
      level: "review",
      title: "Content-Security-Policy",
      current: "Report-Only only",
      recommended: "An enforced policy once you have watched the reports",
      why: "Report-Only does not block anything. It is a reasonable first step, not a finished policy.",
    });
  } else if (!csp) {
    findings.push({
      id: "csp",
      level: "review",
      title: "Content-Security-Policy",
      current: "Not set",
      recommended: "A policy that fits the pages you actually serve",
      why: "CSP reduces the impact of injected scripts and can replace X-Frame-Options via frame-ancestors. A copied strict policy will break inline scripts and styles, so this is a review, not a one-line fix.",
    });
  } else {
    findings.push({
      id: "csp",
      level: "ok",
      title: "Content-Security-Policy",
      current: csp,
      recommended: "An enforced policy",
      why: "A Content-Security-Policy header is present. This check does not judge whether the policy is strict enough for your pages.",
    });
  }

  const nosniff = (lower["x-content-type-options"] ?? "").toLowerCase();
  findings.push({
    id: "nosniff",
    level: nosniff === "nosniff" ? "ok" : "review",
    title: "X-Content-Type-Options",
    current: lower["x-content-type-options"] ?? "Not set",
    recommended: "nosniff",
    why: "nosniff stops browsers from sniffing a stylesheet or script out of a response you labelled as something else.",
  });

  const xfo = lower["x-frame-options"];
  const framed = hasFrameAncestors(csp);
  findings.push({
    id: "framing",
    level: framed || (xfo && /deny|sameorigin/i.test(xfo)) ? "ok" : "review",
    title: "Framing",
    current: framed ? "CSP frame-ancestors is set" : xfo ?? "Not set",
    recommended: "frame-ancestors in CSP, or X-Frame-Options DENY or SAMEORIGIN",
    why: "One of those controls stops other sites from embedding your pages in a frame. If CSP already sets frame-ancestors, a separate X-Frame-Options header is optional.",
  });

  const referrer = (lower["referrer-policy"] ?? "").toLowerCase();
  findings.push({
    id: "referrer",
    level: !referrer || referrer === "unsafe-url" || referrer === "no-referrer-when-downgrade" ? "review" : "ok",
    title: "Referrer-Policy",
    current: lower["referrer-policy"] ?? "Not set",
    recommended: "strict-origin-when-cross-origin or stricter",
    why: "unsafe-url and the old default can send full paths across origins. no-referrer, same-origin, and strict-origin-when-cross-origin are tighter.",
  });

  findings.push({
    id: "permissions",
    level: lower["permissions-policy"] ? "ok" : "info",
    title: "Permissions-Policy",
    current: lower["permissions-policy"] ?? "Not set",
    recommended: "Disable browser features you do not use",
    why: "Missing Permissions-Policy is common and not, by itself, a vulnerability. Set it when you want to turn off camera, microphone, or similar APIs.",
  });

  if (lower["x-powered-by"]) {
    findings.push({
      id: "x-powered-by",
      level: "info",
      title: "X-Powered-By",
      current: lower["x-powered-by"],
      recommended: "Omit the header when you can",
      why: "The header advertises a technology. Removing it does not patch anything. PHP's expose_php controls this header for PHP.",
    });
  }
  if (lower.server) {
    findings.push({
      id: "server",
      level: "info",
      title: "Server",
      current: lower.server,
      recommended: "A generic value if the server lets you change it",
      why: "Server banners can name a product and version. Many proxies set this and it is not a vulnerability by itself.",
    });
  }

  const xss = lower["x-xss-protection"];
  if (xss) {
    findings.push({
      id: "x-xss-protection",
      level: "info",
      title: "X-XSS-Protection",
      current: xss,
      recommended: "0, or omit it",
      why: "The legacy XSS auditor is removed from current browsers. 0 disables the old filter. It is not a substitute for CSP.",
    });
  }

  return findings;
}
