import { readFileSync } from "node:fs";
import { expect, test, type Page } from "./test";

// Owner request 2026-11-01: a terraced 3D view of the map beside the flat one (from 1280 px),
// swapped with 2D/3D buttons on narrow screens; its code is fetched only once it is on screen.
const fetched = (page: Page) => {
  const urls: string[] = [];
  page.on("request", (r) => r.url().includes("map-3d") && urls.push(r.url()));
  return urls;
};
const contentLabels = JSON.parse(readFileSync("content/countries.json", "utf8")).labels as { code: string; vi: string; en: string }[];
/** Height of the risen stack's top (its last layer). */
const crown = (page: Page) =>
  page.locator(".map3d__rise > g:last-child").evaluate((g) => -Number(/translate\(0 (-?[\d.]+)\)/.exec(g.getAttribute("transform")!)![1]));
const viewBox = (page: Page, sel: string) => page.locator(sel).evaluate((s) => s.getAttribute("viewBox")!.split(" ").map(Number));
/** Height of a top surface: the lift of its layer (transform "translate(0 -h) matrix(...)"). */
const lift = (page: Page, code: string) =>
  page
    .locator(`.map3d__top[data-code="${code}"]:not(.map3d__rise *)`)
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

  test("ripple: the unit under the pointer rises a step higher, then settles back when it leaves", async ({ page }) => {
    await page.goto("/vi/");
    await page.locator("[data-map]").scrollIntoViewIfNeeded();
    // Quang Ngai (no place dot on it): since the merger one unit with Kon Tum, on the near step.
    const top = page.locator('.map3d__top[data-code="VN-29"]:not(.map3d__rise *)');
    await expect(top).toHaveCount(1);
    const idle = await top.evaluate((e) => getComputedStyle(e).fill);
    await top.hover({ force: true });
    const readout = page.locator("[data-map-3d] [data-map-readout]");
    await expect(readout.locator("[data-readout-name]")).toHaveText("Quảng Ngãi");
    await expect(readout.locator("[data-readout-sub]")).toHaveText("Kon Tum + Quảng Ngãi");
    await expect(page.locator(".map3d__rise")).toHaveCount(1);
    await expect(page.locator(".map3d__rise .map3d__top.is-hot")).toHaveCount(2);
    await expect.poll(() => crown(page)).toBe(26 + 22); // near step + the ripple
    // The original stacks hide while the copy is up; the copy is lit.
    expect(await page.locator(".is-lifted").count()).toBe(2 * (26 / 2 + 1));
    expect(await page.locator('.map3d__rise .map3d__top[data-code="VN-29"]').evaluate((e) => getComputedStyle(e).fill)).not.toBe(idle);
    // It moves by transform only: no CSS transition or animation on the stack.
    expect(await page.locator(".map3d__rise").evaluate((g) => g.getAnimations({ subtree: true }).length)).toBe(0);

    await page.mouse.move(5, 5);
    await expect(readout).toBeHidden();
    await expect(page.locator(".map3d__rise")).toHaveCount(0);
    await expect(page.locator(".is-lifted")).toHaveCount(0);
    // At rest nothing runs (after the Mat cursor ring has caught up with the mouse, as in 22.3).
    await page.waitForTimeout(900);
    const frames = await page.evaluate(async () => {
      let n = 0;
      const orig = window.requestAnimationFrame;
      window.requestAnimationFrame = (cb) => (n++, orig(cb));
      await new Promise((r) => setTimeout(r, 300));
      window.requestAnimationFrame = orig;
      return n;
    });
    expect(frames).toBe(0);

    // 2D: a home province changes colour under the pointer (its step rule must not win). Bac Kan:
    // home since the merger, and no place dot sits on it.
    const flat = page.locator('[data-map-provinces] path[data-code="VN-53"]');
    const idle2d = await flat.evaluate((e) => getComputedStyle(e).fill);
    await flat.hover({ force: true });
    await expect.poll(() => flat.evaluate((e) => getComputedStyle(e).fill)).not.toBe(idle2d);
  });

  test("ripple with reduced motion: up and down at once", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/vi/");
    await page.locator("[data-map]").scrollIntoViewIfNeeded();
    const top = page.locator('.map3d__top[data-code="VN-29"]:not(.map3d__rise *)');
    await top.hover({ force: true });
    await expect(page.locator(".map3d__rise")).toHaveCount(1);
    expect(await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))).then(() => 0))).toBe(0);
    expect(await crown(page)).toBe(48);
  });

  test("zoom, pan buttons and legend picks work on the 3D view too", async ({ page }) => {
    await page.goto("/vi/");
    await page.locator("[data-map]").scrollIntoViewIfNeeded();
    await expect(page.locator(".map3d__top").first()).toBeAttached();
    const flat0 = await viewBox(page, "[data-map-svg]");
    const tall0 = await viewBox(page, "[data-map-3d-svg]");
    const zoomIn = page.locator('[data-map-3d] [data-zoom="in"]');
    await expect(page.locator('[data-map-3d] [data-zoom="out"]')).toBeDisabled();
    await zoomIn.click();
    const tall1 = await viewBox(page, "[data-map-3d-svg]");
    expect(tall1[2]).toBeCloseTo(tall0[2]! / 1.5, 1);
    expect(await viewBox(page, "[data-map-svg]")).toEqual(flat0); // each map zooms on its own
    await expect(page.locator("[data-map-3d-svg]")).toHaveClass(/is-zoomed/);
    await page.locator('[data-map-3d] [data-zoom="reset"]').click();
    expect(await viewBox(page, "[data-map-3d-svg]")).toEqual(tall0);

    // Picking Da Nang in the legend zooms both maps to it.
    await page.locator('[data-place-btn="da-nang"]').click();
    const flat2 = await viewBox(page, "[data-map-svg]");
    const tall2 = await viewBox(page, "[data-map-3d-svg]");
    expect(flat2[2]).toBeLessThan(flat0[2]!);
    expect(tall2[2]).toBeLessThan(tall0[2]!);
    const spotX = await page
      .locator("[data-map-3d-svg] .map3d__marks .map__point--current")
      .evaluate((g) => (g as SVGGElement).transform.baseVal.consolidate()!.matrix.e);
    expect(Math.abs(tall2[0]! + tall2[2]! / 2 - spotX)).toBeLessThan(1);
  });

  test("land borders and the neighbours' names on both maps, never cut by the frame", async ({ page }) => {
    for (const locale of ["vi", "en"] as const) {
      await page.goto(`/${locale}/`);
      await page.locator("[data-map]").scrollIntoViewIfNeeded();
      expect((await page.locator("[data-map-frontier]").getAttribute("d"))!.length).toBeGreaterThan(200);
      const flat = page.locator("[data-map-svg] .map__country");
      await expect(flat.locator("text")).toHaveText(contentLabels.map((c) => c[locale]));
      const box = (await page.locator("[data-map-svg]").boundingBox())!;
      for (const t of await flat.locator("text").all()) {
        const b = (await t.boundingBox())!;
        expect(b.x).toBeGreaterThanOrEqual(box.x);
        expect(b.x + b.width).toBeLessThanOrEqual(box.x + box.width);
      }
      await expect(page.locator("[data-map-3d-svg] .map3d__marks .map__country")).toHaveCount(contentLabels.length);
      await expect(page.locator("[data-map-3d-svg] .map3d__frontier")).toHaveCount(1);
    }
  });

  test("the four places and the capital stand on the home step, and mirror the legend", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" }); // with the 2D draw-in armed
    await page.goto("/vi/");
    await page.locator("[data-map]").scrollIntoViewIfNeeded();
    const marks = page.locator("[data-map-3d-svg] .map3d__marks");
    await expect(marks.locator(".map__point")).toHaveCount(4);
    // Shown at once and still: the 2D draw-in neither hides nor animates the copies.
    await expect(page.locator("[data-map]")).toHaveClass(/is-armed/);
    for (const p of await marks.locator(".map__point").all()) await expect(p).toHaveCSS("opacity", "1");
    await expect(marks.locator(".map__capital")).toHaveCount(1);
    await page.locator('[data-place-btn="da-nang"]').hover();
    await expect(marks.locator(".map__point.is-active")).toHaveCount(1);
  });
});

