import { describe, expect, it } from "vitest";
import { allowsBranch, allowsNewerThan, extractConstraint, parsePhpConstraint } from "@/lib/php-constraint";

const BRANCHES = ["7.4", "8.0", "8.1", "8.2", "8.3", "8.4", "8.5"];

function allowed(c: string): string[] {
  const p = parsePhpConstraint(c);
  if (!p.ok) throw new Error(p.error);
  return BRANCHES.filter((b) => allowsBranch(p.intervals, b));
}

describe("parsePhpConstraint", () => {
  it.each([
    ["^8.1", ["8.1", "8.2", "8.3", "8.4", "8.5"]],
    ["^7.4 || ^8.0", BRANCHES],
    ["^7.4|^8.0", BRANCHES],
    ["~8.2.0", ["8.2"]],
    ["~8.2", ["8.2", "8.3", "8.4", "8.5"]],
    [">=8.1 <8.3", ["8.1", "8.2"]],
    [">=8.1, <8.3", ["8.1", "8.2"]],
    [">= 8.1 < 8.3", ["8.1", "8.2"]],
    ["8.2.*", ["8.2"]],
    ["8.x", ["8.0", "8.1", "8.2", "8.3", "8.4", "8.5"]],
    ["*", BRANCHES],
    ["8.1 - 8.3", ["8.1", "8.2", "8.3"]],
    ["8.1.0 - 8.3.0", ["8.1", "8.2", "8.3"]],
    [">8.4", ["8.4", "8.5"]],
    ["<8.0", ["7.4"]],
    ["8.3.12", ["8.3"]],
    ["^8.2@dev", ["8.2", "8.3", "8.4", "8.5"]],
    ["!=8.0.0", BRANCHES],
  ])("%s", (c, expected) => {
    expect(allowed(c)).toEqual(expected);
  });

  it("rejects junk", () => {
    expect(parsePhpConstraint("").ok).toBe(false);
    expect(parsePhpConstraint("latest").ok).toBe(false);
    expect(parsePhpConstraint(">=abc").ok).toBe(false);
    expect(parsePhpConstraint("^*").ok).toBe(false);
  });

  it("flags constraints that allow future branches", () => {
    const open = parsePhpConstraint(">=8.1");
    const closed = parsePhpConstraint(">=8.1 <8.6");
    expect(open.ok && allowsNewerThan(open.intervals, "8.5")).toBe(true);
    expect(closed.ok && allowsNewerThan(closed.intervals, "8.5")).toBe(false);
  });
});

describe("extractConstraint", () => {
  it("reads a composer.json require line", () => {
    expect(extractConstraint('"php": "^8.1",')).toBe("^8.1");
    expect(extractConstraint('{"require": {"php": ">=8.2", "ext-json": "*"}}')).toBe(">=8.2");
    expect(extractConstraint('  "^8.3"  ')).toBe("^8.3");
  });
});
