import { expect, test } from "@playwright/test";
import { DEV } from "../playwright.config";
import { gotoStable } from "./helpers";

// ROADMAP 1.2: the specimen renders the SPEC section 7 string with self-hosted fonts only.
test("font specimen loads self-hosted Vietnamese subsets", async ({ page }) => {
  const fontRequests: string[] = [];
  page.on("request", (r) => {
    if (r.resourceType() === "font") fontRequests.push(r.url());
  });

  await gotoStable(page, `${DEV}/dev/fonts`);
  await page.evaluate(() => document.fonts.ready);

  const loaded = await page.evaluate(() =>
    [...document.fonts].filter((f) => f.status === "loaded").map((f) => `${f.family} ${f.weight}`),
  );
  for (const face of ["Be Vietnam Pro 400", "Be Vietnam Pro 700", "IBM Plex Mono 400", "IBM Plex Mono 500"]) {
    expect(loaded.some((l) => l.replace(/"/g, "") === face), face).toBe(true);
  }

  expect(fontRequests.length).toBeGreaterThan(0);
  for (const url of fontRequests) expect(new URL(url).origin).toBe(DEV);
  expect(fontRequests.some((u) => u.includes("vietnamese"))).toBe(true);

  await page.screenshot({ path: "test-results/screenshots/fonts-mat.png", fullPage: true });
  await page.evaluate(() => (document.documentElement.dataset["mode"] = "giai-mat"));
  await page.screenshot({ path: "test-results/screenshots/fonts-giai-mat.png", fullPage: true });
});
