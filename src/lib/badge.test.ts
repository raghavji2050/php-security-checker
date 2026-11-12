import { describe, expect, it } from "vitest";
import { symfonyBadge } from "@/lib/badge";

const base = { version: "7.4.0", support: { state: "active" as const }, patchBehind: false, advisories: { findings: [] as unknown[] } };

describe("symfonyBadge", () => {
  it("never says clean when advisories could not be loaded", () => {
    expect(symfonyBadge({ ...base, advisories: null })).toContain("unable to verify");
  });
  it("counts advisories", () => {
    expect(symfonyBadge({ ...base, advisories: { findings: [1, 2] } })).toContain("2 advisories");
    expect(symfonyBadge({ ...base, advisories: { findings: [1] } })).toContain("1 advisory");
  });
  it("flags end of life and stale patches", () => {
    expect(symfonyBadge({ ...base, support: { state: "eol" } })).toContain("end of life");
    expect(symfonyBadge({ ...base, patchBehind: true })).toContain("update available");
  });
  it("shows no known advisories when supported and current", () => {
    expect(symfonyBadge(base)).toContain("no known advisories");
  });
  it("escapes the version text", () => {
    expect(symfonyBadge({ ...base, version: "<x>" })).toContain("&lt;x&gt;");
  });
});
