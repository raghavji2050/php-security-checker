import { beforeEach, describe, expect, it } from "vitest";
import { POST as postHeaders } from "@/app/api/headers/route";
import { GET as getLaravel } from "@/app/api/laravel/route";
import { GET as getDocker } from "@/app/api/docker-tag/route";
import { GET as getWordPress } from "@/app/api/wordpress/route";
import { GET as getBadge } from "@/app/api/badge/route";
import { resetRateLimits } from "@/lib/rate-limit";

describe("toolkit API validation", () => {
  beforeEach(() => resetRateLimits());

  it("rejects a loopback header target before any fetch", async () => {
    const response = await postHeaders(new Request("https://example.test/api/headers", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.10" },
      body: JSON.stringify({ url: "http://127.0.0.1/latest" }),
    }));
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe("blocked_target");
  });

  it("rejects incomplete Laravel, WordPress, Docker, and badge inputs", async () => {
    expect((await getLaravel(new Request("https://example.test/api/laravel"))).status).toBe(400);
    expect((await getLaravel(new Request("https://example.test/api/laravel?v=11"))).status).toBe(400);
    expect((await getWordPress(new Request("https://example.test/api/wordpress?v=latest"))).status).toBe(400);
    expect((await getDocker(new Request("https://example.test/api/docker-tag"))).status).toBe(400);
    const badge = await getBadge(new Request("https://example.test/api/badge?v=nope"));
    expect(badge.status).toBe(400);
    expect(badge.headers.get("content-type")).toContain("image/svg+xml");
    expect(await badge.text()).toContain("invalid version");
  });
});
