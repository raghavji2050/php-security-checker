import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { auditOffers } from "@/lib/offers";

export function AuditOffers() {
  const offers = auditOffers();
  if (offers.length === 0) return null;

  return (
    <Card className="no-print" data-testid="audit-offers">
      <CardHeader>
        <CardTitle>Need a closer look?</CardTitle>
        <CardDescription>
          This summary is free and version-based; it is not a full security audit. Paid reviews from the
          person who built this tool:
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        {offers.map((offer) => (
          <div key={offer.id} className="flex flex-col gap-3 rounded-md border border-border p-4">
            <div className="space-y-1">
              <h3 className="font-medium">{offer.title}</h3>
              <p className="text-sm text-muted-foreground">{offer.detail}</p>
            </div>
            <Button asChild className="mt-auto w-fit" size="sm">
              <a href={offer.href} target="_blank" rel="noreferrer">
                {offer.cta}
              </a>
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
