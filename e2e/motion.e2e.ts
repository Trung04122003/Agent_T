import { expect, test, type Page } from "@playwright/test";
import { DEV, FIXTURE } from "../playwright.config";
import { gotoStable } from "./helpers";

// ROADMAP P4: mode-change motion. Timings from UX section 3.
type Anim = { pseudo: string | null; cls: string; duration: number; delay: number; props: string[] };

/** Count startViewTransition calls; optionally remove the API to test the fallback. */
async function instrument(page: Page, removeViewTransitions = false) {
  await page.addInitScript((remove) => {
    const w = window as unknown as { __vt: number };
    w.__vt = 0;
    const original = Document.prototype.startViewTransition;
    if (remove) {
      // @ts-expect-error simulate a browser without View Transitions
      delete Document.prototype.startViewTransition;
      return;
    }
    Document.prototype.startViewTransition = function (this: Document, arg: never) {
      w.__vt++;
      return original.call(this, arg);
    };
  }, removeViewTransitions);
}

/** Click (from JS, so the page does not scroll), then snapshot every running animation. */
async function clickAndCapture(page: Page, selector: string): Promise<Anim[]> {
  await page.locator(selector).evaluate((el: HTMLElement) => el.click());
  await page.waitForFunction(() => document.getAnimations().some((a) => a.playState === "running"));
  // The scene attribute is set inside the transition callback, but the pseudo-element animations
  // only start a frame later: wait for the reveal itself (or for the fallback, which has none).
  await page.waitForFunction(
    () =>
      !document.startViewTransition ||
      document.getAnimations().some((a) => (a.effect as KeyframeEffect).pseudoElement === "::view-transition-new(root)"),
  );
  return page.evaluate(() =>
    // Mode-change layer only: the map's own draw-in (UX section 3, map row) is tested in map-motion.
    document
      .getAnimations()
      .filter((a) => !((a.effect as KeyframeEffect).target as Element | null)?.closest?.("[data-map]"))
      .map((a) => {
        const effect = a.effect as KeyframeEffect;
        const timing = effect.getComputedTiming();
        const props = new Set<string>();
        for (const k of effect.getKeyframes()) {
          for (const p of Object.keys(k)) if (!["offset", "computedOffset", "easing", "composite"].includes(p)) props.add(p);
        }
        const target = effect.target as Element | null;
        return {
          pseudo: effect.pseudoElement,
          cls: target?.getAttribute("class") ?? "",
          duration: Number(timing.duration),
          delay: Number(timing.delay),
          props: [...props],
        };
      }),
  );
}

const ALLOWED = new Set(["transform", "opacity", "clipPath", "clip-path"]);

/** Fixture page, all five summary rows open and scrolled into view: more than 8 bars on screen. */
async function openFixture(page: Page) {
  await page.setViewportSize({ width: 1280, height: 1400 });
  await page.goto(`${FIXTURE}/vi/`);
  for (const id of ["fx-verified", "fx-pending", "fx-extra-1", "fx-extra-2", "fx-extra-3"]) {
    await page.locator(`#claim-${id} [data-row-toggle]`).evaluate((el: HTMLElement) => el.click());
  }
  await page.waitForTimeout(400); // row open transition (250 ms) settles
  await page.locator("#ledger-heading").evaluate((el) => el.scrollIntoView({ block: "start" }));
}

/** Bars that are in the viewport right now (what declassify.ts may animate). */
function barsOnScreen(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      [...document.querySelectorAll(".row__redacted .redaction__bars rect, .gate__legal .redact")].filter((e) => {
        const r = e.getBoundingClientRect();
        return r.width > 0 && r.bottom > 0 && r.top < innerHeight;
      }).length,
  );
}

test("4.1 reduced motion: mode changes at once, no transition, no animation", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await instrument(page);
  await page.goto(`${FIXTURE}/vi/`);
  const result = await page.evaluate(() => {
    (document.querySelector("[data-mode-toggle]") as HTMLElement).click();
    return { mode: document.documentElement.dataset["mode"], running: document.getAnimations().length };
  });
  expect(result).toEqual({ mode: "giai-mat", running: 0 });
  expect(await page.evaluate(() => (window as unknown as { __vt: number }).__vt)).toBe(0);
});

