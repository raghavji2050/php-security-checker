import { describe, expect, it } from "vitest";
import { auditIni, parseIni } from "@/lib/ini-audit";
import { auditSummaryMarkdown, readAuditVersion, summarizeAudit, type AuditVersionPart } from "@/lib/server-audit";

const base: AuditVersionPart = {
  version: "8.3.12",
  securityStatus: "no_known_issues",
  supportState: "security",
  supportLabel: "Security fixes only",
  confirmed: 0,
  potential: 0,
  critical: 0,
  high: 0,
  recommendedVersion: null,
  distro: null,
  xdebug: false,
};

describe("readAuditVersion", () => {
  it("accepts a plain version", () => {
    expect(readAuditVersion(" 8.3.12 ")).toEqual({ ok: true, version: "8.3.12", suffix: null, distro: null, xdebug: false });
  });
  it("accepts php -v output with a distro suffix", () => {
    const r = readAuditVersion("PHP 8.1.2-1ubuntu2.20 (cli) (built: Jun 24 2024 15:20:40) (NTS)");
    expect(r.ok && r.version).toBe("8.1.2");
    expect(r.ok && r.distro).toBe("Ubuntu");
  });
  it("rejects empty and invalid input", () => {
    expect(readAuditVersion("").ok).toBe(false);
    expect(readAuditVersion("8.3").ok).toBe(false);
  });
});

describe("summarizeAudit", () => {
  it("is incomplete when nothing was checked", () => {
    const s = summarizeAudit({ version: null, ini: null, extensions: null });
    expect(s.level).toBe("incomplete");
    expect(s.notChecked).toEqual(["PHP version", "php.ini", "extensions"]);
  });
  it("is ok when the checked parts are clean", () => {
    const s = summarizeAudit({ version: base, ini: null, extensions: [] });
    expect(s.level).toBe("ok");
    expect(s.notChecked).toEqual(["php.ini"]);
  });
  it("puts EOL and confirmed CVEs first as actions", () => {
    const s = summarizeAudit({
      version: { ...base, version: "8.0.30", supportState: "eol", supportLabel: "End of life", confirmed: 3, potential: 1, critical: 1, high: 2, recommendedVersion: "8.4.14", distro: "Ubuntu" },
      ini: null,
      extensions: null,
    });
    expect(s.level).toBe("action");
    expect(s.actions[0].text).toContain("end of life");
    expect(s.actions[1].text).toContain("3 confirmed CVEs");
    expect(s.actions[1].text).toContain("1 critical, 2 high");
    expect(s.actions.at(-1)?.level).toBe("review");
    expect(s.actions.some((a) => a.text.includes("Ubuntu package"))).toBe(true);
  });
  it("includes high php.ini findings", () => {
    const parsed = parseIni("display_errors = On\n");
    if (!parsed.ok) throw new Error("parse");
    const s = summarizeAudit({ version: null, ini: auditIni(parsed.values), extensions: null });
    expect(s.level).toBe("action");
    expect(s.actions.some((a) => a.area === "php.ini" && a.text.startsWith("display_errors"))).toBe(true);
  });
  it("flags confirmed extension mentions", () => {
    const s = summarizeAudit({
      version: base,
      ini: null,
      extensions: [{ name: "phar", kind: "bundled", outdated: null, outdatedReason: "", status: "confirmed_on_entered_version", mentions: [], mentionCount: 1 }],
    });
    expect(s.actions).toEqual([{ area: "extensions", level: "action", text: "phar: a confirmed CVE for this PHP version mentions this extension." }]);
  });
});

describe("auditSummaryMarkdown", () => {
  it("renders a table and escapes pipes", () => {
    const md = auditSummaryMarkdown(
      { level: "action", headline: "1 item(s) need action.", actions: [{ area: "php.ini", level: "action", text: "a | b" }], checked: ["php.ini"], notChecked: ["extensions"] },
      "client-1",
      "2026-11-13",
    );
    expect(md).toContain("# PHP server audit summary: client-1");
    expect(md).toContain("| Action | php.ini | a \\| b |");
    expect(md).toContain("Not checked: extensions");
  });
});
