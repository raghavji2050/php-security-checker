import { describe, expect, it } from "vitest";
import { auditIni, iniBool, parseIni, parseIniSize } from "@/lib/ini-audit";

const production = `display_errors = On
expose_php = On
allow_url_include = On
allow_url_fopen = On
disable_functions =
session.cookie_httponly = 0
session.cookie_secure = 0
session.use_strict_mode = 0
upload_max_filesize = 64M
post_max_size = 8M
max_execution_time = 0
error_reporting = 0
`;

describe("php.ini audit", () => {
  it("parses directives and ignores comments and sections", () => {
    const parsed = parseIni("[PHP]\n; comment\ndisplay_errors = Off ; shown\nallow_url_fopen = \"On\"\n");
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.values.display_errors).toBe("Off");
    expect(parsed.values.allow_url_fopen).toBe("On");
  });

  it("rejects PHP source and empty files", () => {
    expect(parseIni("<?php echo 1;").ok).toBe(false);
    expect(parseIni("   ").ok).toBe(false);
  });

  it("flags remote include and production display_errors, and only reviews allow_url_fopen", () => {
    const parsed = parseIni(production);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const findings = auditIni(parsed.values, "production");
    const level = (id: string) => findings.find((item) => item.id === id)?.level;
    expect(level("allow_url_include")).toBe("high");
    expect(level("display_errors")).toBe("high");
    expect(level("session.cookie_httponly")).toBe("high");
    expect(level("allow_url_fopen")).toBe("review");
    expect(level("upload_sizes")).toBe("review");
    expect(level("max_execution_time")).toBe("review");
    expect(findings.find((item) => item.id === "allow_url_fopen")?.why).toMatch(/not a blanket/i);
  });

  it("does not treat display_errors=On as high on a development file", () => {
    const parsed = parseIni("display_errors = On\n");
    if (!parsed.ok) throw new Error("parse");
    expect(auditIni(parsed.values, "development").find((item) => item.id === "display_errors")?.level).toBe("info");
  });

  it("parses sizes and booleans without guessing missing keys", () => {
    expect(parseIniSize("8M")).toBe(8 * 1024 * 1024);
    expect(parseIniSize("0")).toBe(0);
    expect(iniBool("Off")).toBe(false);
    expect(iniBool(undefined)).toBe(null);
  });
});
