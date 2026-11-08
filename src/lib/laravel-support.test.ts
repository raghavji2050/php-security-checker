import { describe, expect, it } from "vitest";
import {
  laravelSupportState,
  normalizeLaravelVersion,
  parseLaravelDocsDate,
  parseLaravelSupportTable,
} from "@/lib/laravel-support";

const TABLE = `
| Version | PHP (*)   | Release             | Bug Fixes Until     | Security Fixes Until |
| ------- |-----------| ------------------- | ------------------- | -------------------- |
| 11      | 8.2 - 8.4 | March 12th, 2024    | September 3rd, 2025 | March 12th, 2026     |
| 13      | 8.3 - 8.5 | March 17th, 2026    | Q3 2027             | March 17th, 2028     |
`;

describe("Laravel support table", () => {
  it("accepts a full stable version and rejects a branch", () => {
    expect(normalizeLaravelVersion("v11.31.0")).toBe("11.31.0");
    expect(normalizeLaravelVersion("11")).toBeNull();
    expect(normalizeLaravelVersion("11.31.0-RC1")).toBeNull();
  });

  it("parses exact dates and leaves quarters unparsed", () => {
    expect(parseLaravelDocsDate("March 12th, 2026")).toBe("2026-03-12");
    expect(parseLaravelDocsDate("Q3 2027")).toBeNull();
    expect(parseLaravelDocsDate("February 31st, 2026")).toBeNull();
  });

  it("reads the official table without inventing a day for Q3", () => {
    const rows = parseLaravelSupportTable(TABLE);
    expect(rows.map((row) => row.major)).toEqual([11, 13]);
    expect(rows[1].bugFixesDate).toBeNull();
    expect(rows[1].bugFixesText).toBe("Q3 2027");
    expect(laravelSupportState(rows[0], "2026-11-08").state).toBe("eol");
    expect(laravelSupportState(rows[1], "2026-11-08").state).toBe("unknown");
    expect(laravelSupportState(rows[1], "2026-11-08").detail).toMatch(/Q3 2027/);
  });
});
