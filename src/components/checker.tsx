"use client";

import { Loader2, Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { ResultsDashboard } from "@/components/results-dashboard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import type { CheckResult } from "@/lib/types";
import { parsePhpVersion } from "@/lib/version";

const HISTORY_KEY = "php-security-checker.history";

function readHistory(): string[] {
  try {
    const stored = window.localStorage.getItem(HISTORY_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string").slice(0, 8);
  } catch {
    return [];
  }
}

const historyListeners = new Set<() => void>();
const EMPTY_HISTORY: string[] = [];
let cachedRaw: string | null = null;
let cachedHistory: string[] = EMPTY_HISTORY;

function subscribeHistory(listener: () => void) {
  historyListeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === HISTORY_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    historyListeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function getHistorySnapshot(): string[] {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(HISTORY_KEY);
  } catch {
    raw = null;
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedHistory = readHistory();
  }
  return cachedHistory;
}

function getServerHistorySnapshot(): string[] {
  return EMPTY_HISTORY;
}

function writeHistory(version: string) {
  const next = [version, ...readHistory().filter((item) => item !== version)].slice(0, 8);
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  } catch {
    // Storage may be unavailable (private mode, quota); history is optional.
  }
  historyListeners.forEach((listener) => listener());
}

export function Checker() {
  const params = useSearchParams();
  const router = useRouter();
  const requested = params.get("version") ?? "";
  const [value, setValue] = useState(requested);
  const [trackedRequest, setTrackedRequest] = useState(requested);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [failure, setFailure] = useState<{ version: string; message: string } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const history = useSyncExternalStore(subscribeHistory, getHistorySnapshot, getServerHistorySnapshot);

  if (requested !== trackedRequest) {
    setTrackedRequest(requested);
    setValue(requested);
  }

  const parsedRequest = parsePhpVersion(requested);
  const requestedRaw = parsedRequest?.raw ?? "";
  const validationError = requested && !parsedRequest
    ? "Enter a full release as MAJOR.MINOR.PATCH, for example 8.1.12. A branch such as 8.1 is not a specific release."
    : null;
  const fetchError = failure?.version === requestedRaw ? failure.message : null;
  const error = formError ?? validationError ?? fetchError;
  const loading = Boolean(requestedRaw) && result?.version !== requestedRaw && !fetchError;

  useEffect(() => {
    if (!requestedRaw) return;
    const controller = new AbortController();
    const version = requestedRaw;
    void fetch(`/api/check?version=${encodeURIComponent(version)}`, { signal: controller.signal })
      .then(async (response) => {
        const body = (await response.json()) as CheckResult & { error?: string };
        if (!response.ok) throw new Error(body.error || "The check could not be completed.");
        setResult(body);
        writeHistory(version);
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setFailure({
          version,
          message: reason instanceof Error ? reason.message : "The check could not be completed.",
        });
      });
    return () => controller.abort();
  }, [requestedRaw]);

  function submit(next: string) {
    const parsed = parsePhpVersion(next);
    if (!parsed) {
      setFormError("Enter a full release as MAJOR.MINOR.PATCH, for example 8.1.12.");
      return;
    }
    setFormError(null);
    router.push(`/?version=${encodeURIComponent(parsed.raw)}`);
  }

  return (
    <div>
      <section className="mx-auto max-w-6xl px-4 pb-4 pt-10 md:pt-16">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-primary">Runtime advisory desk</p>
        <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight text-balance md:text-6xl">
          Is Your PHP Version Secure?
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-8 text-muted-foreground">
          Check your PHP version against known security vulnerabilities and discover the safest upgrade path.
        </p>
        <Card className="mt-8">
          <CardContent className="p-4 md:p-6">
            <form
              className="flex flex-col gap-3 sm:flex-row"
              onSubmit={(event) => {
                event.preventDefault();
                submit(value);
              }}
            >
              <div className="flex-1">
                <label htmlFor="php-version" className="mb-2 block text-sm font-medium">
                  Installed PHP version
                </label>
                <Input
                  id="php-version"
                  name="version"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="8.1.12"
                  aria-invalid={Boolean(error)}
                  aria-describedby="version-help"
                  value={value}
                  onChange={(event) => {
                    setValue(event.target.value);
                    setFormError(null);
                  }}
                />
              </div>
              <Button type="submit" size="lg" className="sm:self-end" disabled={loading}>
                {loading ? <Loader2 className="animate-spin" /> : <Search />}
                Check Security
              </Button>
            </form>
            <p id="version-help" className="mt-3 text-sm text-muted-foreground">
              Use MAJOR.MINOR.PATCH only. Example: 8.1.12. This check does not connect to your server.
            </p>
            {error && (
              <p role="alert" className="mt-3 text-sm text-danger">
                {error}
              </p>
            )}
            {history.length > 0 && (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="text-xs uppercase tracking-wide text-muted-foreground">Recent</span>
                {history.map((item) => (
                  <button
                    key={item}
                    type="button"
                    className="rounded-full border border-border px-3 py-1 font-mono text-xs hover:bg-muted"
                    onClick={() => submit(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        {loading && <ResultsSkeleton />}
        {!loading && result && <ResultsDashboard result={result} />}
        {!loading && !result && !error && <IdlePanel />}
      </section>
    </div>
  );
}

function ResultsSkeleton() {
  return (
    <div className="mt-8 space-y-3" aria-hidden="true">
      <Skeleton className="h-28 w-full" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-48 w-full" />
    </div>
  );
}

function IdlePanel() {
  return (
    <div className="mt-8 grid gap-3 md:grid-cols-3">
      {[
        ["Red", "A structured PHP runtime range confirms this version is affected."],
        ["Yellow", "The branch is unsupported, the data is stale, or a match still needs verification."],
        ["Green", "No matching CVE was confirmed and the branch is still supported. Green is not a guarantee."],
      ].map(([title, copy]) => (
        <Card key={title}>
          <CardContent className="p-5">
            <p className="font-medium">{title}</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{copy}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
