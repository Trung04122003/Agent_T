import { expect, test, type Page } from "./test";

// ROADMAP 6.3: the map draws in once when scrolled into view; reduced motion shows it all at once.
const mapAnimations = (page: Page) =>
  page.evaluate(() =>
    document
      .getAnimations()
      .filter((a) => (a.effect as KeyframeEffect).target?.closest?.("[data-map]"))
      .map((a) => {
        const t = (a.effect as KeyframeEffect).getComputedTiming();
        return { name: (a as CSSAnimation).animationName, duration: Math.round(Number(t.duration)), delay: Math.round(Number(t.delay)) };
      }),
  );

test("draws once on first scroll into view: outline 600 ms, points 120 ms apart, one 600 ms pulse", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/vi/");
  const map = page.locator("[data-map]");
  await expect(map).toHaveClass(/is-armed/);
  await expect(map).not.toHaveClass(/is-revealed/);
  await expect(map.locator("[data-place]").first()).toHaveCSS("opacity", "0");
  await expect(map.locator('[data-archipelago="hoang-sa"]')).toBeVisible(); // never hidden

  await map.scrollIntoViewIfNeeded();
  await expect(map).toHaveClass(/is-revealed/);
  const anims = await mapAnimations(page);
  expect(anims.find((a) => a.name === "map-draw")?.duration).toBe(600); // UX-v2: each effect <= 600 ms
  const points = anims.filter((a) => a.name === "point-in").map((a) => a.delay).sort((a, b) => a - b);
  expect(points).toEqual([650, 770, 890, 1010]); // start 50 ms after the outline: never overlapping
  const pulses = anims.filter((a) => a.name === "point-pulse");
  expect(pulses.length).toBe(4);
  for (const p of pulses) expect(p.duration).toBe(600);

  await page.waitForTimeout(2200); // everything finished
  await expect(map.locator("[data-place]").last()).toHaveCSS("opacity", "1");
  // Nothing loops: every map animation has finished.
  expect(
    await page.evaluate(() =>
      document.getAnimations().filter((x) => x.playState === "running" && (x.effect as KeyframeEffect).target?.closest?.("[data-map]")).length,
    ),
  ).toBe(0);

  // Scroll away and back: nothing replays.
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(200);
  await map.scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  const running = await page.evaluate(() =>
    document.getAnimations().filter((a) => a.playState === "running" && (a.effect as KeyframeEffect).target?.closest?.("[data-map]")).length,
  );
  expect(running).toBe(0);
});

test("reduced motion: fully drawn from the start, no animation", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/vi/");
  const map = page.locator("[data-map]");
  await expect(map).not.toHaveClass(/is-armed/);
  await map.scrollIntoViewIfNeeded();
  await expect(map.locator("[data-place]").first()).toHaveCSS("opacity", "1");
  expect(await map.locator(".map__vn").evaluate((el) => getComputedStyle(el).strokeDasharray)).toBe("none");
  expect(await mapAnimations(page)).toEqual([]);
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });
  test("the map is fully drawn", async ({ page }) => {
    await page.goto("/vi/");
    await expect(page.locator("[data-map] [data-place]").first()).toHaveCSS("opacity", "1");
  });
});
