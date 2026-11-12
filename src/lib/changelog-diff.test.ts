import { describe, expect, it } from "vitest";
import { changelogDiff, idsByVersion } from "@/lib/changelog-diff";

const index = { "CVE-2024-1": ["8.3.11", "8.2.23"], "CVE-2024-2": ["8.3.12"], "GHSA-aaaa-bbbb-cccc": ["8.3.12"], "CVE-2024-3": ["8.3.9"] };
const releases = ["8.3.9", "8.3.10", "8.3.11", "8.3.12", "8.3.13", "8.2.23"];

describe("idsByVersion", () => {
  it("inverts the index", () => {
    expect(idsByVersion(index)["8.3.12"]).toEqual(["CVE-2024-2", "GHSA-aaaa-bbbb-cccc"]);
  });
});

describe("changelogDiff", () => {
  it("lists releases after from up to and including to", () => {
    const d = changelogDiff("8.3.10", "8.3.13", index, releases);
    expect(d.ok && d.releases.map((r) => r.version)).toEqual(["8.3.11", "8.3.12", "8.3.13"]);
    expect(d.ok && d.securityIds).toEqual(["CVE-2024-1", "CVE-2024-2", "GHSA-aaaa-bbbb-cccc"]);
    expect(d.ok && d.releases[2].securityIds).toEqual([]);
  });
  it("rejects cross-branch, reversed, bad and unknown versions", () => {
    expect(changelogDiff("8.2.1", "8.3.1", index, releases).ok).toBe(false);
    expect(changelogDiff("8.3.12", "8.3.10", index, releases).ok).toBe(false);
    expect(changelogDiff("8.3", "8.3.12", index, releases).ok).toBe(false);
    expect(changelogDiff("8.3.10", "8.3.99", index, releases).ok).toBe(false);
  });
});
