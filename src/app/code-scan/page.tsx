import type { Metadata } from "next";
import { CodeScanner } from "@/components/code-scanner";
import { COMMAND_INJECTION_LESSON_URL } from "@/lib/code-scan";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "PHP command-injection check",
  description:
    "Paste PHP to flag exec, shell_exec, system, passthru, popen, proc_open and backticks when they use request input. Runs in your browser.",
  alternates: { canonical: new URL("/code-scan", SITE_URL).toString() },
};

export default function CodeScanPage() {
  return (
    <main className="mx-auto w-full min-w-0 max-w-6xl px-4 py-10">
      <p className="text-sm font-medium uppercase tracking-[0.18em] text-primary">Code check</p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight">PHP command-injection check</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        Flags <code className="font-mono text-sm">exec</code>, <code className="font-mono text-sm">shell_exec</code>,{" "}
        <code className="font-mono text-sm">system</code>, <code className="font-mono text-sm">passthru</code>,{" "}
        <code className="font-mono text-sm">popen</code>, <code className="font-mono text-sm">proc_open</code> and
        backtick operators when they are fed by request input (<code className="font-mono text-sm">$_GET</code>,{" "}
        <code className="font-mono text-sm">$_POST</code>, <code className="font-mono text-sm">$_REQUEST</code>,{" "}
        <code className="font-mono text-sm">$_COOKIE</code>, <code className="font-mono text-sm">$request-&gt;input()</code>,{" "}
        <code className="font-mono text-sm">request()</code>). It is a heuristic pattern check, not a full static
        analyser, and the code never leaves your browser.{" "}
        <a className="text-primary underline" href={COMMAND_INJECTION_LESSON_URL}>
          Read the PHP Hub lesson
        </a>
        .
      </p>
      <CodeScanner />
    </main>
  );
}
