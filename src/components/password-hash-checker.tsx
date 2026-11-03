"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { analyzePasswordHashing, PASSWORD_LESSON_URL } from "@/lib/password-hashing";

const SAMPLE = `<?php
// login.php
$hash = md5($_POST['password']);
if ($user['password'] == sha1($password)) { login($user); }`;

export function PasswordHashChecker() {
  const [code, setCode] = useState("");
  const [submitted, setSubmitted] = useState<string | null>(null);
  const report = useMemo(() => (submitted === null ? null : analyzePasswordHashing(submitted)), [submitted]);

  return (
    <div className="mt-8 grid gap-6">
      <Card>
        <CardHeader><CardTitle>Paste PHP code</CardTitle></CardHeader>
        <CardContent className="grid gap-3">
          <label htmlFor="php-code" className="sr-only">PHP code</label>
          <textarea
            id="php-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            rows={10}
            spellCheck={false}
            placeholder={SAMPLE}
            className="w-full rounded-md border border-border bg-background p-3 font-mono text-sm"
          />
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setSubmitted(code)} disabled={!code.trim()}>Check password hashing</Button>
            <Button variant="outline" onClick={() => { setCode(SAMPLE); setSubmitted(SAMPLE); }}>Try a weak sample</Button>
          </div>
          <p className="text-xs text-muted-foreground">Runs entirely in your browser. Code is never sent to a server.</p>
        </CardContent>
      </Card>
      {report && (
        <Card aria-live="polite" data-testid="hash-report">
          <CardHeader>
            <CardTitle>
              {report.verdict === "weak" && `${report.weak} weak password hashing pattern${report.weak > 1 ? "s" : ""} found`}
              {report.verdict === "good" && "Looks good: password_hash / password_verify in use"}
              {report.verdict === "unknown" && "No password hashing code detected"}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            {report.findings.map((f, i) => (
              <div key={i} className="rounded-md border border-border p-3">
                <div className="flex items-center gap-2">
                  <Badge variant={f.severity === "high" ? "danger" : "warning"}>{f.severity}</Badge>
                  <span className="font-medium">Line {f.line}: {f.title}</span>
                </div>
                <code className="mt-2 block overflow-x-auto text-xs">{f.snippet}</code>
                <p className="mt-2 text-muted-foreground">{f.advice}</p>
              </div>
            ))}
            <p>
              Learn the safe pattern (password_hash, password_verify, password_needs_rehash):{" "}
              <a className="text-primary underline" href={PASSWORD_LESSON_URL} target="_blank" rel="noopener">
                Password Hashing in PHP on PHP Hub
              </a>
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
