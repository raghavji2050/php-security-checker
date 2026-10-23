import type { Metadata } from "next";
import Link from "next/link";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const metadata: Metadata = {
  title: "Vulnerabilities",
  description: "How PHP Security Checker decides whether a runtime version is affected.",
};

export default function VulnerabilitiesPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10">
      <p className="text-sm font-medium uppercase tracking-[0.18em] text-primary">Detection</p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight">Vulnerabilities</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        Results are built per version from live records. Nothing on this page is a stored copy of CVE scores or fix
        versions. Run a check from the <Link className="text-primary underline-offset-2 hover:underline" href="/">home page</Link>.
      </p>

      <Tabs defaultValue="matching" className="mt-8">
        <TabsList>
          <TabsTrigger value="matching">Matching</TabsTrigger>
          <TabsTrigger value="rce">RCE and shell risk</TabsTrigger>
          <TabsTrigger value="status">Status colors</TabsTrigger>
        </TabsList>
        <TabsContent value="matching">
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
        </TabsContent>
        <TabsContent value="rce">
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
        </TabsContent>
        <TabsContent value="status">
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
        </TabsContent>
      </Tabs>

      <Accordion type="single" collapsible className="mt-8">
        <AccordionItem value="sources">
          <AccordionTrigger>Which sources are trusted?</AccordionTrigger>
          <AccordionContent>
            NIST NVD API 2.0, php.net release JSON, the supported-versions and end-of-life pages, the PHP ChangeLog,
            and GitHub Security Advisories published on php/php-src.
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="cache">
          <AccordionTrigger>What if a source is down?</AccordionTrigger>
          <AccordionContent>
            A previously successful response can be served after its TTL, and the page says it is stale and shows the
            sync time. A failed lookup with no cache is &quot;unable to verify&quot;, never a green result.
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </main>
  );
}
