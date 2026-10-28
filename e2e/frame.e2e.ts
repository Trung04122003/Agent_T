import { readFileSync } from "node:fs";
import { expect, test } from "./test";

// ROADMAP 2.3 / 12.4: corner brackets on the frame, monospace label, build-date stamp.
const ui = JSON.parse(readFileSync("content/ui.json", "utf8"));

test("portrait frame has accent corner brackets just outside it, and a monospace label", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/vi/");
  const portrait = page.locator("[data-portrait]");
  await expect(portrait).toHaveClass(/brackets/);
  // Drawn by ::before: 8 gradient strokes (2 per corner), 6 px outside the frame, in the accent.
  const before = await portrait.evaluate((el) => {
    const cs = getComputedStyle(el, "::before");
    return { content: cs.content, inset: cs.top, layers: cs.backgroundImage.split("linear-gradient").length - 1, image: cs.backgroundImage };
  });
  expect(before).toMatchObject({ content: '""', inset: "-6px", layers: 8 });
  expect(before.image).toContain("rgb(184, 151, 90)"); // Mat accent #b8975a
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
