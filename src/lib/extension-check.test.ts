import { describe, expect, it } from "vitest";
import { assessExtensions, mentionsExtension, parsePhpModules } from "@/lib/extension-check";

describe("extension checker", () => {
  it("parses php -m sections and maps Zend OPcache", () => {
    const parsed = parsePhpModules("[PHP Modules]\ncurl\n\n[Zend Modules]\nZend OPcache\n");
    expect(parsed).toEqual({ ok: true, names: ["curl", "opcache"] });
  });

  it("refuses PHP source", () => {
    expect(parsePhpModules("<?php phpinfo();").ok).toBe(false);
  });

  it("matches conservative phrases and does not treat a bare short name as a hit", () => {
    expect(mentionsExtension("The curl extension and libcurl are affected.", "curl")).toBe(true);
    expect(mentionsExtension("A hash collision in a fixture.", "hash")).toBe(false);
    expect(mentionsExtension("ext/phar is mentioned.", "phar")).toBe(true);
  });

  it("confirms only when the version check already confirmed that CVE, and never marks outdated", () => {
    const records = [
      { id: "CVE-2099-1000", description: "The curl extension allows a fixture flaw.", severity: "HIGH" },
      { id: "CVE-2099-1001", description: "Unrelated parser bug.", severity: "LOW" },
    ];
    const verdicts = new Map<string, "confirmed" | "potential">([["CVE-2099-1000", "confirmed"]]);
    const [curl, hash] = assessExtensions(["curl", "hash"], records, verdicts);
    expect(curl.status).toBe("confirmed_on_entered_version");
    expect(curl.outdated).toBeNull();
    expect(curl.mentions.map((item) => item.id)).toEqual(["CVE-2099-1000"]);
    expect(hash.status).toBe("no_matching_text");
    expect(hash.kind).toBe("bundled");
  });

  it("does not call a mention confirmed when no PHP version was checked", () => {
    const records = [{ id: "CVE-2099-1000", description: "ext/redis is a fixture.", severity: null }];
    const [redis] = assessExtensions(["redis"], records, null);
    expect(redis.kind).toBe("not_in_php_src_list");
    expect(redis.status).toBe("mentioned_version_not_checked");
    expect(redis.mentions[0].verdict).toBe("version_not_checked");
  });
});
