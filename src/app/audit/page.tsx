import type { Metadata } from "next";
import { ServerAudit } from "@/components/server-audit";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "PHP server audit summary (print-friendly)",
  description:
    "Combine a PHP version check, php.ini audit and loaded-extension check into one print-friendly summary you can hand to a client or attach to a ticket.",
  alternates: { canonical: new URL("/audit", SITE_URL).toString() },
};

export default function AuditPage() {
  return (
    <main className="mx-auto w-full min-w-0 max-w-6xl px-4 py-10">
      <p className="no-print text-sm font-medium uppercase tracking-[0.18em] text-primary">Report</p>
      <h1 className="no-print mt-2 text-4xl font-semibold tracking-tight">Server audit summary</h1>
      <p className="no-print mt-3 max-w-2xl text-muted-foreground">
        Paste what you have from one server: the PHP version (or <code className="text-sm">php -v</code>), its php.ini and
        the <code className="text-sm">php -m</code> module list. You get one prioritised summary to print, save as PDF or
        copy as Markdown.
      </p>
      <ServerAudit />
    </main>
  );
}
