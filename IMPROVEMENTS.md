# Improvement log

One small improvement per day. Each entry lists the area so topics rotate and nothing repeats.

| Date | Area | Change | PR |
| --- | --- | --- | --- |
| 2026-10-25 | Tests | Unit tests for the NVD record parser (`src/lib/nvd-parse.ts`): rejected/irrelevant records, CPE ranges, negated nodes, AND-config prerequisites, php.net CNA data, CVSS preference, reference ranking. Synthetic fixtures only. | improve/2026-10-25 |
| 2026-10-25 | CI | GitHub Actions workflow (`.github/workflows/ci.yml`): npm ci, lint, test, build on every PR and push to master. | #3 |
| 2026-10-25 | UX / SEO | Raghav's 7 improvements: short shared footer note (full disclaimer on About), `/vulnerabilities` CVE list with search + severity filter, `/how-it-works` explainer with server-rendered source/outage FAQ, homepage H1 + tagline, input hint and friendly format error, shareable `/?v=` links with Copy link + Download JSON, loading/error/Retry states and "Data last updated", per-page titles/descriptions, sitemap + robots, mobile overflow fix. | improve/2026-10-25-ux |

## Ideas queue (not done yet)

- ~~CI linting: GitHub Actions for lint, typecheck, test, build~~ Done 2026-10-25 (Raghav added `ci.yml`).
- Error handling and timeouts, caching, UI/accessibility, OG images, README, composer.lock/package.json advisory feature.

## 2026-10-25 — Fix CI lint (react-hooks/set-state-in-effect)
- Recent-history list in `checker.tsx` now reads localStorage via `useSyncExternalStore` (server snapshot = empty list, so no hydration mismatch; syncs across tabs via `storage` events) instead of `setState` inside `useEffect`.
- `npm ci`, lint, tests and build pass locally; GitHub Actions CI green on the PR.
