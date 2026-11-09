"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { normalizeSymfonyVersion } from "@/lib/symfony-support-input";

export function SymfonyForm({ initial = "" }: { initial?: string }) {
  const router = useRouter();
  const [version, setVersion] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-2">
    <form
      className="flex flex-col gap-3 sm:flex-row"
      onSubmit={(event) => {
        event.preventDefault();
        const normalized = normalizeSymfonyVersion(version);
        if (!normalized) {
          setError("Use a stable MAJOR.MINOR.PATCH version, for example 7.4.10.");
          return;
        }
        setError(null);
        router.push(`/symfony/check/${normalized}`);
      }}
    >
      <label className="flex-1 text-sm">
        <span className="mb-1 block font-medium">symfony/symfony version</span>
        <Input value={version} onChange={(event) => setVersion(event.target.value)} placeholder="7.4.10" />
      </label>
      <Button type="submit" className="sm:self-end">Check Symfony</Button>
    </form>
    {error && <p id="symfony-error" role="alert" className="text-sm text-danger">{error}</p>}
    </div>
  );
}
