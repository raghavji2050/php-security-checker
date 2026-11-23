import { describe, expect, it } from "vitest";
import { embedSnippets, statusWidgetSvg, widgetBranches } from "@/lib/status-widget";
import type { PhpBranch } from "@/lib/types";

const b = (branch: string, state: PhpBranch["state"], latestPatch: string | null = null): PhpBranch => ({
  branch, state, latestPatch, initialReleaseDate: null, activeSupportEnd: null, securitySupportEnd: null, releases: [],
});

describe("status widget", () => {
  const data = [b("7.4", "eol"), b("8.1", "security", "8.1.34"), b("8.3", "active", "8.3.30"), b("8.0", "eol"), b("8.2", "security")];

  it("lists supported branches newest first plus the newest EOL branch", () => {
    expect(widgetBranches(data).map((x) => x.branch)).toEqual(["8.3", "8.2", "8.1", "8.0"]);
  });

  it("renders states, patches and escapes text", () => {
    const svg = statusWidgetSvg(data, "2026-11-23T01:00:00Z");
    expect(svg).toContain("PHP 8.3");
    expect(svg).toContain("Active support");
    expect(svg).toContain("Security fixes only");
    expect(svg).toContain("End of life");
    expect(svg).toContain("latest 8.1.34");
    expect(svg).toContain("2026-11-23");
    expect(statusWidgetSvg([b("<x>", "active")], null)).toContain("PHP &lt;x&gt;");
  });

  it("does not invent data when there are no branches", () => {
    expect(statusWidgetSvg([], null)).toContain("Unable to load branch data");
  });

  it("builds snippets", () => {
    const s = embedSnippets("https://example.com");
    expect(s.html).toContain("https://example.com/api/widget/php-status");
    expect(s.markdown).toContain("(https://example.com/php-versions)");
  });
});
