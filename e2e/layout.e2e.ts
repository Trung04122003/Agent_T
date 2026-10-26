import { expect, test, type Page } from "@playwright/test";
import { DEV } from "../playwright.config";
import { gotoStable } from "./helpers";

// ROADMAP 1.3: base layout from 360 to 1440 px, no horizontal scrolling.
const WIDTHS = [360, 768, 1280, 1440];

async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

for (const width of WIDTHS) {
  test(`no horizontal scroll at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });

    await page.goto("/vi/");
    expect(await horizontalOverflow(page)).toBe(0);
    await expect(page.locator("header.controls")).toBeVisible();
    await expect(page.locator("main#main")).toHaveCount(1);
    await expect(page.locator("footer")).toHaveCount(1);
    if (width === 360 || width === 1280) {
      await page.screenshot({ path: `test-results/screenshots/layout-${width}.png`, fullPage: true });
    }

    // Long unbroken Vietnamese text (font specimen) must wrap, not overflow.
    await gotoStable(page, `${DEV}/dev/fonts`);
    expect(await horizontalOverflow(page)).toBe(0);
  });
}

test("phone: control bar sits at the bottom, 56px tall, with a 44px target", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto("/vi/");
  const bar = (await page.locator("header.controls").boundingBox())!;
  expect(bar.height).toBe(56);
  expect(bar.y + bar.height).toBe(740);
  const button = (await page.locator("[data-mode-toggle]").boundingBox())!;
  expect(button.height).toBeGreaterThanOrEqual(44);
  expect(button.width).toBeGreaterThanOrEqual(44);
});

test("desktop: control bar at the top, mode switch at the end", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/vi/");
  // Right under the classification strip (ROADMAP 13.1), which opens the page.
  const strip = (await page.locator('[data-banner="top"]').boundingBox())!;
  expect(strip.y).toBe(0);
  const bar = (await page.locator("header.controls").boundingBox())!;
  expect(Math.abs(bar.y - (strip.y + strip.height))).toBeLessThanOrEqual(1);
  const button = (await page.locator("[data-mode-toggle]").boundingBox())!;
  expect(button.x + button.width).toBeGreaterThan(1280 - 40);
});
