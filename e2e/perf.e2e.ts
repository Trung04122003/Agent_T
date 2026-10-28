import { expect, test, type Page } from "./test";
import { FIXTURE } from "../playwright.config";

// ROADMAP 4.4: the effect layer causes no unwanted layout shift and animates only
// transform / opacity / clip-path. (Opening a row uses grid-template-rows, which UX section 3
// prescribes explicitly; it is not part of the mode-change layer.)
const ALLOWED = new Set(["transform", "opacity", "clipPath"]);

/** Sum of every layout-shift entry since load, including those right after input (stricter than CLS). */
async function trackShifts(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __shift: number };
    w.__shift = 0;
    new PerformanceObserver((list) => {
      for (const e of list.getEntries() as unknown as { value: number }[]) w.__shift += e.value;
    }).observe({ type: "layout-shift", buffered: true });
  });
}
const shifts = (page: Page) => page.evaluate(() => (window as unknown as { __shift: number }).__shift);

/** Every animated property seen while the scene runs, sampled each frame. */
async function animatedProps(page: Page, act: () => Promise<void>): Promise<string[]> {
  await page.evaluate(() => {
    const w = window as unknown as { __props: Set<string>; __stop: boolean };
    w.__props = new Set();
    w.__stop = false;
    const sample = () => {
      for (const a of document.getAnimations()) {
        // The map draw-in uses stroke-dashoffset by design (UX section 3); it is not the mode layer.
        if (((a.effect as KeyframeEffect).target as Element | null)?.closest?.("[data-map]")) continue;
        for (const k of (a.effect as KeyframeEffect).getKeyframes()) {
          for (const p of Object.keys(k)) if (!["offset", "computedOffset", "easing", "composite"].includes(p)) w.__props.add(p);
        }
      }
      if (!w.__stop) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  await act();
  await page.waitForTimeout(700);
  return page.evaluate(() => {
    const w = window as unknown as { __props: Set<string>; __stop: boolean };
    w.__stop = true;
    return [...w.__props];
  });
}

for (const width of [360, 1280]) {
  test(`no layout shift on load and on mode changes (${width}px, real content)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await trackShifts(page);
    await page.goto("/vi/");
    await page.evaluate(() => document.fonts.ready);
    const toggle = page.locator("[data-mode-toggle]");
    const props = await animatedProps(page, () => toggle.click());
    props.push(...(await animatedProps(page, () => toggle.click())));
    expect(await shifts(page)).toBeLessThan(0.1);
    expect([...new Set(props)].filter((p) => !ALLOWED.has(p))).toEqual([]);
    expect(props).toContain("clipPath");
  });
}

test("View declassified uses the same layer: only transform, opacity, clip-path", async ({ page }) => {
  await page.goto(`${FIXTURE}/vi/`);
  await page.locator("#claim-fx-pending [data-row-toggle]").click();
  await page.waitForTimeout(400);
  const props = await animatedProps(page, () => page.locator("#claim-fx-pending [data-declassify]").click());
  expect(props.filter((p) => !ALLOWED.has(p) && p !== "gridTemplateRows")).toEqual([]);
  await expect(page.locator("#claim-fx-pending .row__summary")).toBeVisible();
});
