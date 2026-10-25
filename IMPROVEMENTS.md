# Improvement log

One small improvement per day. Each entry lists the area so topics rotate and nothing repeats.

| Date | Area | Change | PR |
| --- | --- | --- | --- |
| 2026-10-25 | Tests | Unit tests for the NVD record parser (`src/lib/nvd-parse.ts`): rejected/irrelevant records, CPE ranges, negated nodes, AND-config prerequisites, php.net CNA data, CVSS preference, reference ranking. Synthetic fixtures only. | improve/2026-10-25 |

## Ideas queue (not done yet)

- CI linting: GitHub Actions for lint, typecheck, test, build (the current push token lacks the `workflow` scope, so this needs Raghav to add the file or grant the scope).
- Error handling and timeouts, caching, UI/accessibility, SEO/meta, README, composer.lock/package.json advisory feature.
