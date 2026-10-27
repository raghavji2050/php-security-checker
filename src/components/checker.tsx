"use client";

import { AlertTriangle, Loader2, RotateCw, Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { ResultsDashboard } from "@/components/results-dashboard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import type { CheckResult } from "@/lib/types";
import { parsePhpVersion } from "@/lib/version";

const FORMAT_ERROR = "Use the format MAJOR.MINOR.PATCH, e.g. 8.1.12";

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
  // `v` is the shareable form (/?v=8.1.12); `version` is still read so older links keep working.
  const requested = (params.get("v") ?? params.get("version") ?? "").trim();
  const [value, setValue] = useState(requested);
  const [trackedRequest, setTrackedRequest] = useState(requested);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [failure, setFailure] = useState<{ version: string; message: string } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const history = useSyncExternalStore(subscribeHistory, getHistorySnapshot, getServerHistorySnapshot);

  if (requested !== trackedRequest) {
    setTrackedRequest(requested);
    setValue(requested);
  }

  const parsedRequest = parsePhpVersion(requested);
  const requestedRaw = parsedRequest?.raw ?? "";
  const validationError = requested && !parsedRequest ? FORMAT_ERROR : null;
  const fetchError = failure?.version === requestedRaw ? failure.message : null;
  const error = formError ?? validationError;
  const loading = Boolean(requestedRaw) && result?.version !== requestedRaw && !fetchError;

  useEffect(() => {
    if (!requestedRaw) return;
    const controller = new AbortController();
    const version = requestedRaw;
    void fetch(`/api/check?version=${encodeURIComponent(version)}`, { signal: controller.signal })
      .then(async (response) => {
        const body = (await response.json().catch(() => ({}))) as CheckResult & { error?: string };
        if (!response.ok) throw new Error(friendlyError(response.status, body.error));
        setResult(body);
        writeHistory(version);
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setFailure({
          version,
          message:
            reason instanceof TypeError
              ? "Could not reach the checker. Check your connection and retry."
              : reason instanceof Error
                ? reason.message
                : "The check could not be completed.",
        });
      });
    return () => controller.abort();
  }, [requestedRaw, attempt]);

  function retry() {
    setFailure(null);
    setAttempt((value) => value + 1);
  }

  function submit(next: string) {
    const parsed = parsePhpVersion(next);
    if (!parsed) {
      setFormError(FORMAT_ERROR);
      return;
    }
    setFormError(null);
    router.push(`/?v=${encodeURIComponent(parsed.raw)}`);
  }

  return (
    <div>
      <section className="mx-auto min-w-0 max-w-6xl px-4 pb-4 pt-10 md:pt-16">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-primary">Runtime advisory desk</p>
        <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight text-balance md:text-6xl">
          Check your PHP version for known vulnerabilities
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-8 text-muted-foreground">
          Enter your PHP version to see known runtime vulnerabilities in official records, and which supported release to
          upgrade to.
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
                  aria-describedby={error ? "version-help version-error" : "version-help"}
                  value={value}
                  onChange={(event) => {
                    setValue(event.target.value);
                    setFormError(null);
                  }}
                />
              </div>
              <Button type="submit" size="lg" className="sm:self-end" disabled={loading}>
                {loading ? <Loader2 className="animate-spin" /> : <Search />}
                {loading ? "Checking…" : "Check Security"}
              </Button>
            </form>
            <p id="version-help" className="mt-3 text-sm text-muted-foreground">
              Run <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">php -v</code> in your terminal to see your
              version. This check does not connect to your server.
            </p>
            {error && (
              <p id="version-error" role="alert" className="mt-3 text-sm text-danger">
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
        {loading && <ResultsSkeleton version={requestedRaw} />}
        {!loading && fetchError && <FetchErrorPanel message={fetchError} onRetry={retry} />}
        {!loading && !fetchError && result && result.version === requestedRaw && <ResultsDashboard result={result} />}
        {!loading && !fetchError && !error && (!result || result.version !== requestedRaw) && <IdlePanel />}
      </section>
    </div>
  );
}

function friendlyError(status: number, message?: string): string {
  if (status === 429) return "Too many checks in a short time. Wait a minute, then retry.";
  if (status === 400) return message || FORMAT_ERROR;
  if (status === 503) {
    return message || "Vulnerability data from NVD is unavailable right now and no cached copy exists. Please retry shortly.";
  }
  if (status === 504 || status === 502) return "The data sources took too long to answer. Please retry.";
  return message || "The check could not be completed. Please retry.";
}

function FetchErrorPanel({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Card className="mt-8 border-danger/40">
      <CardContent className="flex flex-col items-start gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <p role="alert" className="flex items-start gap-2 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />
          <span>
            <span className="font-medium">Unable to verify right now.</span> {message}
          </span>
        </p>
        <Button type="button" variant="outline" onClick={onRetry}>
          <RotateCw />
          Retry
        </Button>
      </CardContent>
    </Card>
  );
}

function ResultsSkeleton({ version }: { version: string }) {
  return (
    <div className="mt-8 space-y-3">
      <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        Checking PHP {version} against NVD, php.net and GitHub records…
      </p>
      <div className="space-y-3" aria-hidden="true">
      <Skeleton className="h-28 w-full" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-48 w-full" />
      </div>
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
