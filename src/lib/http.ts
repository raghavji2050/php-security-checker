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

export async function fetchWithRetry(
  url: string,
  init: RequestInit = {},
  options: { retries?: number; timeoutMs?: number } = {},
): Promise<Response> {
  const retries = options.retries ?? 4;
  const timeoutMs = options.timeoutMs ?? 90_000;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await request(url, init, timeoutMs);
      if (response.status === 429 || response.status === 502 || response.status === 503 || response.status === 504) {
        const retryAfter = Number(response.headers.get("retry-after"));
        const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : backoffMs(attempt);
        lastError = new HttpError(`Upstream returned HTTP ${response.status}`, response.status);
        if (attempt === retries) break;
        await sleep(wait);
        continue;
      }
      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("request failed");
      if (attempt === retries) break;
      await sleep(backoffMs(attempt));
    }
  }

  throw lastError ?? new Error("request failed");
}

export async function fetchJson<T>(url: string, init: RequestInit = {}, options?: { retries?: number; timeoutMs?: number }): Promise<T> {
  const retries = options?.retries ?? 4;
  const timeoutMs = options?.timeoutMs ?? 90_000;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetchWithRetry(url, init, { retries: 0, timeoutMs });
      if (!response.ok) {
        throw new HttpError(`HTTP ${response.status} from ${new URL(url).host}`, response.status);
      }
      return (await response.json()) as T;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("request failed");
      if (attempt === retries || (error instanceof HttpError && error.status < 500 && error.status !== 429)) break;
      await new Promise((resolve) => setTimeout(resolve, backoffMs(attempt)));
    }
  }

  throw lastError ?? new Error("request failed");
}

export async function fetchText(url: string, init: RequestInit = {}, options?: { retries?: number; timeoutMs?: number }): Promise<string> {
  const response = await fetchWithRetry(url, init, options);
  if (!response.ok) {
    throw new HttpError(`HTTP ${response.status} from ${new URL(url).host}`, response.status);
  }
  return response.text();
}
