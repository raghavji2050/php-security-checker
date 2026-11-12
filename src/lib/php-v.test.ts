import { describe, expect, it } from "vitest";
import { distroOf, parsePhpV } from "@/lib/php-v";

const UBUNTU = `PHP 8.1.2-1ubuntu2.20 (cli) (built: Jun 24 2024 15:20:40) (NTS)
Copyright (c) The PHP Group
Zend Engine v4.1.2, Copyright (c) Zend Technologies
    with Zend OPcache v8.1.2-1ubuntu2.20, Copyright (c), by Zend Technologies`;

describe("parsePhpV", () => {
  it("reads an Ubuntu build", () => {
    const r = parsePhpV(UBUNTU);
    expect(r.ok && r.value).toMatchObject({
      version: "8.1.2", suffix: "-1ubuntu2.20", distro: "Ubuntu", sapi: "cli", threadSafety: "NTS",
      built: "Jun 24 2024 15:20:40", zendEngine: "4.1.2", opcache: true, xdebug: false, preRelease: null,
    });
  });

  it("reads an official build with ZTS and Xdebug", () => {
    const r = parsePhpV("PHP 8.4.14 (cli) (built: Oct 21 2026 10:00:00) (ZTS Visual C++ 2022 x64)\nZend Engine v4.4.14\n    with Xdebug v3.4.0");
    expect(r.ok && r.value).toMatchObject({ version: "8.4.14", suffix: null, distro: null, threadSafety: "ZTS", xdebug: true });
  });

  it("flags pre-releases", () => {
    const r = parsePhpV("PHP 8.6.0RC5 (cli) (built: Nov  5 2026 12:00:00) (NTS)");
    expect(r.ok && r.value.preRelease).toBe("RC5");
    expect(r.ok && r.value.built).toBe("Nov 5 2026 12:00:00");
  });

  it("accepts a bare first line and rejects junk", () => {
    expect(parsePhpV("PHP 7.4.33").ok).toBe(true);
    expect(parsePhpV("hello world").ok).toBe(false);
    expect(parsePhpV("PHP 8.2 (cli)").ok).toBe(false);
  });
});

describe("distroOf", () => {
  it.each([
    ["-1+ubuntu22.04.1+deb.sury.org+1", "Ondřej Surý packages (deb.sury.org)"],
    ["-1~deb12u1", "Debian"],
    ["-1.el9_4", "RHEL family (RHEL, AlmaLinux, Rocky)"],
    ["-r0", "Alpine"],
    ["-custom", null],
  ])("%s", (suffix, expected) => {
    expect(distroOf(suffix)).toBe(expected);
  });
});
