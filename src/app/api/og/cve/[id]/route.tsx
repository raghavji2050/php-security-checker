import { ImageResponse } from "next/og";
import { cacheLife } from "next/cache";
import { toExplorerRow } from "@/lib/cve-explorer";
import { cveOgCard, type CveOgCard } from "@/lib/cve-og";
import { fixRows, normalizeCveId, pickRanges } from "@/lib/cve-page";
import { loadDataset } from "@/lib/dataset";
import { lookupKev } from "@/lib/kev";
import { log } from "@/lib/log";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const maxDuration = 300;

const SIZE = { width: 1200, height: 630 };

async function cardFor(id: string): Promise<CveOgCard | null> {
  "use cache";
  cacheLife("hours");
  const data = await loadDataset();
  const cve = data.cves.find((c) => c.id === id);
  if (!cve) return null;
  const row = toExplorerRow(cve, data.branches.map((b) => b.branch));
  const kev = await lookupKev([id]);
  const fixed = fixRows(pickRanges(cve).ranges).map((r) => r.fixed).filter((f): f is string => Boolean(f));
  return cveOgCard({ id, severity: row.severity, score: row.score, kev: Boolean(kev.entries[id]), fixed });
}

function render(card: CveOgCard | null, id: string, status: number, cache: string): ImageResponse {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#f4f0e6", color: "#1c1915", padding: "64px 72px", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", fontSize: 30, letterSpacing: 4, textTransform: "uppercase", color: "#0f6e56" }}>Am I affected?</div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 96, fontWeight: 700, letterSpacing: -2 }}>{id}</div>
          {card ? (
            <div style={{ display: "flex", gap: 20, marginTop: 28 }}>
              <div style={{ display: "flex", background: card.severityColor, color: "#fffdf8", fontSize: 38, padding: "10px 26px", borderRadius: 14 }}>{card.severityText}</div>
              {card.kev ? (
                <div style={{ display: "flex", border: "3px solid #9f1239", color: "#9f1239", fontSize: 34, padding: "10px 22px", borderRadius: 14 }}>Exploited in the wild (CISA KEV)</div>
              ) : null}
            </div>
          ) : null}
          <div style={{ display: "flex", marginTop: 30, fontSize: 40, color: "#5e584e" }}>
            {card ? card.fixedText : "Check your PHP version against official CVE data"}
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 28, color: "#5e584e", borderTop: "2px solid #ddd4c3", paddingTop: 24 }}>
          <span>PHP Security Checker</span>
          <span>Data: NVD · php.net · CISA KEV</span>
        </div>
      </div>
    ),
    { ...SIZE, status, headers: { "cache-control": cache } },
  );
}

/** GET /api/og/cve/CVE-2024-4577 — 1200×630 PNG share card for /cve/{id}. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const limit = rateLimit(`og-cve:${clientIp(request)}`, 60, 5 * 60 * 1000);
  const raw = (await params).id;
  const id = raw.length > 32 ? null : normalizeCveId(raw);
  if (!id) return new Response("Invalid CVE id", { status: 400, headers: { "content-type": "text/plain; charset=utf-8" } });
  if (!limit.ok) return render(null, id, 429, "no-store");
  try {
    const card = await cardFor(id);
    if (!card) return render(null, id, 404, "public, max-age=300");
    return render(card, id, 200, "public, max-age=3600, s-maxage=86400");
  } catch (error) {
    // Data source down: still return a neutral card so link previews never break.
    log.error("api.og_cve.failed", { id, error });
    return render(null, id, 200, "public, max-age=300");
  }
}
