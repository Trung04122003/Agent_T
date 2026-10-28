import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "./test";

// ROADMAP 10.1-10.4: flag language switch on the real build.

test("10.1 flags render as real images (not letters) in Chromium", async ({ page }) => {
  await page.goto("/vi/");
  const flags = page.locator("[data-lang-nav] .lang-switch__flag"); // the bar's switch (the entry gate has its own)
  await expect(flags).toHaveCount(2);
  for (const f of await flags.all()) {
    await expect(f).toBeVisible();
    expect(await f.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
    expect((await f.boundingBox())!.width).toBeCloseTo(20, 0);
  }
  await page.locator("[data-lang-nav]").screenshot({ path: "test-results/screenshots/p10-flags-vi.png" });
});

test("10.2 Tab and Enter switch language; current language is marked", async ({ page }) => {
  await page.goto("/vi/");
  await expect(page.locator('[data-lang-switch="vi"]')).toHaveAttribute("aria-current", "page");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await expect(page.locator('[data-lang-switch="en"]')).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/en\/$/);
  await expect(page.locator('[data-lang-switch="en"]')).toHaveAttribute("aria-current", "page");
  await expect(page.locator('[data-lang-switch="vi"]')).not.toHaveAttribute("aria-current", /.*/);
});

test("10.2 choosing the current language does nothing", async ({ page }) => {
  await page.goto("/vi/");
  await page.locator('[data-lang-switch="vi"]').click();
  await expect(page).toHaveURL(/\/vi\/$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "vi");
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });
  test("10.2 the flag links still switch language", async ({ page }) => {
    await page.goto("/vi/");
    await page.locator('[data-lang-switch="en"]').click();
    await expect(page).toHaveURL(/\/en\/$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator(".lang-switch__flag").first()).toBeVisible();
  });
});

test("10.4 vi -> en: the codename decodes and nothing shifts", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.addInitScript(() => {
    const w = window as unknown as { __shift: number };
    w.__shift = 0;
    new PerformanceObserver((l) => {
      for (const e of l.getEntries() as unknown as { value: number }[]) w.__shift += e.value;
    }).observe({ type: "layout-shift", buffered: true });
  });
  await page.goto("/vi/");
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => {
    const w = window as unknown as { __frames: string[] };
    w.__frames = [];
    new MutationObserver(() => w.__frames.push(document.querySelector("#gate-codename")?.textContent ?? "")).observe(
      document.documentElement,
      { subtree: true, childList: true, characterData: true },
    );
  });
  const box = (await page.locator("#gate-codename").boundingBox())!;
  await page.locator('[data-lang-switch="en"]').click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.waitForTimeout(600);
  const frames = await page.evaluate(() => (window as unknown as { __frames: string[] }).__frames);
  const final = await page.locator("#gate-codename").textContent();
  expect(frames.filter((f) => f && f !== final).length).toBeGreaterThan(3); // decoded, not swapped
  const after = (await page.locator("#gate-codename").boundingBox())!;
  expect(Math.abs(after.y - box.y)).toBeLessThan(1);
  expect(await page.evaluate(() => (window as unknown as { __shift: number }).__shift)).toBeLessThan(0.1);
});

test("10.4 no published page is right-to-left while Arabic is incomplete", () => {
  const html = readdirSync("dist", { recursive: true }).map(String).filter((f) => f.endsWith(".html"));
  for (const f of html) expect(readFileSync(join("dist", f), "utf8")).not.toContain('dir="rtl"');
});
