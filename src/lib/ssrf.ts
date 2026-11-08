import { lookup } from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import { isIP } from "node:net";

/**
 * SSRF gate for the security-headers tool.
 * Allows public HTTP(S) on ports 80 and 443 only.
 * Blocks loopback, private, link-local, CGNAT, documentation, multicast,
 * cloud-metadata names, and redirects onto those targets.
 * DNS is checked before the request and again when the connection is made.
 */

export class SsrfError extends Error {
  constructor(readonly code: "blocked" | "no_addresses" | "dns") {
    super(code);
    this.name = "SsrfError";
  }
}

const BLOCKED_HOSTS = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata",
  "metadata.google.internal",
  "metadata.google.com",
  "metadata.azure.com",
  "instance-data",
  "instance-data.ec2.internal",
  "kubernetes",
  "kubernetes.default",
  "kubernetes.default.svc",
  "host.docker.internal",
  "gateway.docker.internal",
]);

const V4_BLOCKS: [string, number][] = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
];

export type UrlCheck = { ok: true; url: URL } | { ok: false; code: "invalid_url" | "blocked_target" };

export function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  const nums = parts.map((part) => (/^\d{1,3}$/.test(part) ? Number(part) : -1));
  if (nums.some((n) => n < 0 || n > 255)) return null;
  return (((nums[0] << 24) | (nums[1] << 16) | (nums[2] << 8) | nums[3]) >>> 0);
}

function inCidr(ip: number, base: string, bits: number): boolean {
  const start = ipv4ToInt(base);
  if (start === null) return false;
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (ip & mask) === (start & mask);
}

export function isBlockedIpv4(ip: string): boolean {
  const value = ipv4ToInt(ip);
  if (value === null) return true;
  return V4_BLOCKS.some(([base, bits]) => inCidr(value, base, bits));
}

export function expandIpv6(ip: string): string | null {
  if (ip.includes(".")) return null;
  const halves = ip.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  if ([...head, ...tail].some((part) => !/^[0-9a-f]{1,4}$/i.test(part))) return null;
  if (halves.length === 1) {
    if (head.length !== 8) return null;
    return head.map((part) => part.padStart(4, "0")).join(":");
  }
  const missing = 8 - head.length - tail.length;
  if (missing < 0) return null;
  return [...head, ...Array.from({ length: missing }, () => "0"), ...tail].map((part) => part.padStart(4, "0")).join(":");
}

function unwrapMapped(ip: string): string | null {
  const dotted = /^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i.exec(ip);
  if (dotted) return dotted[1];
  const hex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i.exec(ip);
  if (!hex) return null;
  const hi = Number.parseInt(hex[1], 16);
  const lo = Number.parseInt(hex[2], 16);
  return `${(hi >> 8) & 255}.${hi & 255}.${(lo >> 8) & 255}.${lo & 255}`;
}

export function isBlockedIpv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  const mapped = unwrapMapped(lower);
  if (mapped) return isBlockedIpv4(mapped);
  const full = expandIpv6(lower);
  if (!full) return true;
  const groups = full.split(":").map((part) => Number.parseInt(part, 16));
  const first = groups[0] ?? 0;
  if ((first & 0xfe00) === 0xfc00) return true;
  if ((first & 0xffc0) === 0xfe80) return true;
  if ((first & 0xff00) === 0xff00) return true;
  if (groups[0] === 0x2001 && groups[1] === 0x0db8) return true;
  if (groups[0] === 0 && groups[1] === 0 && groups[2] === 0 && groups[3] === 0 && groups[4] === 0 && groups[5] === 0xffff) {
    const embedded = `${(groups[6] >> 8) & 255}.${groups[6] & 255}.${(groups[7] >> 8) & 255}.${groups[7] & 255}`;
    return isBlockedIpv4(embedded);
  }
  if (groups[0] === 0x0064 && groups[1] === 0xff9b && groups[2] === 0 && groups[3] === 0 && groups[4] === 0 && groups[5] === 0) {
    const embedded = `${(groups[6] >> 8) & 255}.${groups[6] & 255}.${(groups[7] >> 8) & 255}.${groups[7] & 255}`;
    return isBlockedIpv4(embedded);
  }
  if (groups[0] === 0x0064 && groups[1] === 0xff9b && (groups[2] & 0xff00) === 0x0100) return true;
  if (full === "0000:0000:0000:0000:0000:0000:0000:0000" || full === "0000:0000:0000:0000:0000:0000:0000:0001") return true;
  return false;
}

