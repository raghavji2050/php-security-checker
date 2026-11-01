# Improvement log

One small improvement per day. Each entry lists the area so topics rotate and nothing repeats.

| Date | Area | Change | PR |
| --- | --- | --- | --- |
| 2026-10-25 | Tests | Unit tests for the NVD record parser (`src/lib/nvd-parse.ts`): rejected/irrelevant records, CPE ranges, negated nodes, AND-config prerequisites, php.net CNA data, CVSS preference, reference ranking. Synthetic fixtures only. | improve/2026-10-25 |
| 2026-10-25 | CI | GitHub Actions workflow (`.github/workflows/ci.yml`): npm ci, lint, test, build on every PR and push to master. | #3 |
| 2026-10-25 | UX / SEO | Raghav's 7 improvements: short shared footer note (full disclaimer on About), `/vulnerabilities` CVE list with search + severity filter, `/how-it-works` explainer with server-rendered source/outage FAQ, homepage H1 + tagline, input hint and friendly format error, shareable `/?v=` links with Copy link + Download JSON, loading/error/Retry states and "Data last updated", per-page titles/descriptions, sitemap + robots, mobile overflow fix. | improve/2026-10-25-ux |
| 2026-10-26 | Accessibility / SEO | Priority (a): `/how-it-works` Matching, RCE and Status colors sections are now plain server-rendered sections with headings and an in-page anchor nav (readable without JavaScript, all text in the HTML). Removed the unused accordion component and `@radix-ui/react-accordion`. | improve/2026-10-26 |
| 2026-10-27 | SEO | Priority (b): server-rendered result pages at `/check/[version]` (e.g. `/check/8.1.12`) with the full report in the HTML, a unique title, meta description and canonical URL per version, cached for hours via `use cache`. Sitemap now lists `/check/` pages for the latest patch of every PHP branch (php.net data, refreshed daily). Invalid versions get a not-found page with noindex. | improve/2026-10-27 |

## Production plan (7 days, started 2026-10-28)

| Day | Date | Change | PR |
| --- | --- | --- | --- |
| 1 | 2026-10-28 | Public JSON API `GET /api/check?v=X.Y.Z` (legacy `?version=` still works): strict MAJOR.MINOR.PATCH validation, JSON errors with `code` (`missing_version`, `invalid_version`, `rate_limited`, `data_unavailable`, `internal_error`) and matching status codes (400/429/503/500), CORS for GET plus OPTIONS preflight. OpenAPI 3.1 spec at `/openapi.json`. Route + spec tests in `src/lib/api.test.ts`. | improve/2026-10-28 |
| 2 | 2026-10-29 | `/llms.txt` (site summary, `/check/{version}`, `/api/check`, `/openapi.json`, quick answers). "Quick answers" section on `/how-it-works` with matching FAQPage JSON-LD (shared text in `src/lib/faq.ts`). Upstream calls now have a total time budget (`deadlineMs`, default 45s; NVD 90s, ChangeLog 75s): no new attempt or Retry-After wait starts past it, so a slow php.net/NVD falls back to the cached copy instead of hanging the page. Tests in `src/lib/http.test.ts` and `src/lib/llms.test.ts`. | improve/2026-10-29 |
| 3 | 2026-10-30 | Security hardening. Added HSTS (2 years, includeSubDomains), Cross-Origin-Opener-Policy and X-Permitted-Cross-Domain-Policies next to the existing CSP (`frame-ancestors 'none'`), nosniff, Referrer-Policy and Permissions-Policy. The in-memory sliding-window rate limiter is capped at 5000 tracked addresses with pruning, so a flood can't grow memory, and it prefers Vercel's `x-vercel-forwarded-for` client IP. `/api/check` now returns `X-RateLimit-Limit`/`-Remaining` (exposed via CORS) and 429 + Retry-After. `/check/%E0`-style malformed URLs now return not-found instead of a 500. Tests in `src/lib/rate-limit.test.ts` and `src/lib/security-headers.test.ts`. | improve/2026-10-30 |
| 4 | 2026-10-31 | Testing. New `src/lib/check.test.ts` runs the real `checkVersion` (dataset loading, cache, version matching, CVE evaluation) against fake upstream loaders: vulnerable vs fixed version, NVD down with no cache (DataUnavailableError), optional sources failing (warnings), and falling back to the cached NVD copy. `api.test.ts` adds the generic 500 path (no internal details leaked) and rate-limit headers. New `scripts/smoke.mjs` (`npm run smoke`) starts the production build and checks key pages, `/llms.txt`, `/openapi.json`, sitemap, API 400s and the 404 page; CI now runs it after build. | improve/2026-10-31 |

| 5 | 2026-11-01 | Performance and caching. New shared cache tier (`src/lib/shared-cache.ts`) on Vercel Runtime Cache: upstream datasets (NVD, php.net branches, ChangeLog, GitHub advisories) are gzipped (NVD 4.7 MB JSON to ~250 KB) and shared across serverless instances, so a cold instance reuses data another instance fetched instead of refetching NVD (the 18-27s cold load). Stale shared data is still a fallback when an upstream fails; cache errors never break a check; off outside Vercel. New `GET /api/health` (no-store, CORS) reports app uptime, shared-cache status and per-source retrievedAt/age/fresh from cache only (never calls upstream); `ok` when NVD is fresh, else `degraded`. Added to OpenAPI, llms.txt and the smoke test. Tests in `src/lib/shared-cache.test.ts`. | improve/2026-11-01 |
Next: Day 6 (404/error pages, structured logging without secrets, loading states, accessibility fixes).

## Ideas queue (not done yet)

- ~~CI linting: GitHub Actions for lint, typecheck, test, build~~ Done 2026-10-25 (Raghav added `ci.yml`).
- Error handling and timeouts, caching, UI/accessibility, OG images, README, composer.lock/package.json advisory feature.

## 2026-10-25 — Fix CI lint (react-hooks/set-state-in-effect)
- Recent-history list in `checker.tsx` now reads localStorage via `useSyncExternalStore` (server snapshot = empty list, so no hydration mismatch; syncs across tabs via `storage` events) instead of `setState` inside `useEffect`.
- `npm ci`, lint, tests and build pass locally; GitHub Actions CI green on the PR.
