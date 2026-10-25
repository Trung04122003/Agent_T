import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

// ROADMAP 8.4: 404, neutral SEO meta, static OG image, noindex everywhere until launch.
const identity = JSON.parse(readFileSync("content/identity.json", "utf8"));
const ui = JSON.parse(readFileSync("content/ui.json", "utf8"));

test("unknown paths get the 404 page, in both languages, with links home", async ({ page }) => {
  const res = await page.goto("/vi/khong-co-trang-nay/");
  expect(res?.status()).toBe(404);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex");
  for (const l of ["vi", "en"] as const) {
    const line = page.locator(`.not-found__line[lang="${l}"]`);
    await expect(line).toContainText(ui.notFound[l]);
    await expect(line.locator("a")).toHaveAttribute("href", `/${l}/`);
  }
});

for (const locale of ["vi", "en"] as const) {
  test(`/${locale}/ has noindex, a neutral description and Open Graph tags`, async ({ page }) => {
    await page.goto(`/${locale}/`);
    const meta = (sel: string) => page.locator(sel).getAttribute("content");
    expect(await meta('meta[name="robots"]')).toBe("noindex");
    expect(await meta('meta[name="description"]')).toBe(identity.positioning[locale]);
    expect(await meta('meta[property="og:description"]')).toBe(identity.positioning[locale]);
    expect(await meta('meta[property="og:image"]')).toBe("/og.png");
    expect(await meta('meta[property="og:locale"]')).toBe(locale === "vi" ? "vi_VN" : "en_US");
  });
}

test("the OG image is a 1200x630 PNG served from the site", async ({ request }) => {
  const res = await request.get("/og.png");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("image/png");
  const png = await res.body();
  expect(png.readUInt32BE(16)).toBe(1200); // IHDR width
  expect(png.readUInt32BE(20)).toBe(630); // IHDR height
});
