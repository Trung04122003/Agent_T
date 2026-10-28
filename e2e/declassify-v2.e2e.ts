import { expect, test, type Page } from "./test";

// P16: Declassify v2 — bars shrink, the classification strip types its new level, the chart line
// draws in with clip-path. The roadmap asked for 600 ms; the owner chose (2026-10-27) slower, visible
// bars, so the scene ends within SCENE ms. Fallbacks for reduced motion and
// for browsers without View Transitions.
/** Scene length from TIMING.total in declassify.ts (owner decision, DECISIONS.md). */
const SCENE = 720;
type Anim = { name: string; cls: string; pseudo: string | null; delay: number; duration: number; props: string[] };

/**
 * Click (from JS, no scroll) and snapshot every animation in the first frame where the scene runs.
 * Waiting and snapshot happen in the page, in one frame, so a busy machine cannot let short
 * effects finish in between.
 */
async function clickAndCapture(page: Page): Promise<Anim[]> {
  return page.locator("[data-mode-toggle]").evaluate(
    (el: HTMLElement) =>
      new Promise<Anim[]>((resolve) => {
        // Read through a loose type: tests may delete the API to simulate an older browser.
        const vt = typeof (document as { startViewTransition?: unknown }).startViewTransition === "function";
        const ready = () =>
          vt
            ? document.getAnimations().some((a) => (a.effect as KeyframeEffect).pseudoElement === "::view-transition-new(root)")
            : document.getAnimations().some((a) => a.playState === "running");
        const snapshot = (): Anim[] =>
          document
            .getAnimations()
            .filter((a) => !((a.effect as KeyframeEffect).target as Element | null)?.closest?.("[data-map]"))
            .map((a) => {
              const e = a.effect as KeyframeEffect;
              const t = e.getComputedTiming();
              const props = new Set(e.getKeyframes().flatMap((k) => Object.keys(k)).filter((k) => !["offset", "computedOffset", "easing", "composite"].includes(k)));
              return {
                name: (a as CSSAnimation).animationName ?? "",
                cls: (e.target as Element | null)?.getAttribute("class") ?? "",
                pseudo: e.pseudoElement,
                delay: Math.round(Number(t.delay)),
                duration: Math.round(Number(t.duration)),
                props: [...props],
              };
            });
        const tick = () => (ready() ? resolve(snapshot()) : requestAnimationFrame(tick));
        el.click();
        requestAnimationFrame(tick);
      }),
  );
}

test("16.1 opening: strip types in, chart line draws, bars shrink; every effect ends with the scene", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/vi/");
  const anims = await clickAndCapture(page);

  const banner = anims.filter((a) => a.name === "type-on");
  expect(banner.length).toBe(2); // top and bottom strips
  for (const b of banner) expect(b).toMatchObject({ delay: 265, duration: 95, props: ["clipPath"] });
  expect(banner.every((b) => b.cls.includes("only-giai-mat"))).toBe(true);

  expect(anims.filter((a) => a.name === "chart-draw")).toEqual([
    expect.objectContaining({ delay: 370, duration: 200, props: ["clipPath"] }),
  ]);
  expect(anims.find((a) => a.pseudo === "::view-transition-new(root)")?.duration).toBe(255);

  // No effect of the scene ends after it.
  for (const a of anims) expect(a.delay + a.duration, JSON.stringify(a)).toBeLessThanOrEqual(SCENE);
  for (const a of anims) expect(a.props.filter((p) => !["transform", "opacity", "clipPath", "clip-path"].includes(p))).toEqual([]);
});

test("16.1 closing: strip types the Mat level back, no chart line, ends with the scene", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("mode", "giai-mat"));
  await page.goto("/vi/");
  const anims = await clickAndCapture(page);
  const banner = anims.filter((a) => a.name === "type-on");
  expect(banner.length).toBe(2);
  expect(banner.every((b) => b.cls.includes("only-mat"))).toBe(true);
  expect(anims.some((a) => a.name === "chart-draw")).toBe(false);
  for (const a of anims) expect(a.delay + a.duration, JSON.stringify(a)).toBeLessThanOrEqual(SCENE);
});

test(`16.1 measured: the scene lasts ${SCENE} ms from the reveal (Playwright trace kept)`, async ({ page, context }) => {
  await context.tracing.start({ screenshots: true, snapshots: false });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/vi/");
  // Three moments: the click, the scene start (the reveal begins, data-scene appears), the end.
  const t = await page.evaluate(
    () =>
      new Promise<{ capture: number; scene: number; total: number }>((resolve) => {
        const root = document.documentElement;
        let t0 = 0;
        let start = 0;
        new MutationObserver(() => {
          if (!start && root.dataset["scene"]) start = performance.now();
          if (start && root.dataset["scene"] === undefined && root.dataset["vt"] === undefined) {
            const end = performance.now();
            resolve({ capture: start - t0, scene: end - start, total: end - t0 });
          }
        }).observe(root, { attributes: true, attributeFilter: ["data-scene", "data-vt"] });
        t0 = performance.now();
        (document.querySelector("[data-mode-toggle]") as HTMLElement).click();
      }),
  );
  await context.tracing.stop({ path: "test-results/p16-declassify-trace.zip" });
  const r = (n: number) => Math.round(n);
  test.info().annotations.push({ type: "scene", description: `capture ${r(t.capture)} ms + scene ${r(t.scene)} ms = ${r(t.total)} ms from the click` });
  expect(t.scene).toBeGreaterThan(SCENE - 50); // the scene really ran
  // Our part: the timeline, plus a frame or two of slack for the timer that ends it.
  expect(t.scene).toBeLessThanOrEqual(SCENE + 35);
  // From the click it also includes the browser's page capture, which grows when the machine is
  // busy (parallel test workers).
  expect(t.total).toBeLessThanOrEqual(t.scene + 200);
  // Nothing of the scene is still moving.
  expect(
    await page.evaluate(() => document.getAnimations().filter((a) => a.playState === "running" && !(a.effect as KeyframeEffect).target?.closest?.("[data-map]")).length),
  ).toBe(0);
});

test("16.2 without View Transitions: a 250 ms crossfade and the stamp only", async ({ page }) => {
  await page.addInitScript(() => {
    // @ts-expect-error simulate a browser without View Transitions
    delete Document.prototype.startViewTransition;
  });
  await page.goto("/vi/");
  const anims = await clickAndCapture(page);
  expect(anims.some((a) => ["type-on", "chart-draw", "bar-out", "fade-out"].includes(a.name))).toBe(false);
  for (const a of anims) expect(a.delay + a.duration).toBeLessThanOrEqual(250);
  await expect(page.locator("html")).toHaveAttribute("data-mode", "giai-mat");
  await expect(page.locator('[data-banner="top"] s')).toBeVisible();
});

test("16.2 reduced motion: the mode, strip and chart change at once", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/vi/");
  const state = await page.evaluate(() => {
    (document.querySelector("[data-mode-toggle]") as HTMLElement).click();
    return { mode: document.documentElement.dataset["mode"], scene: document.documentElement.dataset["scene"] ?? null, anims: document.getAnimations().length };
  });
  expect(state).toEqual({ mode: "giai-mat", scene: null, anims: 0 });
  await expect(page.locator('[data-banner="top"] s')).toBeVisible();
  await expect(page.locator(".chart__line")).toBeVisible();
});
