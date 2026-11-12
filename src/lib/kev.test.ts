import { describe, expect, it } from "vitest";
import { parseKevCatalog, pickKev } from "@/lib/kev";

const feed = {
  catalogVersion: "2026.11.10",
  dateReleased: "2026-11-10T19:03:29.8375Z",
  vulnerabilities: [
    {
      cveID: "CVE-2019-11043",
      vendorProject: "PHP",
      product: "FastCGI Process Manager (FPM)",
      vulnerabilityName: "PHP FastCGI Process Manager (FPM) Buffer Overflow Vulnerability",
      dateAdded: "2022-03-25",
      dueDate: "2022-04-15",
      knownRansomwareCampaignUse: "Known",
      requiredAction: "Apply updates per vendor instructions.",
    },
    { cveID: "not-a-cve", dateAdded: "2022-03-25" },
    { cveID: "cve-2012-1823", dateAdded: "bad", knownRansomwareCampaignUse: "Maybe" },
    null,
  ],
};

describe("parseKevCatalog", () => {
  it("indexes valid entries by upper-case CVE ID", () => {
    const catalog = parseKevCatalog(feed);
    expect(catalog.version).toBe("2026.11.10");
    expect(Object.keys(catalog.entries).sort()).toEqual(["CVE-2012-1823", "CVE-2019-11043"]);
    expect(catalog.entries["CVE-2019-11043"]).toMatchObject({ dateAdded: "2022-03-25", dueDate: "2022-04-15", ransomware: "Known" });
  });

  it("drops invalid dates and unknown ransomware values instead of guessing", () => {
    const entry = parseKevCatalog(feed).entries["CVE-2012-1823"];
    expect(entry.dateAdded).toBeNull();
    expect(entry.ransomware).toBeNull();
    expect(entry.name).toBeNull();
  });

  it("returns an empty catalog for malformed payloads", () => {
    expect(parseKevCatalog(null).entries).toEqual({});
    expect(parseKevCatalog({ vulnerabilities: "x" }).entries).toEqual({});
  });
});

describe("pickKev", () => {
  it("keeps only the requested IDs that are listed", () => {
    const picked = pickKev(parseKevCatalog(feed), ["cve-2019-11043", "CVE-2024-0001"]);
    expect(Object.keys(picked)).toEqual(["CVE-2019-11043"]);
  });
});
