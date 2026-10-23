import { describe, expect, it } from "vitest";
import { compareVersions, parsePhpVersion } from "@/lib/version";

describe("parsePhpVersion", () => {
  it("accepts a numeric major.minor.patch release", () => {
    expect(parsePhpVersion(" 8.1.12 ")?.raw).toBe("8.1.12");
  });

  it("rejects a branch, a fourth component, pre-releases, and leading zeros", () => {
    for (const value of ["8.1", "8", "8.1.12.1", "8.1.12-rc1", "v8.1.12", "08.1.12", "8.01.2", ""]) {
      expect(parsePhpVersion(value)).toBeNull();
    }
  });
});

describe("compareVersions", () => {
  it("compares numeric components instead of strings", () => {
    const older = parsePhpVersion("8.1.9");
    const newer = parsePhpVersion("8.1.10");
    const same = parsePhpVersion("8.1.10");
    const nextBranch = parsePhpVersion("8.2.0");
    expect(older && newer && compareVersions(older, newer)).toBeLessThan(0);
    expect(newer && same && compareVersions(newer, same)).toBe(0);
    expect(newer && nextBranch && compareVersions(nextBranch, newer)).toBeGreaterThan(0);
  });
});