test("4.1 without View Transitions: 250 ms crossfade, no errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await instrument(page, true);
  await page.goto(`${FIXTURE}/vi/`);
  const anims = await clickAndCapture(page, "[data-mode-toggle]");
  const fade = anims.filter((a) => a.props.includes("opacity") && a.cls === "");
  expect(fade.map((a) => a.duration)).toEqual([125]);
  await expect(page.locator("html")).toHaveAttribute("data-mode", "giai-mat");
  await expect(page.locator("[data-mode-live]")).toHaveText("Chế độ Giải mật");
  expect(errors).toEqual([]);
});

test("4.1-4.2 Declassify: circle reveal 500 ms, at most 8 bars, 30 ms stagger, all within the scene", async ({ page }) => {
  await instrument(page);
  await openFixture(page);
  expect(await barsOnScreen(page)).toBeGreaterThan(8); // so the cap is exercised

  const anims = await clickAndCapture(page, "[data-mode-toggle]");
  expect(await page.evaluate(() => (window as unknown as { __vt: number }).__vt)).toBe(1);

  const reveal = anims.find((a) => a.pseudo === "::view-transition-new(root)");
  expect(reveal?.duration).toBe(500);
  expect(reveal?.props).toEqual(["clipPath"]);

  const bars = anims.filter((a) => a.cls.includes("bar-anim"));
  expect(bars.length).toBe(8);
  expect(bars.map((b) => b.delay).sort((a, b) => a - b)).toEqual([0, 30, 60, 90, 120, 150, 180, 210]);
  for (const b of bars) {
    expect(b.duration).toBe(260);
    expect(b.delay + b.duration).toBeLessThanOrEqual(500);
  }

  const stamp = anims.find((a) => a.cls.includes("mode-toggle"));
  expect(stamp?.duration).toBe(220);

  for (const a of anims) expect(a.props.filter((p) => !ALLOWED.has(p)), JSON.stringify(a)).toEqual([]);

  await expect(page.locator("html")).not.toHaveAttribute("data-scene", /.+/);
  await expect(page.locator("#claim-fx-pending .row__summary")).toBeVisible();
  await expect(page.locator(".bar-anim")).toHaveCount(0);
});

test("4.2 closing the file: 350 ms reveal, bars cover again faster (20 ms stagger)", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("mode", "giai-mat"));
  await instrument(page);
  await openFixture(page);
  const anims = await clickAndCapture(page, "[data-mode-toggle]");
  expect(anims.find((a) => a.pseudo === "::view-transition-new(root)")?.duration).toBe(350);
  const bars = anims.filter((a) => a.cls.includes("bar-anim"));
  expect(bars.length).toBe(8);
  expect(Math.max(...bars.map((b) => b.delay))).toBe(140);
  for (const b of bars) {
    expect(b.duration).toBe(200);
    expect(b.delay + b.duration).toBeLessThanOrEqual(350);
  }
  await expect(page.locator("html")).toHaveAttribute("data-mode", "mat");
});

test("4.1 focus stays put and the change is announced", async ({ page }) => {
  await page.goto(`${FIXTURE}/vi/`);
  await page.locator("[data-mode-toggle]").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("[data-mode-live]")).toHaveText("Chế độ Giải mật");
  await expect(page.locator("[data-mode-toggle]")).toBeFocused();
});

test("4.3 portrait crossfades in 300 ms (screenshots before and after)", async ({ page }) => {
  await instrument(page);
  await gotoStable(page, `${DEV}/dev/portrait`);
  await page.screenshot({ path: "test-results/screenshots/motion-portrait-before.png" });
  const anims = await clickAndCapture(page, "[data-mode-toggle]");
  const fade = anims.find((a) => a.cls.includes("portrait__pic--mat"));
  expect(fade?.duration).toBe(300);
  expect(fade?.props).toEqual(["opacity"]);
  await expect(page.locator("html")).not.toHaveAttribute("data-scene", /.+/);
  await page.screenshot({ path: "test-results/screenshots/motion-portrait-after.png" });
});

test("4.3 toggle stamp flips around X (screenshots before and after)", async ({ page }) => {
  await page.goto(`${FIXTURE}/vi/`);
  const toggle = page.locator("[data-mode-toggle]");
  await toggle.screenshot({ path: "test-results/screenshots/motion-stamp-before.png" });
  const anims = await clickAndCapture(page, "[data-mode-toggle]");
  const stamp = anims.find((a) => a.cls.includes("mode-toggle"));
  expect(stamp?.props).toEqual(["transform"]);
  expect(stamp?.duration).toBe(220);
  await page.waitForTimeout(600);
  await toggle.screenshot({ path: "test-results/screenshots/motion-stamp-after.png" });
});
