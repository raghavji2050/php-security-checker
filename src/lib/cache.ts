import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export type CacheEnvelope<T> = {
  storedAt: string;
  ttlMs: number;
  data: T;
};

type MemoryEntry = {
  expiresAt: number;
  envelope: CacheEnvelope<unknown>;
};

const memory = new Map<string, MemoryEntry>();
const inflight = new Map<string, Promise<unknown>>();

export class CacheMissError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CacheMissError";
  }
}

export function cacheDirectory(): string {
  return process.env.CACHE_DIR || path.join(os.tmpdir(), "php-security-checker");
}

function memoryKey(key: string): string {
  return `${cacheDirectory()}::${key}`;
}

function fileFor(key: string): string {
  const safe = key.replace(/[^a-z0-9._-]/gi, "_");
  return path.join(cacheDirectory(), `${safe}.json`);
}

export function isFresh(envelope: CacheEnvelope<unknown>, now = Date.now()): boolean {
  const stored = Date.parse(envelope.storedAt);
  if (Number.isNaN(stored)) return false;
  return now - stored < envelope.ttlMs;
}

export async function readCache<T>(key: string): Promise<CacheEnvelope<T> | null> {
  const cached = memory.get(memoryKey(key));
  if (cached && cached.expiresAt > Date.now()) {
    return cached.envelope as CacheEnvelope<T>;
  }
  try {
    const raw = await readFile(fileFor(key), "utf8");
    const envelope = JSON.parse(raw) as CacheEnvelope<T>;
    if (!envelope || typeof envelope.storedAt !== "string" || !("data" in envelope)) return null;
    if (isFresh(envelope)) {
      memory.set(memoryKey(key), {
        expiresAt: Date.parse(envelope.storedAt) + envelope.ttlMs,
        envelope,
      });
    }
    return envelope;
  } catch {
    return null;
  }
}

export async function writeCache<T>(key: string, data: T, ttlMs: number, storedAt = new Date().toISOString()): Promise<void> {
  const envelope: CacheEnvelope<T> = { storedAt, ttlMs, data };
  const directory = cacheDirectory();
  await mkdir(directory, { recursive: true });
  const destination = fileFor(key);
  const temporary = `${destination}.${process.pid}.tmp`;
  await writeFile(temporary, JSON.stringify(envelope));
  await rename(temporary, destination);
  memory.set(memoryKey(key), {
    expiresAt: Date.parse(storedAt) + ttlMs,
    envelope,
  });
}

export async function getOrLoad<T>(options: {
  key: string;
  ttlMs: number;
  load: () => Promise<T>;
  allowStale: boolean;
}): Promise<{ data: T; storedAt: string; stale: boolean }> {
  const existing = inflight.get(memoryKey(options.key));
  if (existing) return existing as Promise<{ data: T; storedAt: string; stale: boolean }>;

  const promise = loadThroughCache(options);
  inflight.set(memoryKey(options.key), promise);
  try {
    return await promise;
  } finally {
    inflight.delete(memoryKey(options.key));
  }
}

async function loadThroughCache<T>(options: {
  key: string;
  ttlMs: number;
  load: () => Promise<T>;
  allowStale: boolean;
}): Promise<{ data: T; storedAt: string; stale: boolean }> {
  const cached = await readCache<T>(options.key);
  if (cached && isFresh(cached)) {
    return { data: cached.data, storedAt: cached.storedAt, stale: false };
  }

  try {
    const data = await options.load();
    const storedAt = new Date().toISOString();
    await writeCache(options.key, data, options.ttlMs, storedAt);
    return { data, storedAt, stale: false };
  } catch (error) {
    if (options.allowStale && cached) {
      return { data: cached.data, storedAt: cached.storedAt, stale: true };
    }
    const reason = error instanceof Error ? error.message : "unknown error";
    throw new CacheMissError(reason);
  }
}

export function secondsFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}
