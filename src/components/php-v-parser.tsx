"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { parsePhpV, type PhpVResult } from "@/lib/php-v";

const SAMPLE = `PHP 8.1.2-1ubuntu2.20 (cli) (built: Jun 24 2024 15:20:40) (NTS)
Copyright (c) The PHP Group
Zend Engine v4.1.2, Copyright (c) Zend Technologies
    with Zend OPcache v8.1.2-1ubuntu2.20, Copyright (c), by Zend Technologies`;

export function PhpVParser() {
  const [text, setText] = useState("");
  const [result, setResult] = useState<PhpVResult | null>(null);

  function run(source: string) {
    setResult(parsePhpV(source));
  }

  return (
    <div className="mt-8 space-y-4">
      <Card>
        <CardContent className="space-y-3 p-4 md:p-6">
          <label className="block text-sm font-medium" htmlFor="php-v-text">Output of <code>php -v</code></label>
          <textarea
            id="php-v-text"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={"PHP 8.3.12 (cli) (built: ...) (NTS)\nCopyright (c) The PHP Group"}
            maxLength={5000}
            className="min-h-36 w-full rounded-md border border-border bg-background p-3 font-mono text-sm"
          />
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => run(text)}>Read version</Button>
            <Button type="button" variant="outline" onClick={() => { setText(SAMPLE); run(SAMPLE); }}>Use sample</Button>
          </div>
          <p className="text-xs text-muted-foreground">Read only in your browser. Nothing is uploaded or stored.</p>
        </CardContent>
      </Card>
      {result && !result.ok && <p className="text-sm text-warning" role="status">{result.error}</p>}
      {result?.ok && (
        <Card data-testid="php-v-result">
          <CardHeader><CardTitle>PHP {result.value.version}{result.value.preRelease ? ` ${result.value.preRelease}` : ""}</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex flex-wrap gap-2">
              {result.value.sapi && <Badge variant="outline">SAPI: {result.value.sapi}</Badge>}
              {result.value.threadSafety && <Badge variant="outline">{result.value.threadSafety}</Badge>}
              {result.value.opcache && <Badge variant="outline">OPcache loaded</Badge>}
              {result.value.xdebug && <Badge variant="warning">Xdebug loaded</Badge>}
            </div>
            {result.value.built && <p>Built: {result.value.built}{result.value.zendEngine ? ` · Zend Engine ${result.value.zendEngine}` : ""}</p>}
            {result.value.preRelease && (
              <p className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2">
                This is a pre-release build ({result.value.preRelease}). php.net does not recommend pre-releases for production.
              </p>
            )}
            {result.value.suffix && (
              <p className="rounded-md border border-border bg-muted/30 px-3 py-2">
                Package suffix <code className="font-mono">{result.value.suffix}</code>
                {result.value.distro ? <> looks like a {result.value.distro} build</> : <> means this is a vendor or custom build</>}.
                Distributions often backport security fixes without changing the PHP version, so a CVE listed for {result.value.version}{" "}
                may already be patched in your package. Check your vendor&apos;s security tracker to confirm.
              </p>
            )}
            {result.value.xdebug && <p className="text-muted-foreground">Xdebug should not be loaded on a production server.</p>}
            <p>
              <Link className="font-medium text-primary underline" href={`/check/${result.value.version}`} data-testid="php-v-check-link">
                Check PHP {result.value.version} for known CVEs
              </Link>
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
