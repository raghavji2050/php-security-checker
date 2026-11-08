/** Primary navigation. Only include pages that exist. */
export type NavLink = { href: string; label: string };

export type NavGroup = {
  id: string;
  label: string;
  links: NavLink[];
};

export const NAV_GROUPS: NavGroup[] = [
  {
    id: "version",
    label: "Version",
    links: [
      { href: "/", label: "Check a version" },
      { href: "/php-versions", label: "Support timeline" },
      { href: "/versions", label: "Branch table" },
    ],
  },
  {
    id: "vulnerabilities",
    label: "Vulnerabilities",
    links: [
      { href: "/cves", label: "CVE explorer" },
      { href: "/vulnerabilities", label: "CVE list" },
    ],
  },
  {
    id: "tools",
    label: "Tools",
    links: [
      { href: "/composer", label: "composer.lock" },
      { href: "/php-ini", label: "php.ini audit" },
      { href: "/extensions", label: "Extensions" },
      { href: "/laravel", label: "Laravel" },
      { href: "/wordpress", label: "WordPress core" },
      { href: "/headers", label: "Security headers" },
      { href: "/docker", label: "Docker / PHP" },
      { href: "/password-hashing", label: "Password hashing" },
    ],
  },
  {
    id: "news",
    label: "News",
    links: [{ href: "/news", label: "Security news" }],
  },
  {
    id: "docs",
    label: "Docs",
    links: [
      { href: "/how-it-works", label: "How it works" },
      { href: "/about", label: "About" },
    ],
  },
  {
    id: "api",
    label: "API",
    links: [
      { href: "/openapi.json", label: "OpenAPI" },
      { href: "/llms.txt", label: "llms.txt" },
    ],
  },
];

export function toolLinks(): NavLink[] {
  return NAV_GROUPS.find((group) => group.id === "tools")?.links ?? [];
}
