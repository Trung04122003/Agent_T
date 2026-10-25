import { defineConfig, devices } from "@playwright/test";

// Run via `pnpm e2e` (scripts/playwright.mjs sets the browser path on drive F).
// Site pages are tested on the real build (astro preview); dev-only pages on `astro dev`.
// --ignore-lock: Astro allows one tracked preview server per project; tests run two, untracked.
export const SITE = "http://localhost:4321";
export const DEV = "http://localhost:4322";
/** Build of the test dataset e2e/fixtures/claims.json (outputs to test-results/, never dist/). */
export const FIXTURE = "http://localhost:4323";

export default defineConfig({
  testDir: "e2e",
  testMatch: "**/*.e2e.ts",
  outputDir: "test-results/e2e",
  reporter: "list",
  use: { baseURL: SITE, ...devices["Desktop Chrome"] },
  webServer: [
    { command: "pnpm build && pnpm preview --port 4321 --ignore-lock", url: SITE, reuseExistingServer: false, timeout: 180_000 },
    { command: "pnpm dev --port 4322", url: `${DEV}/dev/fonts`, reuseExistingServer: false, timeout: 180_000 },
    {
      command: "pnpm build && pnpm preview --port 4323 --ignore-lock",
      url: FIXTURE,
      env: { CUPID_CLAIMS: "e2e/fixtures/claims.json" },
      reuseExistingServer: false,
      timeout: 180_000,
    },
  ],
});
