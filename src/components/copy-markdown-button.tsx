"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

/** Copies a ready-made Markdown report (GitHub issue / PR / Jira friendly). */
export function CopyMarkdownButton({ markdown, label = "Copy as Markdown" }: { markdown: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this Markdown", markdown);
    }
  }
  return (
    <Button type="button" variant="outline" onClick={() => void copy()} data-testid="copy-markdown">
      {copied ? <Check /> : <Copy />}
      {copied ? "Copied" : label}
    </Button>
  );
}
