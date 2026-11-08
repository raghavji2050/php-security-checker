import { describe, expect, it } from "vitest";
import { auditCsrfChoice, auditLaravelEnv } from "@/lib/laravel-config";

const SECRET = "base64:super-secret-value-xyz-not-for-logs";

describe("Laravel config checklist", () => {
  it("does not echo APP_KEY and flags production debug", () => {
    const result = auditLaravelEnv(`APP_ENV=local\nAPP_DEBUG=true\nAPP_KEY=${SECRET}\n`, "production");
    expect("error" in result).toBe(false);
    if ("error" in result) return;
    const encoded = JSON.stringify(result);
    expect(encoded).not.toContain(SECRET);
    expect(encoded).not.toContain("super-secret");
    expect(result.findings.find((item) => item.id === "app_key")?.current).toBe("Set (value hidden)");
    expect(result.findings.find((item) => item.id === "app_debug")?.level).toBe("high");
  });

  it("flags an empty key and a disabled CSRF answer", () => {
    const result = auditLaravelEnv("APP_KEY=\nAPP_ENV=production\nAPP_DEBUG=false\n", "production");
    if ("error" in result) throw new Error(result.error);
    expect(result.findings.find((item) => item.id === "app_key")?.level).toBe("high");
    expect(auditCsrfChoice("disabled").level).toBe("high");
    expect(auditCsrfChoice("unsure").why).toMatch(/does not open your project/i);
  });
});
