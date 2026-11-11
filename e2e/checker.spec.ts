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