export function isBlockedIp(ip: string): boolean {
  const family = isIP(ip);
  if (family === 4) return isBlockedIpv4(ip);
  if (family === 6) return isBlockedIpv6(ip);
  return true;
}

export function isBlockedHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  if (!host || BLOCKED_HOSTS.has(host)) return true;
  return (
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".localdomain") ||
    host.endsWith(".internal") ||
    host.endsWith(".arpa") ||
    host.endsWith(".metadata.google.internal")
  );
}

/** Decimal, hex, octal, and short dotted forms that some clients treat as IP addresses. */
export function isObfuscatedIp(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (/^\d+$/.test(host) || /^0x[0-9a-f]+$/i.test(host)) return true;
  if (host.split(".").some((part) => /^0x/i.test(part))) return true;
  const parts = host.split(".");
  if (parts.length >= 1 && parts.length <= 4 && parts.every((part) => /^\d+$/.test(part))) {
    if (parts.length !== 4) return true;
    if (parts.some((part) => part.length > 1 && part.startsWith("0"))) return true;
  }
  return false;
}

export function assertPublicAddresses(ips: string[]): void {
  if (ips.length === 0) throw new SsrfError("no_addresses");
  if (ips.some((ip) => isBlockedIp(ip))) throw new SsrfError("blocked");
}

/** Node's URL.hostname keeps brackets around IPv6 literals (`[::1]`). */
export function bareHostname(hostname: string): string {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  if (host.startsWith("[") && host.endsWith("]")) return host.slice(1, -1);
  return host;
}

export function validatePublicUrl(input: string): UrlCheck {
  if (typeof input !== "string") return { ok: false, code: "invalid_url" };
  const raw = input.trim();
  if (!raw || raw.length > 2048 || /[\s\\]/.test(raw)) return { ok: false, code: "invalid_url" };
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, code: "invalid_url" };
  }
  if (url.username || url.password) return { ok: false, code: "blocked_target" };
  if (url.protocol !== "http:" && url.protocol !== "https:") return { ok: false, code: "invalid_url" };
  if (url.port !== "" && url.port !== "80" && url.port !== "443") return { ok: false, code: "blocked_target" };
  const host = bareHostname(url.hostname);
  if (!host || host.includes("%")) return { ok: false, code: "blocked_target" };
  if (isBlockedHostname(host) || isObfuscatedIp(host)) return { ok: false, code: "blocked_target" };
  if (isIP(host) && isBlockedIp(host)) return { ok: false, code: "blocked_target" };
  return { ok: true, url };
}

export async function resolvePublicHost(hostname: string): Promise<string[]> {
  const host = bareHostname(hostname);
  if (isBlockedHostname(host) || isObfuscatedIp(host)) throw new SsrfError("blocked");
  if (isIP(host)) {
    if (isBlockedIp(host)) throw new SsrfError("blocked");
    return [host];
  }
  let records: { address: string }[];
  try {
    records = await lookup(host, { all: true, verbatim: true });
  } catch {
    throw new SsrfError("dns");
  }
  const ips = records.map((record) => record.address);
  assertPublicAddresses(ips);
  return ips;
}

export type HeaderResponse = { status: number; headers: Headers; url: string };

export type HeaderFetchDeps = {
  resolve: (hostname: string) => Promise<string[]>;
  request: (url: string, signal: AbortSignal) => Promise<HeaderResponse>;
};

