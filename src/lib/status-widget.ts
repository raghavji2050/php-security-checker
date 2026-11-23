import { compareBranches } from "@/lib/version";
import type { PhpBranch, SupportState } from "@/lib/types";

const COLORS: Record<SupportState, string> = {
  active: "#047857",
  security: "#b45309",
  eol: "#9f1239",
  unknown: "#44403c",
};

const LABELS: Record<SupportState, string> = {
  active: "Active support",
  security: "Security fixes only",
  eol: "End of life",
  unknown: "Unknown",
};

function xml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[char] ?? char);
}

/** Supported branches (active or security-only), newest first, plus the newest end-of-life branch for context. */
export function widgetBranches(branches: PhpBranch[]): PhpBranch[] {
  const sorted = [...branches].sort((a, b) => compareBranches(b.branch, a.branch));
  const supported = sorted.filter((b) => b.state === "active" || b.state === "security").slice(0, 5);
  const eol = sorted.find((b) => b.state === "eol");
  return eol ? [...supported, eol] : supported;
}

/** Self-contained SVG card of PHP branch support status; only uses branch data passed in. */
export function statusWidgetSvg(branches: PhpBranch[], retrievedAt: string | null): string {
  const rows = widgetBranches(branches);
  const rowHeight = 24;
  const height = 44 + rows.length * rowHeight + 22;
  const width = 300;
  const body = rows
    .map((b, i) => {
      const y = 44 + i * rowHeight;
      const patch = b.latestPatch ? `latest ${b.latestPatch}` : "";
      return `  <rect x="12" y="${y}" width="6" height="16" rx="2" fill="${COLORS[b.state]}"/>
  <text x="26" y="${y + 12}" font-size="12" font-weight="600" fill="#f4f0e6">PHP ${xml(b.branch)}</text>
  <text x="84" y="${y + 12}" font-size="11" fill="#d6d0c2">${xml(LABELS[b.state])}</text>
  <text x="${width - 12}" y="${y + 12}" font-size="10" text-anchor="end" fill="#a8a29e">${xml(patch)}</text>`;
    })
    .join("\n");
  const date = retrievedAt ? `data from php.net, ${retrievedAt.slice(0, 10)}` : "data from php.net";
  const label = rows.length ? `PHP support status: ${rows.map((b) => `${b.branch} ${LABELS[b.state]}`).join(", ")}` : "PHP support status unavailable";
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${xml(label)}" font-family="ui-sans-serif,system-ui,sans-serif">
  <title>${xml(label)}</title>
  <rect width="${width}" height="${height}" rx="8" fill="#1c1915"/>
  <text x="12" y="25" font-size="13" font-weight="700" fill="#f4f0e6">PHP support status</text>
${body || `  <text x="12" y="62" font-size="11" fill="#d6d0c2">Unable to load branch data</text>`}
  <text x="12" y="${height - 8}" font-size="9" fill="#a8a29e">${xml(date)} · php-security-checker.vercel.app</text>
</svg>`;
}

/** Copy-paste snippets for the docs page. */
export function embedSnippets(origin: string): { html: string; markdown: string } {
  const src = `${origin}/api/widget/php-status`;
  return {
    html: `<a href="${origin}/php-versions"><img src="${src}" alt="PHP support status" width="300" loading="lazy"></a>`,
    markdown: `[![PHP support status](${src})](${origin}/php-versions)`,
  };
}
