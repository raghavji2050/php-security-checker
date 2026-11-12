import { describe, expect, it } from "vitest";
import type { ExplorerRow } from "@/lib/cve-explorer";
import { relatedCves } from "@/lib/related-cves";

function row(id: string, branches: string[], year: number, score: number | null): ExplorerRow {
  return { id, year, published: `${year}-01-01`, description: "", severity: score === null ? "UNRATED" : "HIGH", score, cvssVersion: null, branches, checkVersions: [] };
}

describe("relatedCves", () => {
  const target = row("CVE-2024-0001", ["8.1", "8.2"], 2024, 7.5);
  const rows = [
    target,
    row("CVE-2024-0002", ["8.2"], 2024, 5.0),
    row("CVE-2023-0003", ["8.1", "8.2"], 2023, 9.8),
    row("CVE-2024-0004", ["7.4"], 2024, 9.8),
    row("CVE-2024-0005", ["8.1"], 2024, 9.0),
  ];

  it("skips itself and CVEs with no shared branch", () => {
    const ids = relatedCves(target, rows).map((r) => r.id);
    expect(ids).not.toContain("CVE-2024-0001");
    expect(ids).not.toContain("CVE-2024-0004");
  });

  it("orders by shared branches, then same year, then score", () => {
    expect(relatedCves(target, rows).map((r) => r.id)).toEqual(["CVE-2023-0003", "CVE-2024-0005", "CVE-2024-0002"]);
  });

  it("returns nothing when the target has no known branches", () => {
    expect(relatedCves(row("CVE-2024-0009", [], 2024, 5), rows)).toEqual([]);
  });

  it("respects the limit", () => {
    expect(relatedCves(target, rows, 1)).toHaveLength(1);
  });
});
