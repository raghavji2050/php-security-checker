const USER_AGENT = "PHP-Security-Checker/1.0";

export class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

function backoffMs(attempt: number): number {
  const base = 1000 * 2 ** attempt;
  const jitter = Math.floor(Math.random() * 250);
  return Math.min(base + jitter, 30_000);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function request(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        "user-agent": USER_AGENT,
        accept: "application/json, text/html;q=0.9, */*;q=0.8",
        ...init.headers,
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

export type FetchOptions = {
  /** Retries after the first attempt. */
  retries?: number;
  /** Time limit for a single attempt. */
  timeoutMs?: number;
  /**
   * Total time budget for all attempts and waits together. A slow or failing upstream
   * gives up once this is spent, so callers can fall back to cached data instead of hanging.
   */
  deadlineMs?: number;
};

export const DEFAULT_DEADLINE_MS = 45_000;

/** Absolute time (ms since epoch) after which no new attempt or wait may start. */
type Budget = { endsAt: number };

function remaining(budget: Budget): number {
  return budget.endsAt - Date.now();
}

export class DeadlineError extends Error {
  constructor(host: string) {
    super(`Time budget exceeded waiting for ${host}`);
    this.name = "DeadlineError";
  }
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "upstream";
  }
}

async function retryLoop(
  url: string,
  init: RequestInit,
  retries: number,
  timeoutMs: number,
  budget: Budget,
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const left = remaining(budget);
    if (left <= 0) break;
    try {
      const response = await request(url, init, Math.min(timeoutMs, left));
      if (response.status === 429 || response.status === 502 || response.status === 503 || response.status === 504) {
        const retryAfter = Number(response.headers.get("retry-after"));
        const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : backoffMs(attempt);
        lastError = new HttpError(`Upstream returned HTTP ${response.status}`, response.status);
        if (attempt === retries || wait >= remaining(budget)) break;
        await sleep(wait);
        continue;
      }
      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("request failed");
      const wait = backoffMs(attempt);
      if (attempt === retries || wait >= remaining(budget)) break;
      await sleep(wait);
    }
  }

  throw lastError ?? new DeadlineError(hostOf(url));
}

function budgetFrom(options: FetchOptions | undefined): Budget {
  return { endsAt: Date.now() + (options?.deadlineMs ?? DEFAULT_DEADLINE_MS) };
}

export async function fetchWithRetry(url: string, init: RequestInit = {}, options: FetchOptions = {}): Promise<Response> {
  return retryLoop(url, init, options.retries ?? 4, options.timeoutMs ?? 90_000, budgetFrom(options));
}

export async function fetchJson<T>(url: string, init: RequestInit = {}, options?: FetchOptions): Promise<T> {
  const retries = options?.retries ?? 4;
  const timeoutMs = options?.timeoutMs ?? 90_000;
  const budget = budgetFrom(options);
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    if (remaining(budget) <= 0) break;
    try {
      const response = await retryLoop(url, init, 0, timeoutMs, budget);
      if (!response.ok) {
        throw new HttpError(`HTTP ${response.status} from ${hostOf(url)}`, response.status);
      }
      return (await response.json()) as T;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("request failed");
      if (attempt === retries || (error instanceof HttpError && error.status < 500 && error.status !== 429)) break;
      const wait = backoffMs(attempt);
      if (wait >= remaining(budget)) break;
      await sleep(wait);
    }
  }

  throw lastError ?? new DeadlineError(hostOf(url));
}

export async function fetchText(url: string, init: RequestInit = {}, options?: FetchOptions): Promise<string> {
  const response = await fetchWithRetry(url, init, options);
  if (!response.ok) {
    throw new HttpError(`HTTP ${response.status} from ${new URL(url).host}`, response.status);
  }
  return response.text();
}
