import { CORS_HEADERS, corsPreflight } from "@/lib/api";
import { buildOpenApiSpec } from "@/lib/openapi";

export function GET() {
  return Response.json(buildOpenApiSpec(), {
    headers: { ...CORS_HEADERS, "cache-control": "public, max-age=3600" },
  });
}

export function OPTIONS() {
  return corsPreflight();
}
