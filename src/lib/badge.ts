import type { CheckResult, SecurityStatus } from "@/lib/types";

const COLORS: Record<SecurityStatus, string> = {
  vulnerable: "#9f1239",
  caution: "#b45309",
  no_known_issues: "#047857",
  unable_to_verify: "#44403c",
};

function xml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[char] ?? char);
}

function width(text: string): number {
  return Math.max(40, Math.round(text.length * 6.4) + 16);
}

export function statusBadgeSvg(left: string, right: string, color: string): string {
  const leftWidth = width(left);
  const rightWidth = width(right);
  const total = leftWidth + rightWidth;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${total}" height="20" role="img" aria-label="${xml(`${left}: ${right}`)}">
  <title>${xml(`${left}: ${right}`)}</title>
  <rect width="${total}" height="20" rx="3" fill="#1c1915"/>
  <rect width="${leftWidth}" height="20" rx="3" fill="${color}"/>
  <rect x="${leftWidth - 3}" width="3" height="20" fill="${color}"/>
  <text x="${leftWidth / 2}" y="14" text-anchor="middle" font-family="ui-sans-serif,system-ui,sans-serif" font-size="11" fill="#f3fff8">${xml(left)}</text>
  <text x="${leftWidth + rightWidth / 2}" y="14" text-anchor="middle" font-family="ui-sans-serif,system-ui,sans-serif" font-size="11" fill="#f4f0e6">${xml(right)}</text>
</svg>`;
}

export function badgeForResult(result: CheckResult): string {
  const right = result.securityStatus === "unable_to_verify"
    ? "unable to verify"
    : result.securityStatus === "no_known_issues"
      ? "no confirmed issues"
      : `${result.counts.confirmed} confirmed`;
  return statusBadgeSvg(`PHP ${result.version}`, right, COLORS[result.securityStatus]);
}

export function badgeMessage(left: string, right: string): string {
  return statusBadgeSvg(left, right, "#44403c");
}
