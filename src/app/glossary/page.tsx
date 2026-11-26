import type { Metadata } from "next";
import Link from "next/link";
import { jsonLdString } from "@/lib/faq";
import { GLOSSARY, glossaryJsonLd } from "@/lib/glossary";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "PHP Security Glossary",
  description: "Plain-language meanings of CVE, CVSS, KEV, EPSS, EOL, backport and other PHP security terms, each linked to its official source.",
  alternates: { canonical: new URL("/glossary", SITE_URL).toString() },
};

export default function GlossaryPage() {
  return (
    <main className="mx-auto w-full min-w-0 max-w-6xl px-4 py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(glossaryJsonLd(SITE_URL)) }} />
      <p className="text-sm font-medium uppercase tracking-[0.18em] text-primary">Docs</p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight">PHP security glossary</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        The terms used in our reports, in plain words, with what each one means for a PHP developer. Every entry links to
        the official source that defines it.
      </p>
      <nav aria-label="Glossary terms" className="mt-6 flex flex-wrap gap-2">
        {GLOSSARY.map((t) => (
          <a key={t.id} href={`#${t.id}`} className="rounded-md border px-2.5 py-1 text-sm hover:bg-muted">
            {t.term}
          </a>
        ))}
      </nav>
      <dl className="mt-8 space-y-6" data-testid="glossary">
        {GLOSSARY.map((t) => (
          <div key={t.id} id={t.id} className="scroll-mt-20 rounded-lg border p-4">
            <dt className="text-lg font-semibold">
              {t.term}
              {t.expansion ? <span className="ml-2 text-sm font-normal text-muted-foreground">{t.expansion}</span> : null}
            </dt>
            <dd className="mt-2 space-y-2 text-sm">
              <p>{t.definition}</p>
              <p className="text-muted-foreground">
                <span className="font-medium text-foreground">In practice: </span>
                {t.inPractice}
              </p>
              <p className="flex flex-wrap gap-x-4 gap-y-1">
                <a className="text-primary underline" href={t.source.href} rel="noopener noreferrer" target="_blank">
                  Source: {t.source.label}
                </a>
                {t.related ? (
                  <Link className="text-primary underline" href={t.related.href}>
                    See: {t.related.label}
                  </Link>
                ) : null}
              </p>
            </dd>
          </div>
        ))}
      </dl>
    </main>
  );
}
