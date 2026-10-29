import { describe, expect, it } from "vitest";
import { faqJsonLd, jsonLdString } from "@/lib/faq";
import { buildLlmsTxt } from "@/lib/llms";

describe("llms.txt and FAQ structured data", () => {
  it("lists the key URLs", () => {
    const text = buildLlmsTxt();
    expect(text.startsWith("# PHP Security Checker\n")).toBe(true);
    expect(text).toContain("/check/8.1.12");
    expect(text).toContain("/api/check?v=8.1.12");
    expect(text).toContain("/openapi.json");
  });

  it("builds a FAQPage with question and answer text", () => {
    const data = faqJsonLd();
    expect(data["@type"]).toBe("FAQPage");
    expect(data.mainEntity.length).toBeGreaterThan(3);
    for (const entry of data.mainEntity) {
      expect(entry.name.length).toBeGreaterThan(0);
      expect(entry.acceptedAnswer.text.length).toBeGreaterThan(0);
    }
  });

  it("escapes < so JSON-LD cannot close its script tag", () => {
    expect(jsonLdString({ a: "</script>" })).not.toContain("</script>");
  });
});
