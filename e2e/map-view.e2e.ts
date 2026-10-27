import { expect, test, type Page } from "@playwright/test";

// P12 (owner request 2026-10-26): the map has its own frame, a legend that explains it, and can be
// zoomed and dragged. Text sits on solid sheets so the page grid never runs through it.
const viewBox = (page: Page) => page.locator("[data-map-svg]").evaluate((el) => el.getAttribute("viewBox")!.split(" ").map(Number));

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/vi/");
  await page.locator("[data-map]").scrollIntoViewIfNeeded();
});

test("zoom buttons change the view; labels keep their screen size; reset returns", async ({ page }) => {
  const [, , w0] = await viewBox(page);
  await expect(page.locator('[data-zoom="out"]')).toBeDisabled();
  const label = page.locator('[data-place="da-nang"] text').first();
  const size0 = (await label.boundingBox())!.height;

  await page.locator('[data-zoom="in"]').click();
  const [, , w1] = await viewBox(page);
  expect(w1).toBeCloseTo(w0! / 1.5, 3);
  expect(Math.abs((await label.boundingBox())!.height - size0)).toBeLessThanOrEqual(1);

  for (let i = 0; i < 6; i++) await page.locator('[data-zoom="in"]').click({ force: true });
  expect((await viewBox(page))[2]).toBeCloseTo(w0! / 4, 3); // capped at 4x
  await expect(page.locator('[data-zoom="in"]')).toBeDisabled();

  await page.locator('[data-zoom="reset"]').click();
  expect(await viewBox(page)).toEqual([0, 0, w0, (await viewBox(page))[3]]);
});

test("mouse wheel zooms around the pointer; at full view, scrolling down still scrolls the page", async ({ page }) => {
  const svg = page.locator("[data-map-svg]");
  const box = (await svg.boundingBox())!;
  // Point the wheel at Da Nang: it must stay under the pointer while zooming.
  const dot = (await page.locator('[data-place="da-nang"] .map__dot').boundingBox())!;
  const at = { x: dot.x + dot.width / 2, y: dot.y + dot.height / 2 };
  const [, , w0] = await viewBox(page);

  await page.mouse.move(at.x, at.y);
  await page.mouse.wheel(0, -300);
  await expect.poll(async () => (await viewBox(page))[2]).toBeLessThan(w0!);
  const after = (await page.locator('[data-place="da-nang"] .map__dot').boundingBox())!;
  expect(Math.abs(after.x + after.width / 2 - at.x)).toBeLessThanOrEqual(2);
  expect(Math.abs(after.y + after.height / 2 - at.y)).toBeLessThanOrEqual(2);
  await expect(page.locator('[data-zoom="out"]')).toBeEnabled();

  // Back out to the full view; a further scroll down is left to the page (not cancelled).
  for (let i = 0; i < 6; i++) await page.mouse.wheel(0, 400);
  await expect.poll(async () => (await viewBox(page))[2]).toBeCloseTo(w0!, 3);
  await page.evaluate(() => {
    const w = window as unknown as { __wheel: boolean[] };
    w.__wheel = [];
    addEventListener("wheel", (e) => w.__wheel.push(e.defaultPrevented));
  });
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, 300);
  await expect.poll(() => page.evaluate(() => (window as unknown as { __wheel: boolean[] }).__wheel)).toEqual([false]);
  expect((await viewBox(page))[2]).toBeCloseTo(w0!, 3);
});

test("dragging pans only while zoomed", async ({ page }) => {
  const svg = page.locator("[data-map-svg]");
  const box = (await svg.boundingBox())!;
  const at = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const drag = async () => {
    await page.mouse.move(at.x, at.y);
    await page.mouse.down();
    await page.mouse.move(at.x + 80, at.y + 60, { steps: 4 });
    await page.mouse.up();
  };
  const before = await viewBox(page);
  await drag();
  expect(await viewBox(page)).toEqual(before);

  await page.locator('[data-zoom="in"]').click();
  await page.locator('[data-zoom="in"]').click();
  const zoomed = await viewBox(page);
  await drag();
  const panned = await viewBox(page);
  expect(panned[0]).toBeLessThan(zoomed[0]!);
  expect(panned[1]).toBeLessThan(zoomed[1]!);
});

