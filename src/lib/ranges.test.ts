import { describe, expect, it } from "vitest";
import { makeRange, parseAffectedVersion, parseGithubRanges, parsePhpRuntimeCpe, versionInRange } from "@/lib/ranges";
import { parsePhpVersion } from "@/lib/version";

const version = (raw: string) => parsePhpVersion(raw)!;

describe("version ranges", () => {
  const range = makeRange(
    { version: version("8.1.0"), inclusive: true },
    { version: version("8.1.29"), inclusive: false },
    "8.1",
    "precise",
  );

  it("includes the start and excludes the end", () => {
    expect(versionInRange(version("8.1.0"), range)).toBe(true);
    expect(versionInRange(version("8.1.28"), range)).toBe(true);
    expect(versionInRange(version("8.1.29"), range)).toBe(false);
    expect(versionInRange(version("8.2.0"), range)).toBe(false);
  });

  it("honors an exclusive start and an inclusive end", () => {
    const flipped = makeRange(
      { version: version("8.3.0"), inclusive: false },
      { version: version("8.3.6"), inclusive: true },
      null,
      "precise",
    );
    expect(versionInRange(version("8.3.0"), flipped)).toBe(false);
    expect(versionInRange(version("8.3.1"), flipped)).toBe(true);
    expect(versionInRange(version("8.3.6"), flipped)).toBe(true);
    expect(versionInRange(version("8.3.7"), flipped)).toBe(false);
  });

  it("does not treat a missing bound pair as a match", () => {
    const open = makeRange(null, null, null, "broad");
    expect(versionInRange(version("8.1.12"), open)).toBe(false);
  });
});

describe("affected version parsing", () => {
  it("reads structured branch wildcards with an exclusive upper bound", () => {
    const [range] = parseAffectedVersion({ version: "8.4.*", lessThan: "8.4.27", status: "affected" });
    expect(range.precision).toBe("precise");
    expect(versionInRange(version("8.4.26"), range)).toBe(true);
    expect(versionInRange(version("8.4.27"), range)).toBe(false);
    expect(versionInRange(version("8.1.12"), range)).toBe(false);
  });

  it("reads prose ranges without turning them into an unbounded match", () => {
    const [range] = parseAffectedVersion({ version: "7.1.x below 7.1.31", status: "affected" });
    expect(versionInRange(version("7.1.30"), range)).toBe(true);
    expect(versionInRange(version("8.5.12"), range)).toBe(false);
  });
});

describe("CPE and GitHub ranges", () => {
  it("ignores products that are not the PHP runtime", () => {
    expect(
      parsePhpRuntimeCpe({
        vulnerable: true,
        criteria: "cpe:2.3:a:php:phpmyadmin:5.2.0:*:*:*:*:*:*:*",
      }),
    ).toBeNull();
  });

  it("scopes several GitHub branch caps and leaves a single bare cap broad", () => {
    const scoped = parseGithubRanges([
      { vulnerable_version_range: "< 8.4.27" },
      { vulnerable_version_range: "< 8.5.12" },
    ]);
    expect(scoped).toHaveLength(2);
    expect(scoped.every((range) => range.precision === "precise")).toBe(true);
    expect(versionInRange(version("8.4.26"), scoped[0])).toBe(true);
    expect(versionInRange(version("8.1.12"), scoped[0])).toBe(false);

    const [single] = parseGithubRanges([{ vulnerable_version_range: "< 8.2.35" }]);
    expect(single.precision).toBe("broad");
    expect(versionInRange(version("8.2.34"), single)).toBe(true);
    expect(versionInRange(version("8.1.12"), single)).toBe(false);
  });
});
