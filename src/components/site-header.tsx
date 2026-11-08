"use client";

import { Menu, Moon, Shield, Sun } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { NAV_GROUPS } from "@/lib/nav";
import { cn } from "@/lib/utils";

function linkActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

function groupActive(pathname: string, hrefs: string[]) {
  return hrefs.some((href) => linkActive(pathname, href));
}

export function SiteHeader() {
  const pathname = usePathname();
  const { setTheme } = useTheme();

  return (
    <header className="no-print sticky top-0 z-40 border-b border-border/80 bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-3 px-4">
        <Link href="/" className="flex min-w-0 items-center gap-2 font-semibold tracking-tight">
          <span className="grid size-8 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground">
            <Shield className="size-4" aria-hidden="true" />
          </span>
          <span className="truncate leading-tight">PHP Security Checker</span>
        </Link>
        <nav aria-label="Primary" className="ml-auto hidden items-center gap-0.5 lg:flex">
          {NAV_GROUPS.map((group) => {
            const active = groupActive(pathname, group.links.map((link) => link.href));
            if (group.links.length === 1) {
              const link = group.links[0];
              return (
                <Link
                  key={group.id}
                  href={link.href}
                  className={cn(
                    "rounded-md px-2.5 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground",
                    active && "bg-muted text-foreground",
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  {group.label}
                </Link>
              );
            }
            return (
              <details key={group.id} className="relative">
                <summary
                  className={cn(
                    "cursor-pointer list-none rounded-md px-2.5 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground [&::-webkit-details-marker]:hidden",
                    active && "bg-muted text-foreground",
                  )}
                >
                  {group.label}
                </summary>
                <div className="absolute left-0 top-full z-50 mt-1 w-52 rounded-lg border border-border bg-card p-1.5 shadow-lg">
                  {group.links.map((link) => {
                    const current = linkActive(pathname, link.href);
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        className={cn(
                          "block rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground",
                          current && "bg-muted text-foreground",
                        )}
                        aria-current={current ? "page" : undefined}
                      >
                        {link.label}
                      </Link>
                    );
                  })}
                </div>
              </details>
            );
          })}
        </nav>
        <div className="ml-auto flex shrink-0 items-center gap-2 lg:ml-2">
          <details className="relative lg:hidden">
            <summary
              className="flex size-10 list-none cursor-pointer items-center justify-center rounded-md border border-border bg-card text-foreground hover:bg-muted [&::-webkit-details-marker]:hidden"
              aria-label="Open menu"
            >
              <Menu className="size-4" aria-hidden="true" />
            </summary>
            <nav
              aria-label="Mobile"
              className="absolute right-0 top-[calc(100%+0.5rem)] z-50 max-h-[70vh] w-64 overflow-auto rounded-lg border border-border bg-card p-2 shadow-lg"
            >
              {NAV_GROUPS.map((group) => (
                <div key={group.id} className="mb-2">
                  <p className="px-3 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{group.label}</p>
                  {group.links.map((link) => {
                    const current = linkActive(pathname, link.href);
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        className={cn(
                          "block rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground",
                          current && "bg-muted text-foreground",
                        )}
                        aria-current={current ? "page" : undefined}
                        onClick={(event) => {
                          const details = event.currentTarget.closest("details");
                          if (details) details.open = false;
                        }}
                      >
                        {link.label}
                      </Link>
                    );
                  })}
                </div>
              ))}
            </nav>
          </details>
          <Button
            variant="outline"
            size="icon"
            aria-label="Toggle color theme"
            onClick={() => setTheme(document.documentElement.classList.contains("dark") ? "light" : "dark")}
          >
            <Sun className="hidden dark:block" aria-hidden="true" />
            <Moon className="dark:hidden" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </header>
  );
}
