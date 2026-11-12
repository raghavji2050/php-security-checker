import { describe, expect, it } from "vitest";
import { formatPercentile, formatProbability, parseEpss } from "@/lib/epss";

describe("parseEpss", () => {
  it("reads valid rows and drops bad ones", () => {
    const parsed = parseEpss({
      status: "OK",
      data: [
        { cve: "CVE-2019-11043", epss: "0.997830000", percentile: "0.999560000", date: "2026-11-10" },
        { cve: "CVE-2024-1", epss: "0.5", percentile: "0.5" },
        { cve: "CVE-2024-4577", epss: "1.7", percentile: "0.9" },
        { cve: "CVE-2023-3824", epss: "abc", percentile: "0.9" },
        null,
      ],
    });
    expect(Object.keys(parsed)).toEqual(["CVE-2019-11043"]);
    expect(parsed["CVE-2019-11043"]).toEqual({ cveId: "CVE-2019-11043", epss: 0.99783, percentile: 0.99956, date: "2026-11-10" });
  });

  it("returns nothing for junk payloads", () => {
    expect(parseEpss(null)).toEqual({});
    expect(parseEpss({ data: "x" })).toEqual({});
  });
});

describe("formatting", () => {
  it("formats probability", () => {
    expect(formatProbability(0.99783)).toBe("99.8%");
    expect(formatProbability(0.0123)).toBe("1.23%");
    expect(formatProbability(0.00001)).toBe("<0.01%");
    expect(formatProbability(0)).toBe("0.00%");
  });
  it("formats percentile as top N%", () => {
    expect(formatPercentile(0.99956)).toBe("top 1%");
    expect(formatPercentile(0.874)).toBe("top 13%");
  });
});
