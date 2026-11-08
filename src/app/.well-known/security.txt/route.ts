import { SITE_URL } from "@/lib/site";

/** RFC 9116 security.txt. Contact matches SECURITY.md. */
export function GET() {
  const body = [
    "Contact: mailto:raghavji2050@gmail.com",
    "Contact: https://github.com/raghavji2050/php-security-checker/security/advisories/new",
    "Expires: 2027-11-08T00:00:00.000Z",
    "Preferred-Languages: en",
    `Canonical: ${new URL("/.well-known/security.txt", SITE_URL).toString()}`,
    "Policy: https://github.com/raghavji2050/php-security-checker/blob/master/SECURITY.md",
    "",
  ].join("\n");
  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=86400",
    },
  });
}
