/** Minimal RSS 2.0 / Atom parser. Extracts title, link and date only — never description or content. */

export type ParsedFeedItem = {
  title: string;
  url: string;
  publishedAt: string | null;
};

function safeChar(code: number): string {
  if (!Number.isFinite(code) || code < 0) return "";
  if (code < 32 && code !== 9 && code !== 10 && code !== 13) return "";
  try {
    return String.fromCodePoint(code);
  } catch {
    return "";
  }
}

export function decodeXmlEntities(value: string): string {
  return value.replace(/&(#x[0-9a-fA-F]+|#\d+|amp|lt|gt|quot|apos|nbsp);/g, (_match, ent: string) => {
    if (ent[0] === "#") {
      const code = ent[1] === "x" || ent[1] === "X" ? Number.parseInt(ent.slice(2), 16) : Number(ent.slice(1));
      return safeChar(code);
    }
    if (ent === "amp") return "&";
    if (ent === "lt") return "<";
    if (ent === "gt") return ">";
    if (ent === "quot") return '"';
    if (ent === "apos") return "'";
    if (ent === "nbsp") return " ";
    return "";
  });
}

export function unwrapXmlText(value: string): string {
  let text = value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
  text = decodeXmlEntities(text);
  text = text.replace(/<[^>]+>/g, " ");
  return text.replace(/\s+/g, " ").trim();
}

function attr(attrs: string, name: string): string | null {
  const match = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i").exec(attrs);
  if (!match) return null;
  return decodeXmlEntities(match[1] ?? match[2] ?? match[3] ?? "").trim() || null;
}

export function xmlTagText(block: string, tag: string): string | null {
  const match = new RegExp(
    `<(?:[\\w.-]+:)?${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[\\w.-]+:)?${tag}>`,
    "i",
  ).exec(block);
  if (!match) return null;
  const text = unwrapXmlText(match[1]);
  return text || null;
}

export function extractBlocks(xml: string, tag: string): string[] {
  const match = xml.match(
    new RegExp(`<(?:[\\w.-]+:)?${tag}\\b[^>]*>[\\s\\S]*?</(?:[\\w.-]+:)?${tag}>`, "gi"),
  );
  return match ?? [];
}

export function resolveFeedUrl(href: string, baseUrl?: string): string | null {
  const trimmed = href.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed, baseUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function toIsoStamp(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

const SKIP_LINK_REL = new Set(["enclosure", "self", "via", "related", "replies", "edit"]);

function atomLink(block: string, baseUrl?: string): string | null {
  const links: { href: string; rel: string }[] = [];
  const re = /<(?:[\w.-]+:)?link\b([^>]*?)\/?>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(block))) {
    const href = attr(match[1], "href");
    if (!href) continue;
    links.push({ href, rel: (attr(match[1], "rel") || "alternate").toLowerCase() });
  }
  const preferred =
    links.find((link) => link.rel === "alternate") ??
    links.find((link) => !SKIP_LINK_REL.has(link.rel));
  if (preferred) return resolveFeedUrl(preferred.href, baseUrl);

  const content = /<(?:[\w.-]+:)?content\b([^>]*?)\/?>/i.exec(block);
  const src = content ? attr(content[1], "src") : null;
  if (src) return resolveFeedUrl(src, baseUrl);

  const id = xmlTagText(block, "id");
  if (id && /^https?:\/\//i.test(id)) return resolveFeedUrl(id, baseUrl);
  return null;
}

function rssLink(block: string, baseUrl?: string): string | null {
  const tagged = /<(?:([\w.-]+):)?link\b([^>]*)>([\s\S]*?)<\/(?:[\w.-]+:)?link>/gi;
  let match: RegExpExecArray | null;
  while ((match = tagged.exec(block))) {
    if (match[1] && match[1].toLowerCase() === "atom") continue;
    const href = attr(match[2], "href") || unwrapXmlText(match[3]);
    if (href) return resolveFeedUrl(href, baseUrl);
  }
  const selfClosing = /<(?:([\w.-]+):)?link\b([^>]*?)\/>/gi;
  while ((match = selfClosing.exec(block))) {
    if (match[1] && match[1].toLowerCase() === "atom") {
      const href = attr(match[2], "href");
      if (href) return resolveFeedUrl(href, baseUrl);
      continue;
    }
    const href = attr(match[2], "href");
    if (href) return resolveFeedUrl(href, baseUrl);
  }
  const guid = /<(?:[\w.-]+:)?guid\b([^>]*)>([\s\S]*?)<\/(?:[\w.-]+:)?guid>/i.exec(block);
  if (guid) {
    const permalink = (attr(guid[1], "isPermaLink") || "true").toLowerCase() !== "false";
    const value = unwrapXmlText(guid[2]);
    if (permalink && /^https?:\/\//i.test(value)) return resolveFeedUrl(value, baseUrl);
  }
  return null;
}

function entryDate(block: string): string | null {
  return toIsoStamp(xmlTagText(block, "published") ?? xmlTagText(block, "updated") ?? xmlTagText(block, "pubDate") ?? xmlTagText(block, "date"));
}

export function parseFeedEntry(block: string, kind: "atom" | "rss", baseUrl?: string): ParsedFeedItem | null {
  const title = xmlTagText(block, "title");
  const url = kind === "atom" ? atomLink(block, baseUrl) : rssLink(block, baseUrl);
  if (!title || !url) return null;
  return { title, url, publishedAt: entryDate(block) };
}

export function parseFeedItems(xml: string, baseUrl?: string): ParsedFeedItem[] {
  const hasEntry = /<(?:[\w.-]+:)?entry[\s>]/i.test(xml);
  const kind: "atom" | "rss" = hasEntry ? "atom" : "rss";
  const blocks = extractBlocks(xml, kind === "atom" ? "entry" : "item");
  const items: ParsedFeedItem[] = [];
  for (const block of blocks) {
    const parsed = parseFeedEntry(block, kind, baseUrl);
    if (parsed) items.push(parsed);
  }
  return items;
}