test.describe("1280 px: the archipelagos are named on the 3D view too", () => {
  test.use({ viewport: { width: 1280, height: 900 } });
  const ui = JSON.parse(readFileSync("content/ui.json", "utf8"));

  test("Hoang Sa (Viet Nam) and Truong Sa (Viet Nam): in view, next to their islands, vi and en", async ({ page }) => {
    for (const locale of ["vi", "en"] as const) {
      await page.goto(`/${locale}/`);
      await page.locator("[data-map]").scrollIntoViewIfNeeded();
      const marks = page.locator("[data-map-3d-svg] .map3d__marks");
      const box = (await page.locator("[data-map-3d-svg]").boundingBox())!;
      for (const [id, key] of [["hoang-sa", "hoangSaLabel"], ["truong-sa", "truongSaLabel"]] as const) {
        const label = marks.locator(`[data-archipelago="${id}"]`);
        await expect(label).toHaveText(ui[key][locale]);
        await expect(label).toBeVisible();
        const b = (await label.boundingBox())!;
        expect(b.x).toBeGreaterThanOrEqual(box.x);
        expect(b.x + b.width).toBeLessThanOrEqual(box.x + box.width);
        // The nearest island dot is close under the name.
        const near = await page.evaluate((r) => {
          const dots = [...document.querySelectorAll("[data-map-3d-svg] .map3d__isle")].map((c) => c.getBoundingClientRect());
          return Math.min(...dots.map((d) => Math.hypot(d.x - (r.x + r.width / 2), d.y - r.y)));
        }, b);
        expect(near, id).toBeLessThan(140);
      }
    }
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
