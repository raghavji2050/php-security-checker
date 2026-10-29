import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { FAQ, faqJsonLd, jsonLdString } from "@/lib/faq";

export const metadata: Metadata = {
  title: "How it works",
  description:
    "How PHP Security Checker matches a PHP version to NVD, php.net and GitHub records, which sources it trusts, and what happens when a source is down.",
};

const SECTIONS = [
  { id: "matching", label: "Matching" },
  { id: "rce", label: "RCE and shell risk" },
  { id: "status", label: "Status colors" },
  { id: "faq", label: "Quick answers" },
] as const;

export default function HowItWorksPage() {
  return (
    <main className="mx-auto w-full min-w-0 max-w-6xl px-4 py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(faqJsonLd()) }} />
      <p className="text-sm font-medium uppercase tracking-[0.18em] text-primary">Detection</p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight">How it works</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        Results are built per version from live records. Nothing on this page is a stored copy of CVE scores or fix
        versions. Run a check from the <Link className="text-primary underline-offset-2 hover:underline" href="/">home page</Link>, or
        browse the <Link className="text-primary underline-offset-2 hover:underline" href="/vulnerabilities">vulnerability list</Link>.
      </p>

      <nav aria-label="On this page" className="mt-8">
        <ul className="inline-flex flex-wrap items-center gap-1 rounded-md bg-muted p-1">
          {SECTIONS.map((section) => (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                className="inline-flex items-center justify-center rounded-sm px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-card hover:text-foreground"
              >
                {section.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-6 space-y-8">
        <section id="matching" aria-labelledby="matching-heading" className="scroll-mt-20">
          <h2 id="matching-heading" className="mb-3 text-xl font-semibold tracking-tight">Matching</h2>
          <Card>
            <CardContent className="space-y-3 p-5 text-sm leading-6 text-muted-foreground">
              <p>The version must be MAJOR.MINOR.PATCH. A missing patch is rejected instead of being guessed.</p>
              <p>
                NVD records are kept only when the product is the PHP runtime (`cpe:2.3:a:php:php`) or php.net
                published affected ranges for PHP itself. Software written in PHP is left out.
              </p>
              <p>
                A finding is confirmed when a precise range contains the version and php.net, NVD, GitHub, and the
                ChangeLog do not disagree. Open-ended CPE rows and conflicting fix dates stay at &quot;Potentially
                affected — verification required&quot;.
              </p>
              <p>Fixed releases come from those ranges and must also appear in the php.net release index. Otherwise the fix is &quot;Not verified&quot;.</p>
            </CardContent>
          </Card>
        </section>
        <section id="rce" aria-labelledby="rce-heading" className="scroll-mt-20">
          <h2 id="rce-heading" className="mb-3 text-xl font-semibold tracking-tight">RCE and shell risk</h2>
          <Card>
            <CardContent className="space-y-3 p-5 text-sm leading-6 text-muted-foreground">
              <p>
                Remote code execution, command injection, shell execution, CGI argument injection, and other code
                execution are classified from CWE-78, CWE-77, CWE-88, and CWE-94, plus the published description.
                Each row shows that basis.
              </p>
              <p>
                The version alone cannot show whether the bug is reachable. CGI versus php-fpm, Windows versus Linux,
                and the loaded extensions all matter. This app never sends payloads or shell commands anywhere.
              </p>
            </CardContent>
          </Card>
        </section>
        <section id="status" aria-labelledby="status-heading" className="scroll-mt-20">
          <h2 id="status-heading" className="mb-3 text-xl font-semibold tracking-tight">Status colors</h2>
          <div className="grid gap-3 md:grid-cols-3">
            <Card>
              <CardContent className="p-5 text-sm leading-6">
                <p className="font-medium text-[#9f1239]">Red</p>
                <p className="mt-2 text-muted-foreground">At least one confirmed PHP runtime vulnerability contains this version.</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5 text-sm leading-6">
                <p className="font-medium text-[#b45309]">Yellow</p>
                <p className="mt-2 text-muted-foreground">Unsupported branch, stale data, unknown support, or a match that still needs verification.</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5 text-sm leading-6">
                <p className="font-medium text-[#047857]">Green</p>
                <p className="mt-2 text-muted-foreground">No confirmed match in the available data, and the branch is still supported. Green is not a promise of safety.</p>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>

      <div className="mt-8 space-y-3">
        <details open className="group rounded-lg border border-border bg-card p-5">
          <summary className="cursor-pointer text-sm font-medium">Which sources are trusted?</summary>
          <div className="mt-3 space-y-3 text-sm leading-6 text-muted-foreground">
            <p>Only official or primary records are used:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>NIST National Vulnerability Database (NVD API 2.0), for CVE records, CVSS scores, and CPE ranges.</li>
              <li>php.net release data and the supported-versions and end-of-life pages, for release lists and support dates.</li>
              <li>The PHP ChangeLog, to cross-check which release fixed a CVE.</li>
              <li>GitHub Security Advisories published on php/php-src.</li>
            </ul>
            <p>
              When these sources disagree, for example NVD&apos;s range contains a version but php.net&apos;s affected list
              or the ChangeLog says it is fixed, the app does not pick a winner. The finding stays &quot;Potentially
              affected — verification required&quot;, the conflict is shown on the result, and the fixed version is
              &quot;Not verified&quot; unless it is published on php.net.
            </p>
          </div>
        </details>
        <details open className="group rounded-lg border border-border bg-card p-5">
          <summary className="cursor-pointer text-sm font-medium">What if a source is down?</summary>
          <div className="mt-3 space-y-3 text-sm leading-6 text-muted-foreground">
            <p>
              Upstream responses are cached on the server. If NVD, php.net, or GitHub cannot be reached, the last
              successful copy is used, and the result says it is cached and shows its &quot;Data last updated&quot; time.
            </p>
            <p>
              A result built from cached or partial data may be incomplete: newer CVEs might be missing. It is shown in
              yellow with a warning, never as a clean green result.
            </p>
            <p>
              If NVD fails and no cached copy exists, the version cannot be verified. You get a clear error and a Retry
              button instead of a result.
            </p>
          </div>
        </details>
      </div>

      <section id="faq" aria-labelledby="faq-heading" className="mt-8 scroll-mt-20">
        <h2 id="faq-heading" className="mb-3 text-xl font-semibold tracking-tight">Quick answers</h2>
        <div className="space-y-3">
          {FAQ.map((item) => (
            <div key={item.question} className="rounded-lg border border-border bg-card p-5">
              <h3 className="text-sm font-medium">{item.question}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.answer}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
