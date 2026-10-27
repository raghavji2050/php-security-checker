"use client";

import { Menu, Moon, Shield, Sun } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/vulnerabilities", label: "Vulnerabilities" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/versions", label: "PHP Versions" },
  { href: "/about", label: "About" },
];

function linkActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function SiteHeader() {
  const pathname = usePathname();
  const { setTheme } = useTheme();

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-3 px-4">
        <Link href="/" className="flex min-w-0 items-center gap-2 font-semibold tracking-tight">
          <span className="grid size-8 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground">
            <Shield className="size-4" aria-hidden="true" />
          </span>
          <span className="truncate leading-tight">PHP Security Checker</span>
        </Link>
        <nav aria-label="Primary" className="ml-auto hidden items-center gap-1 md:flex">
          {LINKS.map((link) => {
            const active = linkActive(pathname, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground",
                  active && "bg-muted text-foreground",
                )}
                aria-current={active ? "page" : undefined}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex shrink-0 items-center gap-2 md:ml-2">
          <details className="relative md:hidden">
            <summary
              className="flex size-10 list-none cursor-pointer items-center justify-center rounded-md border border-border bg-card text-foreground hover:bg-muted [&::-webkit-details-marker]:hidden"
              aria-label="Open menu"
            >
              <Menu className="size-4" aria-hidden="true" />
            </summary>
            <nav
              aria-label="Mobile"
              className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-56 rounded-lg border border-border bg-card p-2 shadow-lg"
            >
              {LINKS.map((link) => {
                const active = linkActive(pathname, link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={cn(
                      "block rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground",
                      active && "bg-muted text-foreground",
                    )}
                    aria-current={active ? "page" : undefined}
                    onClick={(event) => {
                      const details = event.currentTarget.closest("details");
                      if (details) details.open = false;
                    }}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>
          </details>
          <Button
            variant="outline"
            size="icon"
            aria-label="Toggle color theme"
            onClick={() => setTheme(document.documentElement.classList.contains("dark") ? "light" : "dark")}
          >
            <Sun className="hidden dark:block" />
            <Moon className="dark:hidden" />
          </Button>
        </div>
      </div>
    </header>
  );
}
