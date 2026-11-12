import { expect, test } from "@playwright/test";

// The main checker flow. Live php.net/NVD answers can change or be slow, so the
// tests assert the flow (form, URL, headings, error handling), not CVE counts.

test("home page loads with the checker form", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Check a PHP version" })).toBeVisible();
  await expect(page.getByLabel("Installed PHP version")).toBeVisible();
  await expect(page.getByRole("button", { name: "Check Security" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeAttached();
});

test("a branch without a patch number shows a validation error", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Installed PHP version").fill("8.3");
  await page.getByRole("button", { name: "Check Security" }).click();
  await expect(page.locator("#version-error")).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
});

test("entering a full version runs the check", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Installed PHP version").fill("8.1.12");
  await page.getByRole("button", { name: "Check Security" }).click();
  await expect(page).toHaveURL(/\?v=8\.1\.12$/);
  // Either a result for this version or the friendly "Unable to verify" panel
  // when an upstream source is down; never a blank page or a crash.
  await expect(
    page.getByText("Security status", { exact: true }).or(page.getByText("Unable to verify right now.")),
  ).toBeVisible({ timeout: 25_000 });
  await expect(page.getByText("Application error")).toHaveCount(0);
});

test("/check/{version} renders the version report page", async ({ page }) => {
  const response = await page.goto("/check/8.1.12");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1, name: "PHP 8.1.12 security check" })).toBeVisible();
});

test("an invalid /check value shows the not-found page", async ({ page }) => {
  await page.goto("/check/not-a-version");
  await expect(page.getByText("Page not found").first()).toBeVisible();
});

test("an unknown route returns 404 with the not-found page", async ({ page }) => {
  const response = await page.goto("/this-page-does-not-exist");
  expect(response?.status()).toBe(404);
  await expect(page.getByText("Page not found").first()).toBeVisible();
});

test("/php-versions shows the branch risk scorecard", async ({ page }) => {
  const response = await page.goto("/php-versions");
  expect(response?.status()).toBe(200);
  // When php.net data is unreachable the page shows an alert instead; either way, no crash.
  await expect(
    page
      .getByRole("heading", { level: 2, name: "Branch risk scorecard" })
      .or(page.getByText("Official PHP branch data could not be loaded right now."))
      .first(),
  ).toBeVisible({ timeout: 25_000 });
  await expect(page.getByText("Application error")).toHaveCount(0);
});

test("/cve/{id} flags a CVE that CISA lists as exploited in the wild", async ({ page }) => {
  const response = await page.goto("/cve/CVE-2019-11043");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1, name: "CVE-2019-11043" })).toBeVisible({ timeout: 25_000 });
  await expect(page.getByTestId("kev-callout")).toContainText("Known Exploited Vulnerabilities catalog", { timeout: 25_000 });
});

test("/cve/{id} shows the EPSS exploit probability and related CVEs", async ({ page }) => {
  const response = await page.goto("/cve/CVE-2019-11043");
  expect(response?.status()).toBe(200);
  // Either a real FIRST score or an honest "Unavailable"/"no score" line, never a made-up number.
  await expect(page.getByTestId("epss")).toContainText("FIRST EPSS", { timeout: 25_000 });
  await expect(page.getByRole("heading", { level: 2, name: "Related CVEs" })).toBeVisible();
  await expect(page.getByTestId("related-cves").getByRole("link").first()).toHaveAttribute("href", /^\/cve\/CVE-\d{4}-\d+$/);
});

test("/composer/php-constraint shows which PHP branches a constraint allows", async ({ page }) => {
  await page.goto("/composer/php-constraint");
  await page.getByLabel("PHP constraint").fill("^7.4 || ^8.0");
  await page.getByRole("button", { name: "Check constraint" }).click();
  await expect(page).toHaveURL(/\/composer\/php-constraint\?c=/);
  await expect(
    page.getByTestId("constraint-result").or(page.getByText("Official PHP branch data could not be loaded right now.")).first(),
  ).toBeVisible({ timeout: 25_000 });
  if (await page.getByTestId("constraint-result").count()) {
    await expect(page.getByText("Allows end-of-life PHP:")).toBeVisible();
  }
});

test("version report has a Copy as Markdown button", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/check/8.1.12");
  const button = page.getByTestId("copy-markdown");
  // The report needs live NVD/php.net data; when it is unavailable the page shows an alert instead.
  await expect(button.or(page.locator("main [role=alert]")).first()).toBeVisible({ timeout: 25_000 });
  if (await button.count()) {
    await button.click();
    await expect(button).toContainText("Copied");
    const md = await page.evaluate(() => navigator.clipboard.readText());
    expect(md).toContain("## PHP 8.1.12 security check");
  }
});

test("/symfony/check/{version} offers Markdown and a README badge", async ({ page }) => {
  const response = await page.goto("/symfony/check/7.4.0");
  expect(response?.status()).toBe(200);
  const share = page.getByTestId("symfony-share");
  await expect(share.or(page.locator("main [role=alert]")).first()).toBeVisible({ timeout: 25_000 });
  if (await share.count()) {
    await expect(share.getByRole("button", { name: "Copy badge Markdown" })).toBeVisible();
    await expect(share.getByRole("img")).toHaveAttribute("src", "/api/symfony/badge?v=7.4.0");
  }
});

test("featured PHP2Shell CVE page shows the php.net advisory notes", async ({ page }) => {
  const response = await page.goto("/cve/CVE-2026-109618");
  expect(response?.status()).toBe(200);
  const advisory = page.getByTestId("php-net-advisory");
  await expect(advisory).toContainText("RCE via OOM corruption", { timeout: 25_000 });
  await expect(advisory.getByRole("link", { name: "GHSA-w8hw-w9fx-j79w" })).toHaveAttribute("href", "https://github.com/php/php-src/security/advisories/GHSA-w8hw-w9fx-j79w");
  await page.goto("/cves");
  await expect(page.getByTestId("featured-cves").getByRole("link", { name: "CVE-2026-109619" })).toBeVisible();
});
