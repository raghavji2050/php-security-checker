/** Formats an ISO timestamp in the viewer's time zone, with the zone named (e.g. "25 Oct 2026, 12:30 GMT+5:30"). */
export function formatStampWithZone(value: string | null, timeZone?: string): string {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
    timeZone,
  }).format(date);
}
