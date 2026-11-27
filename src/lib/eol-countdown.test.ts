import { describe, expect, it } from "vitest";
import { buildEolCountdown, countdownLabel, daysBetween, migrationGuide } from "@/lib/eol-countdown";
import type { PhpBranch } from "@/lib/types";

// Synthetic fixtures only (not real php.net dates).
const branch = (b: string, sec: string | null): PhpBranch => ({
  branch: b,
  initialReleaseDate: null,
  activeSupportEnd: null,
  securitySupportEnd: sec,
  state: "unknown",
  latestPatch: `${b}.9`,
  releases: [],
});

const branches = [
  branch("7.4", "2022-11-28"),
  branch("8.0", "2026-10-01"),
  branch("8.1", "2027-01-31"),
  branch("8.2", "2027-11-30"),
  branch("8.3", null),
];

describe("daysBetween", () => {
  it("counts whole UTC days", () => {
    expect(daysBetween("2026-12-01", "2026-12-31")).toBe(30);
    expect(daysBetween("2026-12-31", "2026-12-01")).toBe(-30);
    expect(daysBetween("2026-03-28", "2026-03-30")).toBe(2);
  });
  it("returns NaN for bad input", () => {
    expect(daysBetween("nope", "2026-01-01")).toBeNaN();
  });
});

describe("migrationGuide", () => {
  it("links the php.net guide for the next known branch", () => {
    expect(migrationGuide("8.1", branches)).toEqual({
      label: "Migrating from PHP 8.1 to 8.2",
      url: "https://www.php.net/manual/en/migration82.php",
    });
    expect(migrationGuide("7.4", branches)?.url).toBe("https://www.php.net/manual/en/migration80.php");
  });
  it("returns null for the newest branch", () => {
    expect(migrationGuide("8.3", branches)).toBeNull();
  });
});

describe("buildEolCountdown", () => {
  it("keeps branches ending within the horizon or recently ended, soonest first", () => {
    const rows = buildEolCountdown(branches, "2026-11-01");
    expect(rows.map((r) => r.branch)).toEqual(["8.0", "8.1", "8.2"]);
    expect(rows[0].daysLeft).toBe(-31);
    expect(rows[1].daysLeft).toBe(91);
    expect(rows[1].migrationGuide?.url).toBe("https://www.php.net/manual/en/migration82.php");
  });
  it("drops long-dead branches, far-future ones and undated ones", () => {
    const rows = buildEolCountdown(branches, "2026-11-01", { horizonDays: 100, graceDays: 10 });
    expect(rows.map((r) => r.branch)).toEqual(["8.1"]);
  });
  it("is empty when nothing is close", () => {
    expect(buildEolCountdown([branch("9.0", "2040-01-01")], "2026-11-01")).toEqual([]);
  });
});

describe("countdownLabel", () => {
  it("reads naturally", () => {
    expect(countdownLabel(0)).toBe("Ends today");
    expect(countdownLabel(1)).toBe("1 day left");
    expect(countdownLabel(34)).toBe("34 days left");
    expect(countdownLabel(-1)).toBe("Ended 1 day ago");
    expect(countdownLabel(-5)).toBe("Ended 5 days ago");
  });
});
