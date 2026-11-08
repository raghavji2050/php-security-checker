import type { Metadata } from "next";
import { IniAuditor } from "@/components/ini-auditor";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "php.ini configuration audit",
  description:
    "Paste or upload a php.ini and review display_errors, URL wrappers, session cookies, upload limits, and related directives. The file stays in your browser.",
  alternates: { canonical: new URL("/php-ini", SITE_URL).toString() },
};

export default function PhpIniPage() {
  return (
    <main className="mx-auto w-full min-w-0 max-w-6xl px-4 py-10">
      <p className="text-sm font-medium uppercase tracking-[0.18em] text-primary">Configuration</p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight">php.ini audit</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        Check the directives in a php.ini you paste or upload. Recommendations include the cases where a stricter setting
        would break a normal application. This does not read your server and does not execute PHP.
      </p>
      <IniAuditor />
    </main>
  );
}
