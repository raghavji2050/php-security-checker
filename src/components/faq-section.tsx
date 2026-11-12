import { jsonLdString } from "@/lib/faq";
import { faqPageJsonLd, type QA } from "@/lib/page-faq";

/** Visible questions plus the same text as FAQPage JSON-LD. Renders nothing for an empty list. */
export function FaqSection({ items, id = "faq" }: { items: QA[]; id?: string }) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby={id} data-testid="page-faq">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(faqPageJsonLd(items)) }} />
      <h2 id={id} className="text-2xl font-semibold tracking-tight">Questions</h2>
      <dl className="mt-3 space-y-4">
        {items.map((f) => (
          <div key={f.question}>
            <dt className="font-medium">{f.question}</dt>
            <dd className="mt-1 text-sm text-muted-foreground">{f.answer}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
