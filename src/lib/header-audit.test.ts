import { describe, expect, it } from "vitest";
import { auditSecurityHeaders } from "@/lib/header-audit";

describe("security header audit", () => {
  it("reviews a bare HTTPS response and accepts frame-ancestors in place of X-Frame-Options", () => {
    const findings = auditSecurityHeaders(
      { "content-security-policy": "default-src 'self'; frame-ancestors 'none'", "x-content-type-options": "nosniff" },
      "https://example.com/",
    );
    const level = (id: string) => findings.find((item) => item.id === id)?.level;
    expect(level("hsts")).toBe("review");
    expect(level("csp")).toBe("ok");
    expect(level("nosniff")).toBe("ok");
    expect(level("framing")).toBe("ok");
  });

  it("does not treat a missing HSTS header on HTTP as an HTTPS failure", () => {
    const findings = auditSecurityHeaders({}, "http://example.com/");
    expect(findings.find((item) => item.id === "hsts")?.level).toBe("info");
  });

  it("notes powered-by without calling it a vulnerability", () => {
    const findings = auditSecurityHeaders({ "x-powered-by": "PHP/8.3.12" }, "https://example.com/");
    const item = findings.find((finding) => finding.id === "x-powered-by");
    expect(item?.level).toBe("info");
    expect(item?.why).toMatch(/does not patch/i);
  });
});
