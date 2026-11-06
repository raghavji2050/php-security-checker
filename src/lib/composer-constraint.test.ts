import { describe, expect, it } from "vitest";
import {
  compareComposerVersions,
  parseComposerVersion,
  suggestedFixedVersions,
  versionSatisfies,
} from "@/lib/composer-constraint";

describe("parseComposerVersion", () => {
  it("parses plain and v-prefixed versions", () => {
    expect(parseComposerVersion("1.2.3")?.numbers).toEqual([1, 2, 3]);
    expect(parseComposerVersion("v2.4.0")?.numbers).toEqual([2, 4, 0]);
    expect(parseComposerVersion("1.2.3.0")?.numbers).toEqual([1, 2, 3, 0]);
  });

  it("rejects branch-like versions", () => {
    expect(parseComposerVersion("dev-main")).toBeNull();
    expect(parseComposerVersion("")).toBeNull();
  });
});

describe("versionSatisfies", () => {
  it("matches Packagist-style OR of AND ranges", () => {
    expect(versionSatisfies("2.4.0", "<2.12.3")).toBe(true);
    expect(versionSatisfies("2.12.3", "<2.12.3")).toBe(false);
    expect(versionSatisfies("2.72.0", "<2.72.6|>=3.0.0,<3.8.4")).toBe(true);
    expect(versionSatisfies("3.8.0", "<2.72.6|>=3.0.0,<3.8.4")).toBe(true);
    expect(versionSatisfies("3.8.4", "<2.72.6|>=3.0.0,<3.8.4")).toBe(false);
    expect(versionSatisfies("5.4.50", ">=5.4.0,<5.4.56|>=6.0.0,<6.0.20")).toBe(true);
    expect(versionSatisfies("5.4.56", ">=5.4.0,<5.4.56|>=6.0.0,<6.0.20")).toBe(false);
  });

  it("handles equality and inequality", () => {
    expect(versionSatisfies("1.0.0", "=1.0.0")).toBe(true);
    expect(versionSatisfies("1.0.1", "!=1.0.0")).toBe(true);
  });
});

describe("suggestedFixedVersions", () => {
  it("returns exclusive upper bounds of matching groups", () => {
    expect(suggestedFixedVersions("2.4.0", "<2.12.3")).toEqual(["2.12.3"]);
    expect(suggestedFixedVersions("5.4.50", ">=5.4.0,<5.4.56|>=6.0.0,<6.0.20")).toEqual(["5.4.56"]);
    expect(suggestedFixedVersions("6.0.10", ">=5.4.0,<5.4.56|>=6.0.0,<6.0.20")).toEqual(["6.0.20"]);
  });
});

describe("compareComposerVersions", () => {
  it("orders by numeric core then stability", () => {
    const a = parseComposerVersion("1.2.3")!;
    const b = parseComposerVersion("1.2.4")!;
    expect(compareComposerVersions(a, b)).toBeLessThan(0);
    const rc = parseComposerVersion("1.2.3-RC1")!;
    expect(compareComposerVersions(rc, a)).toBeLessThan(0);
  });
});
