import { Suspense } from "react";
import { Checker } from "@/components/checker";
import { Skeleton } from "@/components/ui/skeleton";

export default function HomePage() {
  return (
    <main>
      <Suspense fallback={<div className="mx-auto max-w-6xl px-4 py-16"><Skeleton className="h-64 w-full" /></div>}>
        <Checker />
      </Suspense>
    </main>
  );
}
