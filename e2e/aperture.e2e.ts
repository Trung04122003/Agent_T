import { expect, test, type Page } from "@playwright/test";

// P26: into the file from the entry gate. Aperture (View Transition) on wide screens, a fade on
// narrow ones or without View Transitions, instant with reduced motion; never stuck, never on top
// of Declassify. Like e2e/entry.e2e.ts, this meets the gate as a first-time reader.
const gateOf = (page: Page) => page.locator("[data-entry]");
const entered = (page: Page, timeout = 4000) =>
  page.waitForFunction(() => performance.getEntriesByName("gate:entered").length > 0, null, { timeout });
/** When the last press happened: the lens click, or the Enter that skips the opening after it. */
const clickClock = (page: Page) =>
  page.addInitScript(() => {
    const at = () => ((window as unknown as { __clickAt: number }).__clickAt = performance.now());
    addEventListener("pointerdown", at, { capture: true });
    addEventListener("keydown", at, { capture: true });
  });
const closedAfter = (page: Page) =>
  page.evaluate(() => performance.getEntriesByName("gate:entered")[0]!.startTime - (window as unknown as { __clickAt: number }).__clickAt);
/**
 * A chosen lens first plays the "special-ops" opening (owner, 2026-11-01; e2e/entry.e2e.ts tests it).
 * These tests are about what follows: its Skip button has the focus, so Enter goes on at once, and
 * the aperture still starts where the lens was clicked.
 */
const skipOpening = (page: Page) => page.keyboard.press("Enter");
/** The gate's opening is over (lenses in), so a click lands on a settled screen. */
const settled = (page: Page) => page.waitForFunction(() => performance.getEntriesByName("gate:lenses-in").length > 0);
/** The aperture's animation, once the View Transition is ready (a frame or two after the click). */
const aperture = async (page: Page) =>
  (
    await page.waitForFunction(() => {
      const a = document.getAnimations().find((x) => (x.effect as KeyframeEffect).pseudoElement === "::view-transition-new(root)");
      if (!a) return null;
      const k = (a.effect as KeyframeEffect).getKeyframes();
      return { duration: Number(a.effect!.getComputedTiming().duration), from: String(k[0]!["clipPath"]), vt: document.documentElement.dataset["vt"] };
    })
  ).jsonValue();

