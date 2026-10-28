import { expect, test } from "./test";
import { DEV } from "../playwright.config";
import { gotoStable } from "./helpers";

// ROADMAP 5.5: dir="rtl" smoke test on a dev-only page (never published).
for (const width of [360, 1280]) {
  test(`RTL layout holds at ${width}px (screenshot)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.addInitScript(() => localStorage.setItem("mode", "mat"));
    await gotoStable(page, `${DEV}/dev/rtl`);
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);

    // Mirrored: the sample and ledger codes sit at the right edge of the content column
    // (max 1200 px, centred, 16 px gutter); the mode switch (line end) goes left.
    const contentRight = Math.min(width, (width + 1200) / 2) - 16;
    const sample = (await page.locator("[data-rtl-sample]").boundingBox())!;
    expect(sample.x + sample.width).toBeGreaterThan(contentRight - 2);
    // Ledger codes: at the right edge of the ledger sheet's content box (inside its padding).
    const ledgerRight = await page.locator("[data-ledger]").evaluate((el) => {
      const cs = getComputedStyle(el);
      return el.getBoundingClientRect().right - parseFloat(cs.paddingRight) - parseFloat(cs.borderRightWidth);
    });
    const code = (await page.locator(".row__code").first().boundingBox())!;
    expect(code.x + code.width).toBeGreaterThan(ledgerRight - 2);
    const label = (await page.locator(".portrait__label").boundingBox())!;
    const frame = (await page.locator("[data-portrait]").boundingBox())!;
    expect(label.x + label.width).toBeGreaterThan(frame.x + frame.width - 40);
    if (width >= 900) {
      const toggle = (await page.locator("[data-mode-toggle]").boundingBox())!;
      expect(toggle.x).toBeLessThan(40);
      const portrait = (await page.locator(".gate__portrait").boundingBox())!;
      const id = (await page.locator(".gate__id").boundingBox())!;
      expect(portrait.x).toBeLessThan(id.x); // portrait column mirrors to the left
    }
    // Dates keep their reading order inside RTL text (start before end).
    const period = page.locator(".row__period").filter({ hasText: "–" }).first();
    await expect(period).toHaveAttribute("dir", "ltr");
    const [start, end] = (await period.innerText()).split(" – ");
    const parts = await period.evaluate((el) => {
      const range = document.createRange();
      const text = el.firstChild!;
      const s = text.textContent!;
      const at = (i: number) => (range.setStart(text, i), range.setEnd(text, i + 1), range.getBoundingClientRect().x);
      return { first: at(0), last: at(s.length - 1) };
    });
    expect(parts.first).toBeLessThan(parts.last);
    expect(start).toBeTruthy();
    expect(end).toBeTruthy();
    expect(await page.locator(".redaction__bars").first().evaluate((el) => getComputedStyle(el).transform)).toContain("-1");

    await page.screenshot({ path: `test-results/screenshots/rtl-${width}.png`, fullPage: true });
  });
}
