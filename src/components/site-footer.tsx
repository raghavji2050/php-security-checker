import { DISCLAIMER } from "@/lib/types";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-muted-foreground">
        <p>{DISCLAIMER}</p>
        <p>
          Data comes from NIST NVD, php.net release and support pages, the PHP ChangeLog, and GitHub Security
          Advisories for php/php-src. Nothing here scans your server or runs the version you type.
        </p>
      </div>
    </footer>
  );
}
