import { checkVersion } from "@/lib/check";

export const maxDuration = 300;
import { DataUnavailableError } from "@/lib/dataset";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { parsePhpVersion } from "@/lib/version";

export async function GET(request: Request) {
  const limit = rateLimit(`check:${clientIp(request)}`, 20, 5 * 60 * 1000);
  if (!limit.ok) {
    return Response.json(
      { error: "Too many checks from this address. Try again shortly." },
      { status: 429, headers: { "retry-after": String(limit.retryAfterSeconds), "cache-control": "no-store" } },
    );
  }

  const raw = new URL(request.url).searchParams.get("version") ?? "";
  if (raw.length > 32) {
    return Response.json(
      { error: "Invalid version. Use MAJOR.MINOR.PATCH, for example 8.1.12." },
      { status: 400, headers: { "cache-control": "no-store" } },
    );
  }
  const version = parsePhpVersion(raw);
  if (!version) {
    return Response.json(
      { error: "Invalid version. Use MAJOR.MINOR.PATCH, for example 8.1.12. A branch such as 8.1 is not a release." },
      { status: 400, headers: { "cache-control": "no-store" } },
    );
  }

  try {
    const result = await checkVersion(version.raw);
    return Response.json(result, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof DataUnavailableError) {
      return Response.json(
        {
          error: error.message,
          securityStatus: "unable_to_verify",
          version: version.raw,
        },
        { status: 503, headers: { "cache-control": "no-store" } },
      );
    }
    console.error("version check failed");
    return Response.json(
      { error: "The check could not be completed." },
      { status: 500, headers: { "cache-control": "no-store" } },
    );
  }
}
