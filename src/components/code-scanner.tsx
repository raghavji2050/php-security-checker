"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { COMMAND_INJECTION_LESSON_URL, MAX_CODE_BYTES, scanPhpCode } from "@/lib/code-scan";

const SAMPLE = `<?php
// Vulnerable: request input is passed to a shell function
$output = shell_exec($_GET['cmd']);
system($_POST['cmd']);
$cmd = request()->input('command');
echo \`$cmd\`;
`;

export function CodeScanner() {
  const [code, setCode] = useState("");
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const report = useMemo(() => (submitted === null ? null : scanPhpCode(submitted)), [submitted]);

  function run(source: string) {
    if (new TextEncoder().encode(source).length > MAX_CODE_BYTES) {
      setSubmitted(null);
      setError("Code is too large (max 256 KB).");
      return;
    }
    setError(null);
    setSubmitted(source);
  }

  return (
    <div className="mt-8 grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Paste PHP code</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <label htmlFor="php-code-scan" className="sr-only">PHP code</label>
          <textarea
            id="php-code-scan"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            rows={12}
            spellCheck={false}
            placeholder={SAMPLE}
            className="w-full rounded-md border border-border bg-background p-3 font-mono text-sm"
          />
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => run(code)} disabled={!code.trim()}>Scan for command injection</Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setCode(SAMPLE);
                run(SAMPLE);
              }}
            >
              Try a vulnerable sample
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Runs entirely in your browser. Code is never sent to a server and is never executed. This is a heuristic
            pattern check, not a full static analyser.
          </p>
        </CardContent>
      </Card>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      {report && (
        <Card aria-live="polite" data-testid="code-scan-report">
          <CardHeader>
            <CardTitle>
              {report.findings.length === 0
                ? "No command-injection patterns found"
                : `${report.findings.length} command-injection finding${report.findings.length > 1 ? "s" : ""}`}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            {report.findings.map((item, index) => (
              <div key={`${item.line}-${item.title}-${index}`} className="rounded-md border border-border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={item.severity === "high" ? "danger" : "warning"}>{item.severity}</Badge>
                  <span className="font-medium">Line {item.line}: {item.title}</span>
                </div>
                <pre className="mt-2 overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs">{item.snippet}</pre>
                <p className="mt-2 text-muted-foreground">{item.why}</p>
                <p className="mt-2">{item.fix}</p>
                <pre className="mt-2 overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs">{item.safeExample}</pre>
                <p className="mt-2">
                  <a className="text-primary underline" href={item.lessonUrl} target="_blank" rel="noopener">
                    {item.lessonLabel}
                  </a>
                </p>
              </div>
            ))}
            {report.findings.length === 0 && (
              <p className="text-muted-foreground">
                No exec / shell_exec / system / passthru / popen / proc_open / backtick use of request input was found.
                Safe argument-array Process calls and escapeshellarg() wrappers are not flagged. This is still only a
                pattern check.
              </p>
            )}
            <p>
              Fix guide (escapeshellarg, or Symfony Process / Laravel Process with an argument array):{" "}
              <a className="text-primary underline" href={COMMAND_INJECTION_LESSON_URL} target="_blank" rel="noopener">
                Command injection and process argument arrays on PHP Hub
              </a>
              .
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
