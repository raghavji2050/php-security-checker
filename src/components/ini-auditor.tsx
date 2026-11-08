"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { auditIni, MAX_INI_BYTES, parseIni, type IniFinding, type IniLevel, type IniTarget } from "@/lib/ini-audit";

const SAMPLE = `display_errors = On
expose_php = On
allow_url_include = Off
allow_url_fopen = On
disable_functions =
open_basedir =
session.cookie_httponly = 0
session.cookie_secure = 0
session.cookie_samesite = None
session.use_strict_mode = 0
file_uploads = On
upload_max_filesize = 64M
post_max_size = 8M
max_execution_time = 0
error_reporting = E_ALL
log_errors = Off
`;

const LEVEL: Record<IniLevel, "danger" | "warning" | "ok" | "secondary"> = {
  high: "danger",
  review: "warning",
  ok: "ok",
  info: "secondary",
};

export function IniAuditor() {
  const [text, setText] = useState("");
  const [target, setTarget] = useState<IniTarget>("production");
  const [error, setError] = useState<string | null>(null);
  const [findings, setFindings] = useState<IniFinding[] | null>(null);

  function run(source: string) {
    const parsed = parseIni(source);
    if (!parsed.ok) {
      setFindings(null);
      setError(parsed.error);
      return;
    }
    setError(null);
    setFindings(auditIni(parsed.values, target));
  }

  return (
    <div className="mt-8 space-y-4">
      <Card>
        <CardContent className="space-y-3 p-4 md:p-6">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Which environment this file is for">
            {(["production", "development"] as const).map((item) => (
              <Button key={item} type="button" size="sm" variant={target === item ? "default" : "outline"} onClick={() => setTarget(item)}>
                {item === "production" ? "Production file" : "Development file"}
              </Button>
            ))}
          </div>
          <label className="block text-sm font-medium" htmlFor="ini-text">php.ini directives</label>
          <textarea
            id="ini-text"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={"display_errors = Off\nallow_url_include = Off"}
            className="min-h-48 w-full rounded-md border border-border bg-background p-3 font-mono text-sm"
          />
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => run(text)}>Audit</Button>
            <Button type="button" variant="outline" onClick={() => { setText(SAMPLE); run(SAMPLE); }}>Use sample</Button>
            <label className="inline-flex cursor-pointer items-center rounded-md border border-border bg-card px-4 text-sm hover:bg-muted">
              Upload
              <input
                type="file"
                accept=".ini,text/plain"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (!file) return;
                  if (file.size > MAX_INI_BYTES) {
                    setFindings(null);
                    setError("File is too large (max 512 KB).");
                    return;
                  }
                  void file.text().then((content) => {
                    setText(content);
                    run(content);
                  });
                }}
              />
            </label>
          </div>
          <p className="text-sm text-muted-foreground">
            Parsing happens in your browser. The file is not uploaded and not executed. Max 512 KB. A directive that is
            missing is reported as not set — PHP defaults are not guessed, because development and production templates differ.
          </p>
        </CardContent>
      </Card>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      {findings && findings.length === 0 && <p className="text-sm text-muted-foreground">No findings for this file.</p>}
      {findings && findings.length > 0 && (
        <ul className="space-y-3">
          {findings.map((item) => (
            <li key={item.id}>
              <Card>
                <CardHeader>
                  <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                    <Badge variant={LEVEL[item.level]}>{item.level}</Badge>
                    <span className="font-mono">{item.directive}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm leading-6">
                  <p><span className="text-muted-foreground">Current: </span>{item.current}</p>
                  <p><span className="text-muted-foreground">Recommended: </span>{item.recommended}</p>
                  <p><span className="text-muted-foreground">Risk: </span>{item.risk}</p>
                  <p>{item.why}</p>
                  <p>{item.fix}</p>
                  <pre className="overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs">{item.example}</pre>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
