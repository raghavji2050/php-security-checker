# Security Policy

## Supported versions

Only the current `master` branch, deployed at <https://php-security-checker.vercel.app>, receives fixes.

## Reporting a vulnerability

Please report security issues privately through [GitHub private vulnerability reporting](https://github.com/raghavji2050/php-security-checker/security/advisories/new) or by email to raghavji2050@gmail.com. Do not open a public issue for a security problem.

Include the affected URL or route, steps to reproduce, and the impact you observed. You can expect an acknowledgement within 3 working days and a status update within 7 days. Credit is given in the CHANGELOG unless you prefer to stay anonymous.

## Scope

In scope: this web app and its API routes (`/api/check`, `/api/php-versions`, `/api/vulnerabilities`, `/api/health`), response headers, rate limiting, and anything that could leak server secrets or make the app return wrong security results.

Out of scope: vulnerabilities in PHP itself (report those to the [PHP project](https://github.com/php/php-src/security)), in NVD or php.net data, denial of service by volume, and findings from automated scanners with no demonstrated impact.

Please test only against your own local copy or with light manual requests to production. Do not run load tests or automated scanners against the live site.

## How the app protects itself

- It never runs user-supplied PHP, shell commands, or exploit payloads. Version checks take a `MAJOR.MINOR.PATCH` string. The headers tool fetches only a URL the user submits, over HTTP or HTTPS on ports 80 and 443, and refuses loopback, private, link-local, and metadata targets, including after redirects. Response bodies are discarded. Pasted ini files, env lines, and Dockerfiles are parsed as text and are not executed.
- `NVD_API_KEY` and `GITHUB_TOKEN` are used server-side only, sent as headers, and never returned to the browser or written to logs (log fields with secret-looking names are redacted).
- Responses carry a strict Content-Security-Policy (`frame-ancestors 'none'`), HSTS, nosniff, Referrer-Policy, Permissions-Policy and Cross-Origin-Opener-Policy.
- API routes are rate limited per client IP with a bounded in-memory limiter, and error responses never include stack traces or internal details.
- No user accounts, cookies for tracking, or stored user data. The site uses privacy-friendly Vercel Web Analytics (no cookies). Recent searches stay in the browser's localStorage.
