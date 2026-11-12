import type { PhpBranch } from "@/lib/types";

/** RFC 5545 text escaping. */
export function icsText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Fold lines longer than 75 octets (RFC 5545 §3.1). */
export function fold(line: string): string {
  const out: string[] = [];
  let rest = line;
  while (rest.length > 75) {
    out.push(rest.slice(0, 75));
    rest = ` ${rest.slice(75)}`;
  }
  out.push(rest);
  return out.join("\r\n");
}

function ymd(date: string): string {
  return date.slice(0, 10).replace(/-/g, "");
}

function nextDay(date: string): string {
  const d = new Date(`${date.slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

export type CalendarEvent = { uid: string; date: string; summary: string; description: string };

/** All-day events for upcoming active-support and security-support end dates (from php.net). */
export function supportEvents(branches: PhpBranch[], today: string): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  for (const b of branches) {
    if (b.activeSupportEnd && b.activeSupportEnd.slice(0, 10) >= today) {
      events.push({
        uid: `php-${b.branch}-active-end`,
        date: b.activeSupportEnd.slice(0, 10),
        summary: `PHP ${b.branch}: active support ends`,
        description: `After this date PHP ${b.branch} gets security fixes only (php.net). Plan your upgrade.`,
      });
    }
    if (b.securitySupportEnd && b.securitySupportEnd.slice(0, 10) >= today) {
      events.push({
        uid: `php-${b.branch}-security-end`,
        date: b.securitySupportEnd.slice(0, 10),
        summary: `PHP ${b.branch}: end of life (security support ends)`,
        description: `After this date php.net releases no more security fixes for PHP ${b.branch}.`,
      });
    }
  }
  return events.sort((a, b) => a.date.localeCompare(b.date) || a.uid.localeCompare(b.uid));
}

export function buildIcs(events: CalendarEvent[], options: { siteUrl: string; stamp: string }): string {
  const host = new URL(options.siteUrl).host;
  const dtstamp = options.stamp.replace(/[-:]/g, "").replace(/\.\d+/, "").slice(0, 15) + "Z";
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//PHP Security Checker//PHP support dates//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:PHP support end dates",
    "X-WR-CALDESC:Active and security support end dates for PHP branches from php.net",
  ];
  for (const e of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.uid}@${host}`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART;VALUE=DATE:${ymd(e.date)}`,
      `DTEND;VALUE=DATE:${nextDay(e.date)}`,
      `SUMMARY:${icsText(e.summary)}`,
      `DESCRIPTION:${icsText(`${e.description} Source: https://www.php.net/supported-versions.php`)}`,
      `URL:${options.siteUrl.replace(/\/$/, "")}/php-versions`,
      "TRANSP:TRANSPARENT",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
