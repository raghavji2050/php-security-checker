import { fetchText } from "@/lib/http";
import type { ChangelogIndex } from "@/lib/types";

const CHANGELOGS = [
  "https://www.php.net/ChangeLog-8.php",
  "https://www.php.net/ChangeLog-7.php",
  "https://www.php.net/ChangeLog-5.php",
];

export function parseChangelogHtml(html: string): ChangelogIndex {
  const index: ChangelogIndex = {};
  const sections = html.matchAll(/<h3>\s*Version\s+(\d+\.\d+\.\d+)\s*<\/h3>([\s\S]*?)(?=<h3>\s*Version\s+\d+\.\d+\.\d+\s*<\/h3>|$)/gi);
  for (const section of sections) {
    const version = section[1];
    const body = section[2];
    const ids = new Set<string>();
    for (const match of body.matchAll(/CVE-\d{4}-\d+/g)) ids.add(match[0]);
    for (const match of body.matchAll(/GHSA-[0-9a-z]{4}-[0-9a-z]{4}-[0-9a-z]{4}/gi)) ids.add(match[0]);
    for (const id of ids) {
      const list = index[id] ?? [];
      if (!list.includes(version)) list.push(version);
      index[id] = list;
    }
  }
  return index;
}

export function mergeChangelogIndexes(parts: ChangelogIndex[]): ChangelogIndex {
  const merged: ChangelogIndex = {};
  for (const part of parts) {
    for (const [id, versions] of Object.entries(part)) {
      const list = merged[id] ?? [];
      for (const version of versions) {
        if (!list.includes(version)) list.push(version);
      }
      merged[id] = list;
    }
  }
  return merged;
}

export async function fetchChangelogIndex(): Promise<ChangelogIndex> {
  const parts: ChangelogIndex[] = [];
  const failures: string[] = [];
  for (const url of CHANGELOGS) {
    try {
      const html = await fetchText(url, {}, { timeoutMs: 60_000, retries: 2, deadlineMs: 75_000 });
      parts.push(parseChangelogHtml(html));
    } catch {
      failures.push(new URL(url).pathname);
    }
  }
  if (parts.length === 0) {
    throw new Error(`PHP changelogs could not be fetched (${failures.join(", ")})`);
  }
  return mergeChangelogIndexes(parts);
}
