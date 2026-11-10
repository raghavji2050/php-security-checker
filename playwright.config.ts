import { defineConfig, devices } from "@playwright/test";

// Browser tests for the main checker flow. They run against a production build
// (`npm run build` first) started by Playwright on its own port.
const port = Number(process.env.E2E_PORT || 3124);
const external = process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["list"], ["github"]] : "list",
  use: {
    baseURL: external || `http://127.0.0.1:${port}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: external
    ? undefined
    : {
        command: `npx next start -p ${port}`,
        url: `http://127.0.0.1:${port}/robots.txt`,
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
      },
});
