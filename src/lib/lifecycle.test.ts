import { describe, expect, it } from "vitest";
import { computeSupportDates, parseEolHtml, parseSupportedVersionsHtml, supportStateOn } from "@/lib/lifecycle";

describe("PHP support schedule", () => {
  it("matches the published 8.4 and pre-8.1 windows", () => {
    expect(computeSupportDates("8.4", "2024-11-21")).toEqual({
      activeSupportEnd: "2026-12-31",
      securitySupportEnd: "2028-12-31",
    });
    expect(computeSupportDates("8.0", "2020-11-26")).toEqual({
      activeSupportEnd: "2022-11-26",
      securitySupportEnd: "2023-11-26",
    });
  });

  it("uses an override and classifies end of life from the date", () => {
    const dates = computeSupportDates("5.6", "2014-08-28", { stable: "2017-01-19", security: "2018-12-31" });
    expect(dates.securitySupportEnd).toBe("2018-12-31");
    expect(supportStateOn("2026-10-23", dates)).toBe("eol");
    expect(supportStateOn("2026-10-23", computeSupportDates("8.4", "2024-11-21"))).toBe("active");
  });

  it("parses the supported-versions and end-of-life tables", () => {
    const supported = parseSupportedVersionsHtml(`
      <tr class="stable">
        <td><a href="/downloads.php?version=8.4">8.4</a></td>
        <td>21 Nov 2024</td>
        <td class="collapse-phone"><em>ago</em></td>
        <td>31 Dec 2026</td>
        <td class="collapse-phone"><em>soon</em></td>
        <td>31 Dec 2028</td>
      </tr>
    `);
    expect(supported[0]).toMatchObject({
      branch: "8.4",
      state: "active",
      initialReleaseDate: "2024-11-21",
      activeSupportEnd: "2026-12-31",
      securitySupportEnd: "2028-12-31",
    });

    const eol = parseEolHtml(`
      <tr>
        <td>8.1</td>
        <td>31 Dec 2025<br/><em>ago</em></td>
        <td><a href="/releases#8.1.34">8.1.34</a></td>
      </tr>
    `);
    expect(eol[0]).toMatchObject({
      branch: "8.1",
      state: "eol",
      securitySupportEnd: "2025-12-31",
      latestPatch: "8.1.34",
    });
  });
});
