import { describe, expect, it } from "vitest";
import {
  compareVersions,
  formatSymfonyMonth,
  normalizeSymfonyVersion,
  parseSymfonyBranch,
  parseSymfonyMonth,
  parseSymfonyReleases,
  symfonyBranchOf,
  symfonySupportState,
} from "@/lib/symfony-support";

// Shapes match symfony.com/releases.json and /releases/{branch}.json (values are test fixtures).
const RELEASES = parseSymfonyReleases({
  symfony_versions: { lts: "7.4.23", stable: "8.1.11", next: "8.2.0-BETA1" },
  supported_versions: ["6.4", "7.4", "8.1"],
  maintained_versions: ["6.4", "7.4", "8.1", "8.2"],
  security_maintained_versions: ["5.4"],
  min_php_requirements: { "4.4": "7.1.3", "5.4": "7.2.5", "7.4": "8.2.0" },
});

describe("Symfony version input", () => {
  it("accepts stable full versions and rejects others", () => {
    expect(normalizeSymfonyVersion("v7.4.10")).toBe("7.4.10");
    expect(normalizeSymfonyVersion(" 6.4.01 ")).toBe("6.4.1");
    expect(normalizeSymfonyVersion("7.4")).toBeNull();
    expect(normalizeSymfonyVersion("7.4.0-RC1")).toBeNull();
    expect(normalizeSymfonyVersion("../etc")).toBeNull();
  });
  it("derives the branch and compares numerically", () => {
    expect(symfonyBranchOf("7.4.10")).toBe("7.4");
    expect(compareVersions("7.4.9", "7.4.23")).toBeLessThan(0);
    expect(compareVersions("7.4.23", "7.4.23")).toBe(0);
  });
});

describe("symfony.com data parsing", () => {
  it("reads month-level dates without inventing days", () => {
    expect(parseSymfonyMonth("11/2028")).toBe("2028-11");
    expect(parseSymfonyMonth("13/2028")).toBeNull();
    expect(parseSymfonyMonth("soon")).toBeNull();
    expect(formatSymfonyMonth("2028-11")).toBe("November 2028");
  });
  it("rejects a releases file without supported versions", () => {
    expect(() => parseSymfonyReleases({})).toThrow();
  });
  it("parses a branch file", () => {
    const info = parseSymfonyBranch({ branch: "7.4", latest_patch_version: "7.4.23", is_lts: true, eom: "11/2028", eol: "11/2029", is_eomed: false, is_eoled: false }, "7.4");
    expect(info).toMatchObject({ latestPatch: "7.4.23", isLts: true, eom: "2028-11", eol: "2029-11" });
    expect(parseSymfonyBranch({}, "9.9")).toBeNull();
  });
});

describe("Symfony support state", () => {
  const base = { branch: "x", releaseDate: null, latestPatch: null, isLts: false, eom: "2028-11", eol: "2029-11", isEomed: false, isEoled: false };
  it("uses symfony.com flags first", () => {
    expect(symfonySupportState("7.4", RELEASES, base).state).toBe("active");
    expect(symfonySupportState("5.4", RELEASES, { ...base, isEomed: true }).state).toBe("security");
    expect(symfonySupportState("4.4", RELEASES, { ...base, isEomed: true, isEoled: true }).state).toBe("eol");
  });
  it("falls back to the maintained lists", () => {
    expect(symfonySupportState("8.2", RELEASES, null).state).toBe("active");
    expect(symfonySupportState("5.4", RELEASES, null).state).toBe("security");
    expect(symfonySupportState("4.4", RELEASES, null).state).toBe("eol");
    expect(symfonySupportState("9.9", RELEASES, null).state).toBe("unknown");
  });
});
