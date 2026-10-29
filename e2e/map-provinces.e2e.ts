import { readFileSync } from "node:fs";
import { expect, test, type Page } from "./test";

// Owner request 2026-10-29: provinces before (63) and after (34) the 2025 merger, stepped by
// brightness (sea < other countries < Viet Nam < next to home < home), a name on hover, and the
// capital's star.
const admin = JSON.parse(readFileSync("content/provinces.json", "utf8"));
const ui = JSON.parse(readFileSync("content/ui.json", "utf8"));
const setMode = (page: Page, mode: string) => page.addInitScript((m) => localStorage.setItem("mode", m), mode);
const fill = (page: Page, code: string) => page.locator(`path[data-code="${code}"]`).evaluate((e) => getComputedStyle(e).fill);
/** Relative lightness of any CSS colour (rgb, oklab, color()), read back from a 1px canvas. */
const light = (page: Page, css: string) =>
  page.evaluate((c) => {
    const ctx = document.createElement("canvas").getContext("2d")!;
    ctx.fillStyle = c;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
  }, css);

for (const mode of ["mat", "giai-mat"]) {
  test(`${mode}: the steps brighten from the sea to the home provinces`, async ({ page }) => {
    await setMode(page, mode);
    await page.goto("/vi/");
    const sea = await page.locator("[data-map-frame]").evaluate((e) => getComputedStyle(e).backgroundColor);
    const world = await page.locator(".map__land path").first().evaluate((e) => getComputedStyle(e).fill);
    const colours = [sea, world, await fill(page, "VN-SG"), await fill(page, "VN-26"), await fill(page, "VN-DN")];
    const steps = await Promise.all(colours.map((c) => light(page, c)));
    for (let i = 1; i < steps.length; i++) expect(steps[i], `step ${i}`).toBeGreaterThan(steps[i - 1]!);
  });
}

test("the mode buttons switch borders and steps; after the merger is the default", async ({ page }) => {
  await page.goto("/vi/");
  const map = page.locator("[data-map]");
  const before = page.locator('[data-era-btn="before"]');
  const after = page.locator('[data-era-btn="after"]');
  await expect(map).toHaveAttribute("data-era", "after");
  await expect(after).toHaveAttribute("aria-pressed", "true");
  await expect(after).toHaveText(ui.mapEraAfter.vi);
  await expect(page.locator(".map__border--merged")).toBeHidden();
  // Bac Kan is part of Thai Nguyen now: lit as home after, one step lower before.
  const home = await fill(page, "VN-69");
  expect(await fill(page, "VN-53")).toBe(home);

  await before.click();
  await expect(map).toHaveAttribute("data-era", "before");
  await expect(before).toHaveAttribute("aria-pressed", "true");
  await expect(after).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator(".map__border--merged")).toBeVisible();
  expect(await fill(page, "VN-53")).not.toBe(home);
});

test("hover names the province; after the merger, the whole unit and what it took in", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/vi/");
  await page.locator("[data-map]").scrollIntoViewIfNeeded();
  const readout = page.locator("[data-map-readout]");
  await expect(readout).toBeHidden();
  const quangNam = page.locator('path[data-code="VN-27"]');
  const b = (await quangNam.boundingBox())!;
  await page.mouse.move(b.x + b.width * 0.35, b.y + b.height * 0.6);
  await expect(readout).toBeVisible();
  await expect(readout.locator("[data-readout-name]")).toHaveText("Đà Nẵng");
  await expect(readout.locator("[data-readout-sub]")).toHaveText("Quảng Nam + Đà Nẵng");
  await expect(page.locator("path.is-hot")).toHaveCount(2);

  await page.locator('[data-era-btn="before"]').click();
  await page.mouse.move(b.x + b.width * 0.35 + 1, b.y + b.height * 0.6);
  await expect(readout.locator("[data-readout-name]")).toHaveText("Quảng Nam");
  await expect(readout.locator("[data-readout-sub]")).toBeEmpty();
  await expect(page.locator("path.is-hot")).toHaveCount(1);

  await page.mouse.move(5, 5);
  await expect(readout).toBeHidden();
  await expect(page.locator("path.is-hot")).toHaveCount(0);
});

test("63 provinces drawn, 34 units, names from content/; the capital star at Ha Noi, on top", async ({ page }) => {
  await page.goto("/en/");
  const shapes = page.locator("[data-map-provinces] path");
  await expect(shapes).toHaveCount(63);
  const units = await shapes.evaluateAll((ps) => new Set(ps.map((p) => p.getAttribute("data-unit"))).size);
  expect(units).toBe(admin.after.length);
  await expect(page.locator('path[data-code="VN-26"]')).toHaveAttribute("data-unit-name", "Hue");
  // Drawn last in the SVG, so the Thuong Tin ring never covers it.
  const last = await page.locator("[data-map-svg]").evaluate((s) => s.lastElementChild?.getAttribute("class"));
  expect(last).toBe("map__capital");
});

test("without JavaScript: after the merger shown, no mode buttons, no readout", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("/vi/");
  await expect(page.locator("[data-map-era]")).toBeHidden();
  await expect(page.locator(".map__border--merged")).toBeHidden();
  await context.close();
});