const REDIRECTS = new Set([301, 302, 303, 307, 308]);

export async function fetchPublicHeaders(
  input: string,
  deps: HeaderFetchDeps,
  timeoutMs = 8000,
): Promise<
  | { ok: true; status: number; finalUrl: string; headers: Record<string, string>; redirects: string[] }
  | { ok: false; code: "invalid_url" | "blocked_target" | "too_many_redirects" | "timeout" | "fetch_failed" }
> {
  const checked = validatePublicUrl(input);
  if (!checked.ok) return checked;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const redirects: string[] = [];
  let current = checked.url;
  try {
    for (let hop = 0; hop <= 3; hop += 1) {
      await deps.resolve(bareHostname(current.hostname));
      const response = await deps.request(current.toString(), controller.signal);
      if (!REDIRECTS.has(response.status)) {
        return { ok: true, status: response.status, finalUrl: current.toString(), headers: pickHeaders(response.headers), redirects };
      }
      const location = response.headers.get("location");
      if (!location) return { ok: false, code: "fetch_failed" };
      if (hop === 3) return { ok: false, code: "too_many_redirects" };
      let next: URL;
      try {
        next = new URL(location, current);
      } catch {
        return { ok: false, code: "invalid_url" };
      }
      const nextCheck = validatePublicUrl(next.toString());
      if (!nextCheck.ok) return { ok: false, code: "blocked_target" };
      redirects.push(nextCheck.url.toString());
      current = nextCheck.url;
    }
    return { ok: false, code: "too_many_redirects" };
  } catch (error) {
    if (controller.signal.aborted) return { ok: false, code: "timeout" };
    if (error instanceof SsrfError) return { ok: false, code: "blocked_target" };
    return { ok: false, code: "fetch_failed" };
  } finally {
    clearTimeout(timer);
  }
}

const HEADER_ALLOW = [
  "strict-transport-security",
  "content-security-policy",
  "content-security-policy-report-only",
  "x-content-type-options",
  "x-frame-options",
  "referrer-policy",
  "permissions-policy",
  "cross-origin-opener-policy",
  "cross-origin-resource-policy",
  "cross-origin-embedder-policy",
  "x-powered-by",
  "server",
  "x-xss-protection",
];

export function pickHeaders(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  for (const name of HEADER_ALLOW) {
    const value = headers.get(name);
    if (value) out[name] = value.slice(0, 500);
  }
  return out;
}

/**
 * Connect to an address that just passed the public-IP check.
 * TLS uses the original hostname for SNI and certificate checks.
 * Node does not look up DNS again for this socket.
 */
export function defaultHeaderRequest(urlString: string, signal: AbortSignal): Promise<HeaderResponse> {
  const url = new URL(urlString);
  const host = bareHostname(url.hostname);
  return resolvePublicHost(host).then((ips) => {
    const pin = ips[0];
    if (!pin) throw new SsrfError("no_addresses");
    const lib = url.protocol === "https:" ? https : http;
    return new Promise((resolve, reject) => {
      const req = lib.request(
        {
          host: pin,
          servername: host,
          family: pin.includes(":") ? 6 : 4,
          port: url.port || (url.protocol === "https:" ? 443 : 80),
          path: `${url.pathname || "/"}${url.search}`,
          method: "GET",
          headers: {
            host: url.host,
            "user-agent": "PHP-Security-Checker/1.0 headers-check",
            accept: "*/*",
            connection: "close",
          },
          timeout: 7000,
          signal,
        },
        (res) => {
          res.resume();
          const headers = new Headers();
          for (const [key, value] of Object.entries(res.headers)) {
            if (typeof value === "string") headers.set(key, value);
            else if (Array.isArray(value)) headers.set(key, value.join(", "));
          }
          resolve({ status: res.statusCode ?? 0, headers, url: urlString });
        },
      );
      req.on("error", (error) => reject(error));
      req.on("timeout", () => req.destroy(new Error("timeout")));
      req.end();
    });
  });
}
