import { describe, expect, it } from "vitest";
import {
  FREELANCE_AUDIT_CONTACT_URL,
  TOPMATE_CODE_REVIEW_PRICE,
  TOPMATE_CODE_REVIEW_URL,
  auditOffers,
} from "@/lib/offers";

describe("auditOffers", () => {
  it("includes the live Topmate code review and Topmate profile audit enquiry when URLs are set", () => {
    const offers = auditOffers();
    expect(offers).toHaveLength(2);
    expect(offers[0]).toMatchObject({
      id: "code-review",
      href: TOPMATE_CODE_REVIEW_URL,
      title: `Code review (${TOPMATE_CODE_REVIEW_PRICE})`,
    });
    expect(offers[0].href).toBe("https://topmate.io/raghavji/2387784");
    expect(offers[1]).toMatchObject({
      id: "freelance-audit",
      href: FREELANCE_AUDIT_CONTACT_URL,
    });
    expect(offers[1].href).toBe("https://topmate.io/raghavji");
  });

  it("hides an offer when its URL is empty", () => {
    expect(auditOffers({ codeReview: "", freelanceAudit: "" })).toEqual([]);
    expect(auditOffers({ codeReview: "", freelanceAudit: "https://topmate.io/raghavji" })).toEqual([
      expect.objectContaining({ id: "freelance-audit" }),
    ]);
    expect(auditOffers({ codeReview: "https://topmate.io/raghavji/2387784", freelanceAudit: "" })).toEqual([
      expect.objectContaining({ id: "code-review" }),
    ]);
  });
});
