import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { DEV } from "../playwright.config";
import { gotoStable } from "./helpers";
import { expect, test, type Locator, type Page } from "./test";

// ROADMAP 2.2 / P29: the portrait is the owner's photo, one per mode, from tools/portrait/build.mjs:
// AVIF and WebP sources over a JPEG fallback, declared size, labels and alt text from content/.
const portrait = JSON.parse(readFileSync("content/portrait.json", "utf8"));
const setMode = (page: Page, mode: string) => page.addInitScript((m) => localStorage.setItem("mode", m), mode);

async function expectResponsiveImage(picture: Locator, name: string) {
  const types = await picture.locator("source").evaluateAll((s) => s.map((e) => e.getAttribute("type")));
  expect(types).toEqual(["image/avif", "image/webp"]);
  const img = picture.locator("img");
  await expect(img).toHaveAttribute("width", "960");
  await expect(img).toHaveAttribute("height", "1200");
  await expect(img).toHaveAttribute("decoding", "async");
  await expect(img).toHaveAttribute("src", `/portrait/${name}-960.jpg`);
  await expect(picture.locator('source[type="image/avif"]')).toHaveAttribute("srcset", `/portrait/${name}-480.avif 480w, /portrait/${name}-720.avif 720w, /portrait/${name}-960.avif 960w`);
}

test("29.8 the Mat photo: sized, fetched first, alt and label from content/", async ({ page }) => {
  await setMode(page, "mat");
  await page.goto("/vi/");
  const mat = page.locator("[data-portrait] .portrait__pic--mat");
  await expectResponsiveImage(mat, "low");
  const img = mat.locator("img");
  await expect(img).toHaveAttribute("alt", portrait.alt.mat.vi);
  await expect(img).toHaveAttribute("fetchpriority", "high");
  await expect(img).toHaveAttribute("loading", "eager");
  await expect.poll(() => img.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth)).toBeGreaterThan(0);
  await expect(page.locator("[data-portrait] .portrait__label span:visible")).toHaveText(portrait.label.mat.vi);
  const box = (await page.locator("[data-portrait]").boundingBox())!;
  expect(box.width / box.height).toBeCloseTo(4 / 5, 2);
  // No place in any alt text (ROADMAP 29.8).
  for (const mode of ["mat", "giaiMat"]) for (const l of ["vi", "en"]) expect(portrait.alt[mode][l]).not.toMatch(/coffee|angel|quán|café/i);
});

test("29.7 the Giai mat photo waits, then is fetched when the page is idle, before any switch", async ({ page }) => {
  await setMode(page, "mat");
  await page.goto("/vi/");
  const giai = page.locator("[data-portrait] .portrait__pic--giai-mat");
  await expectResponsiveImage(giai, "high-b");
  const img = giai.locator("img");
  await expect(img).toHaveAttribute("fetchpriority", "low");
  await expect(giai).toBeHidden();
  // Still hidden (Mat), yet loaded once the page has gone idle.
  await expect.poll(() => img.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0), { timeout: 8000 }).toBe(true);
  await expect(img).toHaveAttribute("loading", "eager");
});

test("one photo per mode; the label follows; print shows Giai mat", async ({ page }) => {
  await setMode(page, "mat");
  await page.goto("/vi/");
  const mat = page.locator(".portrait__pic--mat");
  const giaiMat = page.locator(".portrait__pic--giai-mat");
  await expect(mat).toBeVisible();
  await expect(giaiMat).toBeHidden();

  await page.locator("[data-mode-toggle]").click();
  await expect(mat).toBeHidden();
  await expect(giaiMat).toBeVisible();
  await expect(giaiMat.locator("img")).toHaveAttribute("alt", portrait.alt.giaiMat.vi);
  await expect(page.locator("[data-portrait] .portrait__label span:visible")).toHaveText(portrait.label.giaiMat.vi);

  // Print is always Giai mat. On the site the page prints its one-page file only (P18), so this is
  // checked on the dev page that holds the portrait alone.
  await gotoStable(page, `${DEV}/dev/portrait`);
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".portrait__pic--mat")).toBeHidden();
  await expect(page.locator(".portrait__pic--giai-mat")).toBeVisible();
});

test("29.6 every portrait file: at most 120 KB, sRGB, no metadata", async () => {
  const dir = join("public", "portrait");
  const files = readdirSync(dir);
  expect(files.sort()).toEqual(
    ["low", "high-b"].flatMap((v) => [480, 720, 960].flatMap((w) => ["avif", "jpg", "webp"].map((e) => `${v}-${w}.${e}`))).sort(),
  );
  for (const f of files) {
    expect(statSync(join(dir, f)).size, f).toBeLessThanOrEqual(120 * 1024);
    const meta = await sharp(join(dir, f)).metadata();
    expect([meta.exif, meta.xmp, meta.iptc].filter(Boolean), f).toEqual([]);
    expect(meta.space, f).toBe("srgb");
  }
});
