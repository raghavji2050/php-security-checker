import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

const PAGES = ["/", "/vulnerabilities", "/how-it-works", "/versions", "/about"];

export default function sitemap(): MetadataRoute.Sitemap {
  return PAGES.map((path) => ({
    url: new URL(path, SITE_URL).toString(),
    changeFrequency: path === "/" || path === "/vulnerabilities" ? "daily" : "weekly",
    priority: path === "/" ? 1 : 0.7,
  }));
}
