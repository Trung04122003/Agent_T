import { expect, test } from "@playwright/test";
import { SITE } from "../playwright.config";

// ROADMAP 6.5 / SPEC section 8: the page, map included, makes no third-party request.
test("no request leaves the site: load, scroll to the map, switch language", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (r) => requests.push(r.url()));
  await page.goto("/vi/");
  await page.locator("[data-map]").scrollIntoViewIfNeeded();
  await page.waitForTimeout(2200); // let the map reveal and any lazy work run
  await page.locator("[data-lang-switch]:not([aria-current])").click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.locator("[data-map]").scrollIntoViewIfNeeded();
  await page.waitForLoadState("networkidle");

  expect(requests.length).toBeGreaterThan(3);
  const origin = new URL(SITE).origin;
  expect(requests.filter((u) => !u.startsWith("data:") && new URL(u).origin !== origin)).toEqual([]);
});
