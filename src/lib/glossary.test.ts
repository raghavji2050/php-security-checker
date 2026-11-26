import { describe, expect, it } from "vitest";
import { GLOSSARY, glossaryJsonLd } from "./glossary";
import { NAV_GROUPS } from "./nav";

describe("glossary", () => {
  it("has unique, url-safe ids", () => {
    const ids = GLOSSARY.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/);
  });

  it("covers the core terms used on the site", () => {
    const ids = GLOSSARY.map((t) => t.id);
    for (const id of ["cve", "cvss", "kev", "epss", "eol", "backport"]) expect(ids).toContain(id);
  });

  it("only links to https official sources and existing internal pages", () => {
    const internal = new Set(NAV_GROUPS.flatMap((g) => g.links.map((l) => l.href)));
    for (const t of GLOSSARY) {
      expect(t.source.href.startsWith("https://")).toBe(true);
      expect(t.definition.length).toBeGreaterThan(20);
      expect(t.inPractice.length).toBeGreaterThan(20);
      if (t.related) expect(internal.has(t.related.href)).toBe(true);
    }
  });

  it("builds DefinedTermSet JSON-LD with anchors", () => {
    const ld = glossaryJsonLd("https://example.test");
    expect(ld["@type"]).toBe("DefinedTermSet");
    expect(ld.hasDefinedTerm).toHaveLength(GLOSSARY.length);
    expect(ld.hasDefinedTerm[0].url).toBe("https://example.test/glossary#cve");
  });
});
