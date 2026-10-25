import type { Metadata } from "next";
import { Suspense } from "react";
import { Checker } from "@/components/checker";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = {
  title: { absolute: "PHP Security Checker · Check your PHP version for known vulnerabilities" },
  description:
    "Enter your PHP version to see known runtime vulnerabilities from NVD, php.net and GitHub, its support status, and which supported release to upgrade to.",
};

export default function HomePage() {
  return (
    <main>
      <Suspense fallback={<div className="mx-auto max-w-6xl px-4 py-16"><Skeleton className="h-64 w-full" /></div>}>
        <Checker />
      </Suspense>
    </main>
  );
}
