import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

// ROADMAP 6.2: real map with Hoang Sa and Truong Sa labelled, in vi and en (screenshots).
const ui = JSON.parse(readFileSync("content/ui.json", "utf8"));

for (const locale of ["vi", "en"] as const) {
  test(`map shows both archipelago labels in ${locale} (screenshot)`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" }); // fully drawn, no waiting
    await page.setViewportSize({ width: 1280, height: 1000 });
    await page.goto(`/${locale}/`);
    const map = page.locator("[data-map]");
    await map.scrollIntoViewIfNeeded();
    await page.evaluate(() => document.fonts.ready);
    for (const [key, id] of [["hoangSaLabel", "hoang-sa"], ["truongSaLabel", "truong-sa"]] as const) {
      const label = map.locator(`[data-archipelago="${id}"]`);
      await expect(label).toHaveText(ui[key][locale]);
      await expect(label).toBeVisible();
      const box = (await label.boundingBox())!;
      const svg = (await map.locator("svg").boundingBox())!;
      expect(box.x + box.width).toBeLessThanOrEqual(svg.x + svg.width + 1); // not clipped
    }
    await expect(map.locator(".map__islands circle")).not.toHaveCount(0);
    await expect(map.locator("[data-place]")).toHaveCount(4);
    await map.screenshot({ path: `test-results/screenshots/map-${locale}.png` });
  });
}

test("credits Natural Earth (owner approved), as a plain link", async ({ page }) => {
  await page.goto("/vi/");
  const credit = page.locator(".map__credit a");
  await expect(credit).toHaveText("Made with Natural Earth");
  await expect(credit).toHaveAttribute("href", "https://www.naturalearthdata.com/");
});
