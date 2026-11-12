import { describe, expect, it } from "vitest";
import { branchesFaq, faqPageJsonLd, versionFaq } from "@/lib/page-faq";
import type { CheckResult, PhpBranch } from "@/lib/types";

const result = (over: Partial<CheckResult>): CheckResult =>
  ({
    version: "8.1.12",
    securityStatus: "vulnerable",
    counts: { confirmed: 3, critical: 1, high: 1, medium: 1, low: 0, potential: 0 },
    support: { branch: "8.1", label: "End of life", securitySupportEnd: "2025-12-31" },
    minimumFixedVersion: "8.1.33",
    recommendedVersion: "8.5.12",
    ...over,
  }) as unknown as CheckResult;

const b = (branch: string, state: PhpBranch["state"], sec: string | null, latest: string | null): PhpBranch => ({
  branch, state, securitySupportEnd: sec, latestPatch: latest, initialReleaseDate: null, activeSupportEnd: null, releases: [],
});

describe("versionFaq", () => {
  it("answers from report numbers", () => {
    const faq = versionFaq(result({}));
    expect(faq[0].answer).toContain("Yes. 3 confirmed");
    expect(faq[1].answer).toContain("Security support ends 2025-12-31");
    expect(faq[2].answer).toContain("PHP 8.1.33");
  });
  it("does not claim safe or vulnerable when unverified", () => {
    const faq = versionFaq(result({ securityStatus: "unable_to_verify", minimumFixedVersion: null, recommendedVersion: null }));
    expect(faq[0].answer).toContain("could not be verified");
    expect(faq).toHaveLength(2);
  });
});

describe("branchesFaq", () => {
  it("lists supported branches and the next end of life", () => {
    const faq = branchesFaq([b("8.1", "eol", "2025-12-31", "8.1.33"), b("8.2", "security", "2026-12-31", "8.2.35"), b("8.5", "active", "2029-12-31", "8.5.12")]);
    expect(faq[0].answer).toContain("PHP 8.5 (active support");
    expect(faq[0].answer).not.toContain("8.1");
    expect(faq[1].answer).toContain("PHP 8.5.12");
    expect(faq[2].answer).toBe("PHP 8.2 stops getting security fixes on 2026-12-31.");
    expect(faq[3].answer).toBe("PHP 8.5 is in active support.");
  });
  it("returns nothing without data", () => {
    expect(branchesFaq([])).toEqual([]);
  });
  it("builds FAQPage JSON-LD", () => {
    expect(faqPageJsonLd([{ question: "q", answer: "a" }]).mainEntity[0]).toEqual({ "@type": "Question", name: "q", acceptedAnswer: { "@type": "Answer", text: "a" } });
  });
});
