# PHP Security Checker

Check an installed PHP release (`MAJOR.MINOR.PATCH`) against known vulnerabilities in the PHP runtime, then see the official support window and a real upgrade path.

The app reads NIST NVD, php.net, and GitHub. It does not ship a database of CVEs, CVSS scores, or fixed versions. A green result means nothing in the data that was checked confirmed a match. It does not mean the installation is secure.

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000 and enter a version such as `8.1.12`.

```bash
npm test
npm run lint
npm run build
```

## NVD API key

Request a free key at <https://nvd.nist.gov/developers/request-an-api-key> and set `NVD_API_KEY` in `.env.local`.

Without a key, NVD allows about 5 requests every 30 seconds. The first check pages through the PHP runtime CVE set and can take several minutes. Later checks use the server cache and return quickly. `GITHUB_TOKEN` is optional and only raises the GitHub rate limit for php/php-src advisories.

| Variable | Purpose |
| --- | --- |
| `NVD_API_KEY` | NVD API 2.0 key. Sent as a header, never returned to the browser. |
| `GITHUB_TOKEN` | Optional token for GitHub Security Advisories. |
| `NVD_CACHE_TTL_SECONDS` | How long a successful NVD sync is treated as fresh. Default 6 hours. |
| `PHP_CACHE_TTL_SECONDS` | How long php.net release and changelog data stays fresh. Default 12 hours. |
| `CACHE_DIR` | Optional cache directory. Defaults to the system temp directory. |

If a refresh fails and a previous sync exists, the API serves that copy and marks it stale, with the timestamp of the last success. It does not present stale data as current. If NVD has never succeeded, the check returns **unable to verify**.

## API

`GET /api/check?version=8.1.12`

Returns `version`, `supportStatus`, `securityStatus`, `vulnerabilities`, `rceVulnerabilities`, `minimumFixedVersion`, `recommendedVersion`, `checkedAt`, `sources`, and `warnings`.

`GET /api/php-versions`

Returns branch, initial release date, active support end, security support end, end-of-life status, and the latest patch from php.net.

Versions must be `MAJOR.MINOR.PATCH`. `8.1` is rejected. Both routes are rate limited per IP. No login and no server credentials.

## How a match is decided

1. The version is parsed as three numbers. String sorting is not used.
2. NVD CVE 2.0 is queried with `cpe:2.3:a:php:php` and paginated.
3. Records are kept only when they describe the PHP runtime, not another product written in PHP.
4. Affected ranges keep inclusive and exclusive bounds from NVD CPE data and from php.net's affected entries (`versionStartIncluding` / `versionEndExcluding`, `lessThan`, and the same fields on GitHub advisories).
5. A precise range that contains the version is **Confirmed vulnerable** when php.net, NVD, GitHub, and the ChangeLog do not disagree.
6. A one-sided range, or sources that disagree, is **Potentially affected — verification required**.
7. No structured match is not reported as a vulnerability. A wildcard CPE with no bounds is ignored.
8. The fixed release is the bound named by those sources, and it has to exist in the php.net release list. Otherwise the fix is **Not verified**.

Remote code execution and shell risk are classified from CWE-78, CWE-77, CWE-88, and CWE-94, plus the published description. The classification basis is shown on each row. The version cannot prove the bug is reachable: SAPI, operating system, web server, and extensions still matter. The app never runs exploits or shell commands.

Red means at least one confirmed match. Yellow means the branch is unsupported, the data is stale or incomplete, or a match still needs verification. Green means no confirmed or unresolved match and the branch is still on php.net's supported list.

The long-term recommendation is the latest patch on the newest branch php.net still supports. A newer patch on an end-of-life branch can be named as the minimum fix on that branch, and it is not recommended as the place to stay.

## Deploy

### Vercel

Import the repository, set `NVD_API_KEY`, and deploy. The first check calls NVD, so the function timeout needs to allow that download. On a short timeout, retry after the cache has been filled, or run one check from a longer-lived environment first.

### Railway

Railway can build the `Dockerfile` or run `npm install`, `npm run build`, and `npm start`. `npm start` listens on `PORT`. Set `NVD_API_KEY` in the service variables. The cache lives on the local disk of the instance and is empty after a new deploy.

## Data limits

- NVD sometimes publishes an open-ended CPE such as "before 8.2.35" for a bug php.net limits to specific branches. Those rows do not override a precise php.net range.
- Some older records only exist as prose. Unparsed prose is skipped instead of being treated as every version.
- GitHub advisories that only say `<8.4.27` are not applied to older branches unless the advisory lists a cap per branch.
- ChangeLog cross-checks use CVE and GHSA identifiers in the PHP 5, 7, and 8 changelogs. A mention is not, by itself, enough to confirm a vulnerability.
- Support dates for current branches come from the php.net pages. Dates the end-of-life page does not publish are filled with the schedule in php.net's `branches.inc`.