test("legend: picking a place zooms to it; keyboard works", async ({ page }) => {
  const item = page.locator('[data-place-btn="thuong-tin"]');
  await item.focus();
  await expect(page.locator('[data-place="thuong-tin"]')).toHaveClass(/is-active/);
  await page.keyboard.press("Enter");
  await expect(item).toHaveAttribute("aria-pressed", "true");
  const [x, y, w, h] = await viewBox(page);
  const point = await page.locator('[data-place="thuong-tin"]').evaluate((el) => {
    const m = (el as SVGGElement).transform.baseVal.consolidate()!.matrix;
    return [m.e, m.f];
  });
  // Centred on the place unless the view hits the edge of the drawing.
  expect(point[0]).toBeGreaterThan(x!);
  expect(point[0]).toBeLessThan(x! + w!);
  expect(point[1]).toBeGreaterThan(y!);
  expect(point[1]).toBeLessThan(y! + h!);
  // ROADMAP 20.4: the role is written in the list only, never on the map.
  await expect(page.locator("[data-map-svg] .map__role")).toHaveCount(0);
  await expect(item).toContainText(/\S/);
});

for (const width of [375, 1280]) {
  for (const mode of ["mat", "giai-mat"]) {
    test(`20.4 no place label overlaps another label at ${width}px (${mode})`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.addInitScript((m) => localStorage.setItem("mode", m), mode);
      await page.goto("/vi/");
      await page.locator("[data-map]").scrollIntoViewIfNeeded();
      const boxes = await page.locator("[data-map-svg] [data-place] text").evaluateAll((els) =>
        els.map((e) => {
          const r = e.getBoundingClientRect();
          return { x0: r.left, y0: r.top, x1: r.right, y1: r.bottom, text: e.textContent };
        }),
      );
      expect(boxes.length).toBe(4);
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          const [a, b] = [boxes[i]!, boxes[j]!];
          const hit = a.x0 < b.x1 - 0.5 && b.x0 < a.x1 - 0.5 && a.y0 < b.y1 - 0.5 && b.y0 < a.y1 - 0.5;
          expect(hit, `${a.text} / ${b.text}`).toBe(false);
        }
      }
      // Labels keep a halo in the page background colour, so they read on land and sea alike.
      expect(await page.locator("[data-map-svg] [data-place] text").first().evaluate((e) => getComputedStyle(e).paintOrder)).toContain("stroke");
    });
  }
}

test("20.4 Giai mat shades the neighbours apart from Viet Nam", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("mode", "giai-mat"));
  await page.goto("/vi/");
  const fill = (sel: string) => page.locator(sel).first().evaluate((e) => getComputedStyle(e).fill);
  expect(await fill(".map__land path")).not.toBe(await fill(".map__vn"));
});

test("text never sits on the grid: every text block has a solid sheet", async ({ page }) => {
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  for (const sel of [".gate__id", ".gate__hint", "[data-lens-nav]", "[data-ledger]", "[data-map]", ".footer"]) {
    const el = page.locator(sel);
    expect(await el.evaluate((e) => getComputedStyle(e).backgroundColor), sel).toBe(bg);
    expect(await el.evaluate((e) => getComputedStyle(e).backgroundImage), sel).toBe("none");
  }
});

test("after an in-place language switch the map still zooms (controls re-armed)", async ({ page }) => {
  await page.locator("[data-lang-switch]:not([aria-current])").click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.locator("[data-map]").scrollIntoViewIfNeeded();
  await expect(page.locator("[data-map-zoom]")).toBeVisible();
  const [, , w0] = await viewBox(page);
  await page.locator('[data-zoom="in"]').click();
  expect((await viewBox(page))[2]).toBeCloseTo(w0! / 1.5, 3);
  await expect(page.locator("[data-map] [data-place]").first()).toHaveCSS("opacity", "1");
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });
  test("no zoom controls; the legend still lists every place", async ({ page }) => {
    await page.goto("/vi/");
    await expect(page.locator("[data-map-zoom]")).toBeHidden();
    await expect(page.locator("[data-place-btn]")).toHaveCount(4);
  });
});
