import { describe, expect, it } from "vitest";
import { parseComposerLock, packagesToVersionMap } from "@/lib/composer-lock";

const lock = JSON.stringify({
  "content-hash": "abc",
  packages: [
    { name: "guzzlehttp/psr7", version: "2.4.0" },
    { name: "symfony/http-foundation", version: "v5.4.50" },
  ],
  "packages-dev": [{ name: "phpunit/phpunit", version: "9.6.0" }],
});

describe("parseComposerLock", () => {
  it("parses packages and packages-dev", () => {
    const result = parseComposerLock(lock);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.packageCount).toBe(2);
    expect(result.devPackageCount).toBe(1);
    expect(result.packages.map((p) => p.name)).toEqual([
      "guzzlehttp/psr7",
      "symfony/http-foundation",
      "phpunit/phpunit",
    ]);
    expect(packagesToVersionMap(result.packages)["symfony/http-foundation"]).toBe("v5.4.50");
  });

  it("rejects empty, invalid JSON, and non-lock shapes", () => {
    expect(parseComposerLock("").ok).toBe(false);
    expect(parseComposerLock("{").ok).toBe(false);
    expect(parseComposerLock('{"foo":1}').ok).toBe(false);
    expect(parseComposerLock("[]").ok).toBe(false);
  });

  it("rejects oversized input", () => {
    const huge = `{"packages":[],"x":"${"a".repeat(5 * 1024 * 1024)}"}`;
    const result = parseComposerLock(huge);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("too_large");
  });
});