test.describe("P26 aperture (wide screen)", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("26.1 the new state opens as a circle from the click, 520 ms; on screen it takes <= 700 ms", async ({ page }) => {
    await clickClock(page);
    await page.goto("/vi/");
    await settled(page);
    const box = (await gateOf(page).locator('[data-entry-lens="client"]').boundingBox())!;
    const at = { x: Math.round(box.x + 30), y: Math.round(box.y + 20) };
    await page.mouse.click(at.x, at.y);
    await skipOpening(page);
    const vt = await aperture(page);
    expect(vt).not.toBeNull();
    expect(vt!.vt).toBe("gate");
    expect(vt!.duration).toBe(520);
    expect(vt!.from).toContain(`at ${at.x}px ${at.y}px`);
    await entered(page);
    // On screen: from the moment the aperture starts (the browser has captured the page) to the
    // gate gone. Before that, the capture itself takes ~100 ms on an idle machine and much more on
    // a busy one (measured by tools/perf/gate-inp.mjs, docs/perf-log.md), so the total from the
    // press is only held to the guard here.
    const onScreen = await page.evaluate(
      () => performance.getEntriesByName("gate:entered")[0]!.startTime - performance.getEntriesByName("gate:aperture-ready")[0]!.startTime,
    );
    const total = await closedAfter(page);
    test.info().annotations.push({ type: "timing", description: `on screen ${Math.round(onScreen)} ms, from the press ${Math.round(total)} ms` });
    expect(onScreen).toBeLessThanOrEqual(700);
    expect(total).toBeLessThanOrEqual(1200);
    await expect(gateOf(page)).toBeHidden();
    await expect(page.locator("#gate-codename")).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.dataset["vt"] ?? null)).toBeNull();
  });

  test("26.1 from the keyboard the aperture starts at the button's centre", async ({ page }) => {
    await page.goto("/vi/");
    await settled(page);
    const box = (await gateOf(page).locator('[data-entry-lens="partner"]').boundingBox())!;
    await page.keyboard.press("Enter"); // focus starts on the first lens
    await skipOpening(page);
    const { from } = (await aperture(page))!;
    const [x, y] = from.match(/at ([\d.]+)px ([\d.]+)px/)!.slice(1).map(Number);
    expect(Math.abs(x! - (box.x + box.width / 2))).toBeLessThanOrEqual(1);
    expect(Math.abs(y! - (box.y + box.height / 2))).toBeLessThanOrEqual(1);
    await entered(page);
  });

  test("26.4 the lens is in place before the new state is captured: the ledger does not move after", async ({ page }) => {
    await page.goto("/vi/");
    await settled(page);
    await page.evaluate(() => {
      const w = window as unknown as { __rowMoves: number };
      w.__rowMoves = 0;
      const tick = () => {
        w.__rowMoves += document.getAnimations().filter((a) => ((a.effect as KeyframeEffect).target as Element | null)?.hasAttribute?.("data-claim")).length;
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    await gateOf(page).locator('[data-entry-lens="client"]').click();
    await entered(page);
    await page.waitForTimeout(400);
    expect(await page.evaluate(() => (window as unknown as { __rowMoves: number }).__rowMoves)).toBe(0);
    await expect(page.locator('[data-lens="client"]')).toHaveAttribute("aria-pressed", "true");
  });

  test("26.4 no Declassify on top of the aperture: the mode cannot change until it ends", async ({ page }) => {
    await page.goto("/vi/");
    await settled(page);
    await gateOf(page).locator('[data-entry-lens="partner"]').click();
    await skipOpening(page);
    // A scripted click (a real one cannot reach the inert page) while the aperture runs.
    const during = await page.evaluate(() => {
      (document.querySelector("[data-mode-toggle]") as HTMLElement).click();
      return { vt: document.documentElement.dataset["vt"], mode: document.documentElement.dataset["mode"] };
    });
    expect(during).toEqual({ vt: "gate", mode: "mat" });
    await expect(page.locator("header.controls")).toHaveAttribute("inert", "");
    await entered(page);
    await expect(page.locator("html")).toHaveAttribute("data-mode", "mat");
    await expect(page.locator("header.controls")).not.toHaveAttribute("inert", /.*/);
    await page.locator("[data-mode-toggle]").click(); // and afterwards it works
    await expect(page.locator("html")).toHaveAttribute("data-mode", "giai-mat");
  });

  test("26.4 a second choice while it closes is ignored", async ({ page }) => {
    await page.goto("/vi/");
    await settled(page);
    await gateOf(page).locator('[data-entry-lens="client"]').evaluate((b) => {
      (b as HTMLElement).click();
      (document.querySelector('[data-entry-lens="curious"]') as HTMLElement).click();
    });
    await entered(page);
    expect(new URL(page.url()).searchParams.get("lens")).toBe("client");
    const log = await page.evaluate(() => JSON.parse(localStorage.getItem("gateMetrics") ?? "[]") as { type: string }[]);
    expect(log.filter((e) => e.type === "enter")).toHaveLength(1);
  });

  for (const how of ["never settles", "fails"] as const) {
    test(`26.3 a transition that ${how}: the gate is forced closed and focus returns`, async ({ page }) => {
      await page.addInitScript((mode) => {
        (document as unknown as { startViewTransition: unknown }).startViewTransition = (update: () => void) => {
          update();
          const never = new Promise(() => {});
          const broken = Promise.reject(new Error("simulated"));
          broken.catch(() => {});
          return { ready: never, updateCallbackDone: Promise.resolve(), finished: mode === "fails" ? broken : never, skipTransition() {} };
        };
      }, how);
      await clickClock(page);
      await page.goto("/vi/");
      await settled(page);
      await gateOf(page).locator('[data-entry-lens="client"]').click();
      await skipOpening(page);
      await entered(page);
      expect(await closedAfter(page)).toBeLessThanOrEqual(1300); // the 1200 ms guard at most
      await expect(gateOf(page)).toBeHidden();
      await expect(page.locator("#gate-codename")).toBeFocused();
      await expect(page.locator("main")).not.toHaveAttribute("inert", /.*/);
    });
  }

  test("26.3 startViewTransition throwing: closed at once", async ({ page }) => {
    await page.addInitScript(() => {
      (document as unknown as { startViewTransition: unknown }).startViewTransition = () => {
        throw new Error("simulated");
      };
    });
    await page.goto("/vi/");
    await settled(page);
    await gateOf(page).locator('[data-entry-lens="client"]').click();
    await skipOpening(page);
    await entered(page, 1000);
    await expect(page.locator("#gate-codename")).toBeFocused();
  });
});

test.describe("26.2 fallbacks", () => {
  test("without View Transitions: the gate fades out in 250 ms", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.addInitScript(() => delete (Document.prototype as unknown as { startViewTransition?: unknown }).startViewTransition);
    await page.goto("/vi/");
    await settled(page);
    await gateOf(page).locator('[data-entry-lens="client"]').click();
    await skipOpening(page);
    const fade = await gateOf(page).evaluate((g) =>
      g.getAnimations().map((a) => ({ d: Number(a.effect!.getComputedTiming().duration), opacity: "opacity" in (a.effect as KeyframeEffect).getKeyframes()[0]! })),
    );
    expect(fade).toEqual([{ d: 250, opacity: true }]);
    expect(await page.evaluate(() => document.documentElement.dataset["vt"] ?? null)).toBeNull();
    await entered(page);
    await expect(gateOf(page)).toBeHidden();
    await expect(page.locator("#gate-codename")).toBeFocused();
  });

  test.describe("narrow screen", () => {
    test.use({ viewport: { width: 375, height: 812 } });
    test("< 768 px: the fade, not the aperture", async ({ page }) => {
      await page.goto("/vi/");
      await settled(page);
      await gateOf(page).locator('[data-entry-lens="curious"]').click();
      await skipOpening(page);
      const state = await page.evaluate(() => ({
        vt: document.documentElement.dataset["vt"] ?? null,
        fades: document.querySelector("[data-entry]")!.getAnimations().length,
      }));
      expect(state).toEqual({ vt: null, fades: 1 });
      await entered(page);
      await expect(gateOf(page)).toBeHidden();
    });
  });

  test("reduced motion: closed at once", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/vi/");
    const after = await gateOf(page).locator('[data-entry-lens="partner"]').evaluate((b) => {
      (b as HTMLElement).click();
      return { gate: document.documentElement.dataset["gate"], animations: document.getAnimations().length, focused: document.activeElement?.id };
    });
    expect(after).toEqual({ gate: "skip", animations: 0, focused: "gate-codename" });
  });
});

for (const [name, viewport] of [
  ["wide (aperture)", { width: 1280, height: 800 }],
  ["narrow (fade)", { width: 375, height: 812 }],
] as const) {
  test(`26.5 INP of entering <= 200 ms: ${name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.addInitScript(() => {
      const w = window as unknown as { __inp: number };
      w.__inp = 0;
      new PerformanceObserver((list) => {
        for (const e of list.getEntries() as PerformanceEventTiming[]) if (e.interactionId) w.__inp = Math.max(w.__inp, e.duration);
      }).observe({ type: "event", durationThreshold: 16, buffered: true } as PerformanceObserverInit);
    });
    await page.goto("/vi/");
    await settled(page);
    await gateOf(page).locator('[data-entry-lens="client"]').click();
    await entered(page);
    await page.waitForTimeout(300);
    const inp = await page.evaluate(() => (window as unknown as { __inp: number }).__inp);
    test.info().annotations.push({ type: "INP", description: `${Math.round(inp)} ms` });
    expect(inp).toBeLessThanOrEqual(200);
  });
}
