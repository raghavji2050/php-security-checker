/** Shared helpers for the public JSON API (CORS, JSON errors). */

export const CORS_HEADERS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-allow-headers": "content-type",
  "access-control-max-age": "86400",
  "access-control-expose-headers": "retry-after, x-ratelimit-limit, x-ratelimit-remaining",
};

export type ApiErrorCode =
  | "missing_version"
  | "invalid_version"
  | "rate_limited"
  | "data_unavailable"
  | "internal_error";

export function apiJson(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return Response.json(body, {
    status,
    headers: { ...CORS_HEADERS, "cache-control": "no-store", ...extra },
  });
}

export function apiError(
  code: ApiErrorCode,
  message: string,
  status: number,
  extra: Record<string, string> = {},
  fields: Record<string, unknown> = {},
): Response {
  return apiJson({ error: message, code, status, ...fields }, status, extra);
}

export function corsPreflight(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
