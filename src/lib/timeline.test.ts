import { describe, expect, it } from "vitest";
import { buildTimeline, stateCounts } from "@/lib/timeline";
import type { PhpBranch } from "@/lib/types";

// Synthetic fixtures only (not real php.net dates).
const branch = (b: string, init: string | null, active: string | null, sec: string | null, state: PhpBranch["state"]): PhpBranch => ({
  branch: b,
  initialReleaseDate: init,
  activeSupportEnd: active,
  securitySupportEnd: sec,
  state,
  latestPatch: `${b}.1`,
  releases: [],
});

const data = [
  branch("1.0", "2010-01-01", "2012-01-01", "2013-01-01", "eol"),
  branch("2.0", "2020-01-01", "2022-01-01", "2024-01-01", "eol"),
  branch("3.0", "2022-01-01", "2024-01-01", "2026-01-01", "security"),
  branch("4.0", "2024-01-01", "2026-01-01", "2028-01-01", "active"),
  branch("5.0", null, null, null, "unknown"),
];

describe("buildTimeline", () => {
  it("drops old and undated branches and sorts newest first", () => {
    const t = buildTimeline(data, "2025-06-01", 2015)!;
    expect(t.rows.map((r) => r.branch)).toEqual(["4.0", "3.0", "2.0"]);
    expect(t.start).toBe("2020-01-01");
    expect(t.end).toBe("2029-01-01");
  });

  it("places segments in percent of the range", () => {
    const t = buildTimeline(data, "2025-06-01", 2015)!;
    const two = t.rows.find((r) => r.branch === "2.0")!;
    expect(two.active.left).toBe(0);
    expect(two.active.width).toBeGreaterThan(20);
    expect(two.security.left).toBeCloseTo(two.active.left + two.active.width, 1);
    expect(t.today).toBeGreaterThan(50);
    expect(t.today).toBeLessThan(70);
    expect(t.years[0]).toEqual({ year: 2020, left: 0 });
    expect(t.years.at(-1)).toEqual({ year: 2029, left: 100 });
  });

  it("returns null when nothing is drawable", () => {
    expect(buildTimeline([branch("5.0", null, null, null, "unknown")], "2025-01-01")).toBeNull();
  });
});

describe("stateCounts", () => {
  it("counts each support state", () => {
    expect(stateCounts(data)).toEqual({ active: 1, security: 1, eol: 2, unknown: 1 });
  });
});
