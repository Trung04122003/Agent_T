import { expect, test, type Page } from "./test";

// Owner request 2026-11-01: a terraced 3D view of the map beside the flat one (from 1280 px),
// swapped with 2D/3D buttons on narrow screens; its code is fetched only once it is on screen.
const fetched = (page: Page) => {
  const urls: string[] = [];
  page.on("request", (r) => r.url().includes("map-3d") && urls.push(r.url()));
  return urls;
};
/** Height of a top surface: the lift of its layer (transform "translate(0 -h) matrix(...)"). */
const lift = (page: Page, code: string) =>
  page
    .locator(`.map3d__top[data-code="${code}"]`)
    .evaluate((p) => -Number(/translate\(0 (-?[\d.]+)\)/.exec(p.parentElement!.getAttribute("transform")!)![1]));

test.describe("1280 px: side by side", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("both maps show; the 3D code loads when the map comes near; no 2D/3D buttons", async ({ page }) => {
    const urls = fetched(page);
    await page.goto("/vi/");
    await page.waitForTimeout(500);
    expect(urls).toEqual([]); // the map is far below the first screen
    await page.locator("[data-map]").scrollIntoViewIfNeeded();
    await expect(page.locator(".map3d__top")).toHaveCount(63);
    expect(urls.length).toBe(1);
    await expect(page.locator("[data-map-frame]")).toBeVisible();
    await expect(page.locator("[data-map-3d]")).toBeVisible();
    await expect(page.locator("[data-map-view]")).toBeHidden();
    // Side by side: same row.
    const a = (await page.locator("[data-map-frame]").boundingBox())!;
    const b = (await page.locator("[data-map-3d] .map__frame").boundingBox())!;
    expect(Math.abs(a.y - b.y)).toBeLessThan(2);
    expect(b.x).toBeGreaterThan(a.x + a.width);
  });

  test("heights follow the steps of the mode: Bac Kan rises to home after the merger", async ({ page }) => {
    await page.goto("/vi/");
    await page.locator("[data-map]").scrollIntoViewIfNeeded();
    await expect(page.locator(".map3d__top")).toHaveCount(63);
    expect(await lift(page, "VN-DN")).toBe(44); // home
    expect(await lift(page, "VN-53")).toBe(44); // Bac Kan, part of Thai Nguyen now
    expect(await lift(page, "VN-SG")).toBe(12); // the rest of Viet Nam
    await page.locator('[data-era-btn="before"]').click();
    await expect.poll(() => lift(page, "VN-53")).toBe(26); // next to home before 2025
    expect(await lift(page, "VN-DN")).toBe(44);
    // Every province has risers under its top.
    expect(await page.locator(".map3d__wall[data-tb]").count()).toBeGreaterThan(63 * 5);
  });

  test("hover names the unit in the 3D frame and lights it; the 2D hover lights home provinces too", async ({ page }) => {
    await page.goto("/vi/");
    await page.locator("[data-map]").scrollIntoViewIfNeeded();
    const top = page.locator('.map3d__top[data-code="VN-DN"]');
    await expect(top).toHaveCount(1);
    const idle3d = await top.evaluate((e) => getComputedStyle(e).fill);
    await top.hover({ force: true });
    const readout = page.locator("[data-map-3d] [data-map-readout]");
    await expect(readout).toBeVisible();
    await expect(readout.locator("[data-readout-name]")).toHaveText("Đà Nẵng");
    await expect(page.locator(".map3d__top.is-hot")).toHaveCount(2);
    await expect.poll(() => top.evaluate((e) => getComputedStyle(e).fill)).not.toBe(idle3d);
    await page.mouse.move(5, 5);
    await expect(readout).toBeHidden();

    // 2D: a home province changes colour under the pointer (its step rule must not win). Bac Kan:
    // home since the merger, and no place dot sits on it.
    const flat = page.locator('[data-map-provinces] path[data-code="VN-53"]');
    const idle = await flat.evaluate((e) => getComputedStyle(e).fill);
    await flat.hover({ force: true });
    await expect.poll(() => flat.evaluate((e) => getComputedStyle(e).fill)).not.toBe(idle);
  });

  test("the four places and the capital stand on the home step, and mirror the legend", async ({ page }) => {
    await page.goto("/vi/");
    await page.locator("[data-map]").scrollIntoViewIfNeeded();
    const marks = page.locator("[data-map-3d-svg] .map3d__marks");
    await expect(marks.locator(".map__point")).toHaveCount(4);
    await expect(marks.locator(".map__capital")).toHaveCount(1);
    await page.locator('[data-place-btn="da-nang"]').hover();
    await expect(marks.locator(".map__point.is-active")).toHaveCount(1);
  });
});

test.describe("375 px: one map at a time", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("2D first, 3D code not fetched; the 3D button swaps them and builds it", async ({ page }) => {
    const urls = fetched(page);
    await page.goto("/vi/");
    await page.locator("[data-map]").scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    await expect(page.locator("[data-map-frame]")).toBeVisible();
    await expect(page.locator("[data-map-3d]")).toBeHidden();
    expect(urls).toEqual([]);
    const flat = page.locator('[data-view-btn="2d"]');
    const tall = page.locator('[data-view-btn="3d"]');
    await expect(flat).toHaveAttribute("aria-pressed", "true");
    await tall.click();
    await expect(tall).toHaveAttribute("aria-pressed", "true");
    await expect(flat).toHaveAttribute("aria-pressed", "false");
    await expect(page.locator("[data-map-frame]")).toBeHidden();
    await expect(page.locator(".map3d__top")).toHaveCount(63);
    expect(urls.length).toBe(1);
    // No horizontal scroll from the 3D column.
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  });
});

test("without JavaScript: no 3D view, no 2D/3D buttons", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  await page.goto("/vi/");
  await expect(page.locator("[data-map-3d]")).toBeHidden();
  await expect(page.locator("[data-map-view]")).toBeHidden();
  await expect(page.locator("[data-map-frame]")).toBeVisible();
  await context.close();
});

test("print: the flat map only, even from the 3D view", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/vi/");
  await page.locator("[data-map]").scrollIntoViewIfNeeded();
  await page.locator('[data-view-btn="3d"]').click();
  await page.emulateMedia({ media: "print" });
  await expect(page.locator("[data-map-3d]")).toBeHidden();
});
