/**
 * Paid follow-ups shown under a generated /audit report.
 * Leave a URL empty to hide that offer. Do not invent prices, stats or testimonials.
 */
export const TOPMATE_CODE_REVIEW_URL = "https://topmate.io/raghavji/2387784";
export const TOPMATE_CODE_REVIEW_PRICE = "₹299";
export const FREELANCE_AUDIT_CONTACT_URL = "https://www.linkedin.com/in/jiraghav";

export type AuditOffer = {
  id: "code-review" | "freelance-audit";
  href: string;
  title: string;
  detail: string;
  cta: string;
};

export function auditOffers(urls?: { codeReview?: string; freelanceAudit?: string }): AuditOffer[] {
  const codeReview = urls?.codeReview ?? TOPMATE_CODE_REVIEW_URL;
  const freelanceAudit = urls?.freelanceAudit ?? FREELANCE_AUDIT_CONTACT_URL;
  const offers: AuditOffer[] = [];

  if (codeReview) {
    offers.push({
      id: "code-review",
      href: codeReview,
      title: `Code review (${TOPMATE_CODE_REVIEW_PRICE})`,
      detail: "A 45-minute live review of a Laravel or PHP repository or pull request, booked on Topmate.",
      cta: "Book on Topmate",
    });
  }

  if (freelanceAudit) {
    offers.push({
      id: "freelance-audit",
      href: freelanceAudit,
      title: "Freelance PHP/Laravel security audit",
      detail: "If you need a fuller review of an application or server than this free summary, get in touch on LinkedIn.",
      cta: "Message on LinkedIn",
    });
  }

  return offers;
}
