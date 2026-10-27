import type { Metadata } from "next";
import { VersionsBoard } from "@/components/versions-board";

export const metadata: Metadata = {
  title: "PHP Versions",
  description: "Official PHP branch support windows from php.net: active support, security-only, end of life, and the latest patch release on each branch.",
};

export default function VersionsPage() {
  return (
    <main className="mx-auto w-full min-w-0 max-w-6xl px-4 py-10">
      <p className="text-sm font-medium uppercase tracking-[0.18em] text-primary">Lifecycle</p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight">PHP Versions</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        Branch, initial release, active support, security support, end-of-life status, and the latest patch release,
        taken from official php.net data.
      </p>
      <div className="mt-8">
        <VersionsBoard />
      </div>
    </main>
  );
}
