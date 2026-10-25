import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

// ROADMAP 2.3: registration marks at the frame corners, monospace label, build-date stamp.
const ui = JSON.parse(readFileSync("content/ui.json", "utf8"));

test("portrait frame has four corner marks and a monospace label", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/vi/");
  const frame = (await page.locator("[data-portrait]").boundingBox())!;
  const corners = {
    tl: [frame.x, frame.y],
    tr: [frame.x + frame.width, frame.y],
    bl: [frame.x, frame.y + frame.height],
    br: [frame.x + frame.width, frame.y + frame.height],
  };
  for (const [name, [x, y]] of Object.entries(corners)) {
    const mark = (await page.locator(`.mark--${name}`).boundingBox())!;
    // Each mark is centred on its corner.
    expect(Math.abs(mark.x + mark.width / 2 - x!), name).toBeLessThanOrEqual(1);
    expect(Math.abs(mark.y + mark.height / 2 - y!), name).toBeLessThanOrEqual(1);
  }
  const label = page.locator(".portrait__label");
  await expect(label).toHaveText(ui.portraitLabel.vi);
  expect(await label.evaluate((el) => getComputedStyle(el).fontFamily)).toContain("IBM Plex Mono");
});

test("footer shows the build month/year stamp", async ({ page }) => {
  await page.goto("/vi/");
  const stamp = page.locator(".footer__updated");
  await expect(stamp).toContainText(`${ui.updatedLabel.vi}:`);
  await expect(stamp.locator("time")).toHaveText(/^\d{2}\/\d{4}$/);
  await expect(stamp.locator("time")).toHaveAttribute("datetime", /^\d{4}-\d{2}$/);
});

for (const width of [360, 1280]) {
  for (const mode of ["mat", "giai-mat"]) {
    test(`screenshot Gate ${width}px ${mode}`, async ({ page }) => {
      await page.setViewportSize({ width, height: width === 360 ? 740 : 800 });
      await page.addInitScript((m) => localStorage.setItem("mode", m), mode);
      await page.goto("/vi/");
      await page.evaluate(() => document.fonts.ready);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
      await page.screenshot({ path: `test-results/screenshots/gate-${width}-${mode}.png`, fullPage: true });
      await page.screenshot({ path: `test-results/screenshots/gate-${width}-${mode}-viewport.png` });
    });
  }
}
