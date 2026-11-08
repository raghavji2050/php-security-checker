import { describe, expect, it } from "vitest";
import {
  assertPublicAddresses,
  fetchPublicHeaders,
  isBlockedIp,
  SsrfError,
  validatePublicUrl,
} from "@/lib/ssrf";

describe("SSRF address policy", () => {
  it("blocks private, loopback, link-local, metadata, and mapped addresses", () => {
    for (const ip of [
      "127.0.0.1",
      "10.1.2.3",
      "172.16.0.1",
      "172.31.255.255",
      "192.168.1.20",
      "169.254.169.254",
      "100.64.0.5",
      "0.0.0.0",
      "255.255.255.255",
      "224.0.0.1",
      "192.0.2.1",
      "198.51.100.1",
      "203.0.113.1",
      "::1",
      "fe80::1",
      "fd00::1",
      "fc00::1",
      "2001:db8::1",
      "::ffff:127.0.0.1",
      "::ffff:169.254.169.254",
      "0:0:0:0:0:ffff:7f00:1",
    ]) {
      expect(isBlockedIp(ip), ip).toBe(true);
    }
    expect(isBlockedIp("8.8.8.8")).toBe(false);
    expect(isBlockedIp("1.1.1.1")).toBe(false);
    expect(isBlockedIp("172.32.0.1")).toBe(false);
  });

  it("rejects a set that mixes a public address with a private one", () => {
    expect(() => assertPublicAddresses(["8.8.8.8", "10.0.0.2"])).toThrow(SsrfError);
    expect(() => assertPublicAddresses([])).toThrow(SsrfError);
  });

  it("allows only public http(s) URLs on ports 80 and 443", () => {
    expect(validatePublicUrl("https://example.com/path").ok).toBe(true);
    expect(validatePublicUrl("http://127.0.0.1/").ok).toBe(false);
    expect(validatePublicUrl("http://[::1]/").ok).toBe(false);
    expect(validatePublicUrl("http://169.254.169.254/latest").ok).toBe(false);
    expect(validatePublicUrl("http://metadata.google.internal/").ok).toBe(false);
    expect(validatePublicUrl("http://2130706433/").ok).toBe(false);
    expect(validatePublicUrl("http://0x7f000001/").ok).toBe(false);
    expect(validatePublicUrl("http://0177.0.0.1/").ok).toBe(false);
    expect(validatePublicUrl("http://user:pass@example.com/").ok).toBe(false);
    expect(validatePublicUrl("http://example.com:8080/").ok).toBe(false);
    expect(validatePublicUrl("file:///etc/passwd").ok).toBe(false);
    expect(validatePublicUrl("http://app.internal/").ok).toBe(false);
    expect(validatePublicUrl("gopher://example.com/").ok).toBe(false);
  });

  it("does not follow a redirect onto a blocked address", async () => {
    let calls = 0;
    const result = await fetchPublicHeaders("https://example.com/", {
      resolve: async () => ["93.184.216.34"],
      request: async (url) => {
        calls += 1;
        return { status: 302, headers: new Headers({ location: "http://127.0.0.1/latest" }), url };
      },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("blocked_target");
    expect(calls).toBe(1);
  });

  it("stops when a redirect target resolves to a private address", async () => {
    const result = await fetchPublicHeaders("https://example.com/start", {
      resolve: async (hostname) => {
        if (hostname === "example.com") return ["93.184.216.34"];
        throw new SsrfError("blocked");
      },
      request: async (url) => ({ status: 302, headers: new Headers({ location: "https://rebind.example/" }), url }),
    });
    expect(result).toEqual({ ok: false, code: "blocked_target" });
  });
});
