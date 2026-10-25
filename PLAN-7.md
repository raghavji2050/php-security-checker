# Plan: 7 UX improvements (2026-10-25)

1. Disclaimer: `src/components/site-footer.tsx` (short note + About link, used by `src/app/layout.tsx` on every page), `src/app/about/page.tsx` (full disclaimer card), `src/components/results-dashboard.tsx` (drop repeated disclaimer paragraph).
2. Vulnerabilities: new `src/app/how-it-works/page.tsx` (explainer moved), rewritten `src/app/vulnerabilities/page.tsx`, new `src/components/cve-catalog.tsx` (table, search, severity filter), new `src/lib/catalog.ts` + `src/lib/catalog.test.ts` (build rows from the existing NVD/GitHub dataset, no invented data), new `src/app/api/vulnerabilities/route.ts`, `src/components/site-header.tsx` (How it works link).
3. Empty headings: they were a Radix accordion (content hidden until JS/click). Replaced with server-rendered `<details open>` sections in `src/app/how-it-works/page.tsx`, with fuller copy on trusted sources/conflicts and outages.
4. Homepage intro: `src/components/checker.tsx` (H1 + tagline).
5. Input help: `src/components/checker.tsx` (placeholder, `php -v` hint, friendly error).
6. Shareable result: `src/components/checker.tsx` (`/?v=`; legacy `?version=` still read), `src/components/results-dashboard.tsx` (Copy link, Download JSON).
7. Loading/error/freshness: `src/components/checker.tsx` (skeleton + spinner, error card with Retry), `src/components/results-dashboard.tsx` ("Data last updated" line), new `src/lib/format.ts`.
Final: per-page metadata in `src/app/page.tsx`, `how-it-works`, `vulnerabilities`, `versions`, `about`; `src/app/layout.tsx` (metadataBase); new `src/app/sitemap.ts`, `src/app/robots.ts`; `IMPROVEMENTS.md`.
