# Changelog

All notable changes to this project. Dates are in IST. Pull request numbers refer to this repository.

## 2026-11-03
- Docs: README now covers architecture, data sources, every API route and error code, and how to run and test; added SECURITY.md and this CHANGELOG.

## 2026-11-02 (#14)
- Branded 404 page, `error.tsx` with Try again, and `global-error.tsx`.
- Structured JSON server logging with secret redaction.
- Skip-to-content link, screen-reader-friendly loading skeleton on `/check/[version]`.

## 2026-11-01 (#12, #13)
- Shared gzipped Vercel Runtime Cache tier for upstream data, cutting cold `/check` loads.
- New `GET /api/health` reporting app and data freshness.

## 2026-10-31 (#11)
- End-to-end `checkVersion` tests with fake upstreams, API error and rate-limit tests.
- `npm run smoke` production smoke test, run in CI. Added MIT license.

## 2026-10-30 (#10)
- HSTS, COOP and X-Permitted-Cross-Domain-Policies headers; bounded rate limiter with `X-RateLimit-*` headers; malformed `/check` URLs return 404 instead of 500.

## 2026-10-29 (#9)
- `/llms.txt`, Quick answers with FAQPage JSON-LD, total time budget for upstream calls.

## 2026-10-28 (#8)
- Public JSON API `GET /api/check?v=` with CORS and JSON error codes; OpenAPI 3.1 spec at `/openapi.json`.

## 2026-10-27 (#6, #7)
- Server-rendered, shareable `/check/[version]` pages in the sitemap; mobile nav and upgrade-card fixes.

## 2026-10-25 to 2026-10-26 (#2 to #5)
- CVE list, How it works page, shareable results, NVD parser tests, CI workflow, lint fixes.

## 2026-10-23 (#1)
- First release of the PHP Security Checker web app.
