import type { Page } from "@playwright/test";

/**
 * Open a page on `astro dev` and wait until it stops navigating. The dev server sometimes
 * reloads a page once right after the first load (cause not identified, dev only).
 */
export async function gotoStable(page: Page, url: string): Promise<void> {
  await page.goto(url);
  for (;;) {
    const nav = await page.waitForEvent("framenavigated", { timeout: 1500 }).catch(() => null);
    if (!nav) return;
    await page.waitForLoadState("load");
  }
}
