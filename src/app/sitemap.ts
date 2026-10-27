import type { MetadataRoute } from "next";
import { cacheLife } from "next/cache";
import { loadBranchCatalog } from "@/lib/dataset";
import { SITE_URL } from "@/lib/site";
import { parsePhpVersion } from "@/lib/version";

const PAGES = ["/", "/vulnerabilities", "/how-it-works", "/versions", "/about"];

async function versionPages(): Promise<string[]> {
  "use cache";
  cacheLife("days");
  try {
    const { branches } = await loadBranchCatalog();
    const versions = branches
      .map((branch) => branch.latestPatch)
      .filter((v): v is string => typeof v === "string" && parsePhpVersion(v) !== null);
    return [...new Set(versions)].map((v) => `/check/${v}`);
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages = PAGES.map((path) => ({
    url: new URL(path, SITE_URL).toString(),
    changeFrequency: (path === "/" || path === "/vulnerabilities" ? "daily" : "weekly") as "daily" | "weekly",
    priority: path === "/" ? 1 : 0.7,
  }));
  const checks = (await versionPages()).map((path) => ({
    url: new URL(path, SITE_URL).toString(),
    changeFrequency: "daily" as const,
    priority: 0.6,
  }));
  return [...pages, ...checks];
}
