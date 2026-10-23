"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { SourceInfo, SupportState } from "@/lib/types";

type BranchRow = {
  branch: string;
  initialReleaseDate: string | null;
  activeSupportEnd: string | null;
  securitySupportEnd: string | null;
  state: SupportState;
  latestPatch: string | null;
};

type Payload = {
  branches: BranchRow[];
  retrievedAt: string | null;
  stale: boolean;
  warnings: string[];
  sources: SourceInfo[];
  error?: string;
};

const STATE_LABEL: Record<SupportState, string> = {
  active: "Active support",
  security: "Security fixes only",
  eol: "End of life",
  unknown: "Unknown",
};

function formatDay(value: string | null): string {
  if (!value) return "Not published";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))));
}

export function VersionsBoard() {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/php-versions", { signal: controller.signal })
      .then(async (response) => {
        const body = (await response.json()) as Payload;
        if (!response.ok) throw new Error(body.error || "PHP version data could not be loaded.");
        setPayload(body);
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setError(reason instanceof Error ? reason.message : "PHP version data could not be loaded.");
      });
    return () => controller.abort();
  }, []);

  if (error) {
    return <p role="alert" className="text-danger">{error}</p>;
  }
  if (!payload) {
    return (
      <div className="space-y-2" aria-hidden="true">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {payload.stale && (
        <p className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
          This table is from a stale cache{payload.retrievedAt ? ` synced ${payload.retrievedAt}` : ""}. It is not current.
        </p>
      )}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Branch</TableHead>
                <TableHead>Initial release</TableHead>
                <TableHead>Active support end</TableHead>
                <TableHead>Security support end</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Latest patch</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payload.branches.map((branch) => (
                <TableRow key={branch.branch}>
                  <TableCell className="font-mono font-medium">{branch.branch}</TableCell>
                  <TableCell>{formatDay(branch.initialReleaseDate)}</TableCell>
                  <TableCell>{formatDay(branch.activeSupportEnd)}</TableCell>
                  <TableCell>{formatDay(branch.securitySupportEnd)}</TableCell>
                  <TableCell>
                    <Badge variant={branch.state === "eol" ? "danger" : branch.state === "security" ? "warning" : branch.state === "active" ? "ok" : "outline"}>
                      {STATE_LABEL[branch.state]}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono">{branch.latestPatch ?? "Not provided"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      {payload.warnings.map((warning) => (
        <p key={warning} className="text-sm text-muted-foreground">{warning}</p>
      ))}
      <p className="text-sm text-muted-foreground">
        Dates come from php.net&apos;s supported-versions and end-of-life pages, release JSON, and the published support
        schedule. Missing active-support dates on older branches are derived with that same schedule and labeled only
        when the page itself does not publish them.
      </p>
    </div>
  );
}
