import { describe, expect, it } from "vitest";
import { analyzeDockerfile, compareTagToLibrary, parseDockerLibraryPhp, parsePhpImageRef } from "@/lib/docker-php";

const library = parseDockerLibraryPhp({
  "8.3": { version: "8.3.36", variants: ["bookworm/fpm", "bookworm/apache"] },
  "8.3-rc": null,
  "8.4-rc": { version: "8.4.28RC1", variants: [] },
});

describe("Docker PHP tags and Dockerfiles", () => {
  it("reads stable patches from versions.json and skips release candidates", () => {
    expect(library.map((item) => item.version)).toEqual(["8.3.36"]);
  });

  it("parses pinned, floating, and non-php references", () => {
    const pinned = parsePhpImageRef("php:8.3.12-fpm-bookworm");
    expect(pinned).toMatchObject({ officialPhp: true, phpVersion: "8.3.12", floating: false, variant: "fpm-bookworm" });
    const floating = parsePhpImageRef("php:8.3-fpm");
    expect(floating).toMatchObject({ floating: true, phpBranch: "8.3", phpVersion: null });
    expect(parsePhpImageRef("nginx:1.27")).toMatchObject({ officialPhp: false });
    expect(parsePhpImageRef("php:8.4.28RC1-cli")).toMatchObject({ prerelease: true, phpVersion: null });
  });

  it("compares a tag with the library patch without calling it a CVE", () => {
    const older = parsePhpImageRef("php:8.3.12-fpm");
    if ("ok" in older) throw new Error("tag");
    expect(compareTagToLibrary(older, library)).toMatch(/older than that library patch/);
    expect(compareTagToLibrary(older, library)).not.toMatch(/CVE-/);
    const floating = parsePhpImageRef("php:8.3-fpm");
    if ("ok" in floating) throw new Error("tag");
    expect(compareTagToLibrary(floating, library)).toMatch(/currently maps 8.3 to 8.3.36/);
  });

  it("flags an unpinned final stage and a copied env file, and does not execute the file", () => {
    const analyzed = analyzeDockerfile("FROM php:8.3-fpm\nCOPY .env /var/www/.env\n");
    expect(analyzed.ok).toBe(true);
    if (!analyzed.ok) return;
    expect(analyzed.findings.map((item) => item.title)).toEqual([
      "PHP tag is not pinned to a patch",
      "Possible secret copied into the image",
      "Stage may run as root",
    ]);
  });
});
