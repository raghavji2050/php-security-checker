import { describe, expect, it } from "vitest";
import { interpretStableCheck, normalizeWordPressVersion, wordpressStatusCopy } from "@/lib/wordpress-status";

describe("WordPress stable-check", () => {
  const map = { "6.4.2": "outdated", "6.8.1": "latest", "6.4.1": "insecure" };

  it("keeps only official status labels", () => {
    expect(normalizeWordPressVersion("6.4.2")).toBe("6.4.2");
    expect(normalizeWordPressVersion("latest")).toBeNull();
    expect(interpretStableCheck(map, "6.4.1")).toMatchObject({ listed: true, status: "insecure", latest: ["6.8.1"] });
    expect(interpretStableCheck(map, "9.9.9").listed).toBe(false);
    expect(wordpressStatusCopy("insecure", true)).not.toMatch(/CVE-/);
    expect(wordpressStatusCopy(null, false)).toMatch(/not a claim/i);
  });
});
