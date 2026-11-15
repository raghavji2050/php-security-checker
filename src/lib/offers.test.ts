import { describe, expect, it } from "vitest";
import {
  TOPMATE_CODE_REVIEW_PRICE,
  TOPMATE_CODE_REVIEW_URL,
  TOPMATE_LARAVEL_AUDIT_PRICE,
  TOPMATE_LARAVEL_AUDIT_URL,
  auditOffers,
} from "@/lib/offers";

describe("auditOffers", () => {
  it("includes the live Topmate code review and Laravel audit listings when URLs are set", () => {
    const offers = auditOffers();
    expect(offers).toHaveLength(2);
    expect(offers[0]).toMatchObject({
      id: "code-review",
      href: TOPMATE_CODE_REVIEW_URL,
      title: `Code review (${TOPMATE_CODE_REVIEW_PRICE})`,
      cta: "Book a 45-minute review",
    });
    expect(offers[0].href).toBe("https://topmate.io/raghavji/2387784");
    expect(offers[1]).toMatchObject({
      id: "freelance-audit",
      href: TOPMATE_LARAVEL_AUDIT_URL,
      title: `Laravel security audit (${TOPMATE_LARAVEL_AUDIT_PRICE})`,
      cta: "Book a Laravel audit",
    });
    expect(offers[1].href).toBe("https://topmate.io/raghavji/2405744");
  });

  it("hides an offer when its URL is empty", () => {
    expect(auditOffers({ codeReview: "", freelanceAudit: "" })).toEqual([]);
    expect(auditOffers({ codeReview: "", freelanceAudit: "https://topmate.io/raghavji/2405744" })).toEqual([
      expect.objectContaining({ id: "freelance-audit" }),
    ]);
    expect(auditOffers({ codeReview: "https://topmate.io/raghavji/2387784", freelanceAudit: "" })).toEqual([
      expect.objectContaining({ id: "code-review" }),
    ]);
  });
});
