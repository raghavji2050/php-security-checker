import { describe, expect, it } from "vitest";
import { buildIcs, fold, icsText, supportEvents } from "@/lib/ics";
import type { PhpBranch } from "@/lib/types";

const branch = (b: string, active: string | null, security: string | null): PhpBranch => ({
  branch: b, initialReleaseDate: null, activeSupportEnd: active, securitySupportEnd: security, state: "active", latestPatch: null, releases: [],
});

describe("supportEvents", () => {
  it("keeps only dates from today on, sorted", () => {
    const events = supportEvents([branch("8.4", "2026-12-31", "2028-12-31"), branch("8.2", "2024-12-31", "2026-12-31"), branch("8.0", "2022-11-26", "2023-11-26")], "2026-11-12");
    expect(events.map((e) => e.uid)).toEqual(["php-8.2-security-end", "php-8.4-active-end", "php-8.4-security-end"]);
  });
});

describe("buildIcs", () => {
  it("writes all-day events with CRLF line ends", () => {
    const ics = buildIcs(supportEvents([branch("8.2", null, "2026-12-31")], "2026-11-12"), { siteUrl: "https://example.test", stamp: "2026-11-12T05:30:00.000Z" });
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("DTSTART;VALUE=DATE:20261231\r\n");
    expect(ics).toContain("DTEND;VALUE=DATE:20270101\r\n");
    expect(ics).toContain("UID:php-8.2-security-end@example.test");
    expect(ics).toContain("DTSTAMP:20261112T053000Z");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });
  it("escapes text and folds long lines", () => {
    expect(icsText("a,b;c\nd")).toBe("a\\,b\\;c\\nd");
    const folded = fold("x".repeat(160));
    expect(folded.split("\r\n").every((l) => l.length <= 76)).toBe(true);
  });
});
