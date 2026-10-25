# Improvement log

One small improvement per day. Each entry lists the area so topics rotate and nothing repeats.

| Date | Area | Change | PR |
| --- | --- | --- | --- |
| 2026-10-25 | Tests | Unit tests for the NVD record parser (`src/lib/nvd-parse.ts`): rejected/irrelevant records, CPE ranges, negated nodes, AND-config prerequisites, php.net CNA data, CVSS preference, reference ranking. Synthetic fixtures only. | improve/2026-10-25 |

## Ideas queue (not done yet)

- CI linting: GitHub Actions for lint, typecheck, test, build (the current push token lacks the `workflow` scope, so this needs Raghav to add the file or grant the scope).
- Error handling and timeouts, caching, UI/accessibility, SEO/meta, README, composer.lock/package.json advisory feature.

## 2026-10-25 — Fix CI lint (react-hooks/set-state-in-effect)
- Recent-history list in `checker.tsx` now reads localStorage via `useSyncExternalStore` (server snapshot = empty list, so no hydration mismatch; syncs across tabs via `storage` events) instead of `setState` inside `useEffect`.
- `npm ci`, lint, tests and build pass locally; GitHub Actions CI green on the PR.
