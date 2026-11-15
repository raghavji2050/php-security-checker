/**
 * Paid follow-ups shown under a generated /audit report.
 * Leave a URL empty to hide that offer. Do not invent prices, stats or testimonials.
 */
export const TOPMATE_CODE_REVIEW_URL = "https://topmate.io/raghavji/2387784";
export const TOPMATE_CODE_REVIEW_PRICE = "₹299";
export const TOPMATE_LARAVEL_AUDIT_URL = "https://topmate.io/raghavji/2405744";
export const TOPMATE_LARAVEL_AUDIT_PRICE = "₹2,999";

export type AuditOffer = {
  id: "code-review" | "freelance-audit";
  href: string;
  title: string;
  detail: string;
  cta: string;
};

export function auditOffers(urls?: { codeReview?: string; freelanceAudit?: string }): AuditOffer[] {
  const codeReview = urls?.codeReview ?? TOPMATE_CODE_REVIEW_URL;
  const freelanceAudit = urls?.freelanceAudit ?? TOPMATE_LARAVEL_AUDIT_URL;
  const offers: AuditOffer[] = [];

  if (codeReview) {
    offers.push({
      id: "code-review",
      href: codeReview,
      title: `Code review (${TOPMATE_CODE_REVIEW_PRICE})`,
      detail:
        "Get a second pair of eyes on a Laravel or PHP repository or pull request, live for 45 minutes. Booked on Topmate.",
      cta: "Book a 45-minute review",
    });
  }

  if (freelanceAudit) {
    offers.push({
      id: "freelance-audit",
      href: freelanceAudit,
      title: `Laravel security audit (${TOPMATE_LARAVEL_AUDIT_PRICE})`,
      detail:
        "A written security report of a Laravel app, plus a 45-minute call to walk through the findings. Booked on Topmate.",
      cta: "Book a Laravel audit",
    });
  }

  return offers;
}
