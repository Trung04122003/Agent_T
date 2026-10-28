import { expect, test, type Locator } from "./test";
import { DEV } from "../playwright.config";
import { gotoStable } from "./helpers";

// ROADMAP 2.2: portrait images are AVIF/WebP with declared size; one image per mode.
async function expectResponsiveImage(picture: Locator) {
  const types = await picture.locator("source").evaluateAll((s) => s.map((e) => e.getAttribute("type")));
  expect(types).toEqual(["image/avif", "image/webp"]);
  const img = picture.locator("img");
  await expect(img).toHaveAttribute("width", /^\d+$/);
  await expect(img).toHaveAttribute("height", /^\d+$/);
  // Built files end in .webp; astro dev serves them as /_image?...&f=webp.
  await expect(img).toHaveAttribute("src", /\.webp$|[?&]f=webp(&|$)/);
}

test("Gate shows the neutral placeholder as a sized AVIF/WebP picture", async ({ page }) => {
  await page.goto("/vi/");
  const picture = page.locator("[data-portrait] picture");
  await expect(picture).toHaveCount(1);
  await expectResponsiveImage(picture);
  const img = picture.locator("img");
  await expect(img).toHaveAttribute("alt", "");
  await expect.poll(() => img.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth)).toBeGreaterThan(0);
  const box = (await page.locator("[data-portrait]").boundingBox())!;
  expect(box.width / box.height).toBeCloseTo(4 / 5, 2);
});

test("two-photo portrait shows the image for the current mode, and Giai mat in print", async ({ page }) => {
  await gotoStable(page, `${DEV}/dev/portrait`);
  const mat = page.locator(".portrait__pic--mat");
  const giaiMat = page.locator(".portrait__pic--giai-mat");
  await expectResponsiveImage(mat);
  await expectResponsiveImage(giaiMat);
  await expect(mat.locator("img")).toHaveAttribute("alt", "thử mat");

  await expect(mat).toBeVisible();
  await expect(giaiMat).toBeHidden();

  await page.locator("[data-mode-toggle]").click();
  await expect(mat).toBeHidden();
  await expect(giaiMat).toBeVisible();

  await page.locator("[data-mode-toggle]").click();
  await page.emulateMedia({ media: "print" });
  await expect(mat).toBeHidden();
  await expect(giaiMat).toBeVisible();
});
