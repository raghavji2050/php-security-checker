import { connection } from "next/server";
import { healthReport } from "@/lib/health";

/** GET /api/health: app status and data freshness. Always 200 while the app is serving. */
export async function GET() {
  await connection();
  const report = await healthReport();
  return Response.json(report, {
    headers: { "cache-control": "no-store", "access-control-allow-origin": "*" },
  });
}
