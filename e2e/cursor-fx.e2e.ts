import { expect, test, type Page } from "@playwright/test";

// P22: the JS cursor layer. Mat: a reticle ring that follows the mouse and locks onto targets.
// Giai mat: a selection frame that slides to the target, and a swept underline on ledger rows.
const setMode = (page: Page, mode: string) => page.addInitScript((m) => localStorage.setItem("mode", m), mode);
const centre = async (page: Page, sel: string) => {
  const b = (await page.locator(sel).first().boundingBox())!;
  return { x: b.x + b.width / 2, y: b.y + b.height / 2, b };
};

test.describe("22.4 not allowed, not loaded", () => {
  for (const [name, setup] of [
    ["reduced motion", (p: Page) => p.emulateMedia({ reducedMotion: "reduce" })],
    ["system cursors chosen", (p: Page) => p.addInitScript(() => localStorage.setItem("cursorFx", "system"))],
  ] as const) {
    test(`${name}: no layer in the DOM and its code never fetched`, async ({ page }) => {
      const fetched: string[] = [];
      page.on("request", (r) => r.url().includes("cursor-fx") && fetched.push(r.url()));
      await setup(page);
      await page.goto("/vi/");
      await page.mouse.move(400, 400);
      await page.mouse.move(500, 450);
      await page.waitForTimeout(300);
      await expect(page.locator("[data-cfx]")).toHaveCount(0);
      expect(fetched).toEqual([]);
    });
  }

  test.describe("touch device", () => {
    test.use({ hasTouch: true, isMobile: true, viewport: { width: 375, height: 812 } });
    test("no layer, no code", async ({ page }) => {
      const fetched: string[] = [];
      page.on("request", (r) => r.url().includes("cursor-fx") && fetched.push(r.url()));
      await page.goto("/vi/");
      await page.tap("[data-mode-toggle]");
      await page.waitForTimeout(300);
      await expect(page.locator("[data-cfx]")).toHaveCount(0);
      expect(fetched).toEqual([]);
    });
  });
});

test("22.1 Mat: the ring follows the mouse, then locks onto a target (1.4x, 45 deg, transform only)", async ({ page }) => {
  await setMode(page, "mat");
  await page.goto("/vi/");
  const layer = page.locator("[data-cfx]");
  await expect(layer).toHaveCount(1);
  await expect(layer).toHaveAttribute("aria-hidden", "true");
  expect(await layer.evaluate((e) => getComputedStyle(e).pointerEvents)).toBe("none");

  await page.mouse.move(300, 300);
  await page.mouse.move(420, 360, { steps: 5 });
  await expect(layer).toHaveClass(/is-on/);
  // Catches up with the mouse (lerp), its centre on the hotspot.
  await expect
    .poll(async () => {
      const r = (await page.locator("[data-cfx-ring]").boundingBox())!;
      return Math.round(Math.abs(r.x + r.width / 2 - 420) + Math.abs(r.y + r.height / 2 - 360));
    })
    .toBeLessThanOrEqual(2);

  const toggle = await centre(page, "[data-mode-toggle]");
  await page.mouse.move(toggle.x, toggle.y, { steps: 4 });
  const lock = page.locator("[data-cfx-lock]");
  await expect(lock).toHaveClass(/is-locked/);
  await page.waitForTimeout(250); // 180 ms transition
  const m = await lock.evaluate((e) => new DOMMatrix(getComputedStyle(e).transform));
  expect(m.a).toBeCloseTo(1.4 * Math.cos(Math.PI / 4), 2); // scale 1.4, rotate 45 deg
  expect(m.b).toBeCloseTo(1.4 * Math.sin(Math.PI / 4), 2);
  const t = await lock.evaluate((e) => getComputedStyle(e).transitionProperty);
  expect(t).toBe("transform");
  // The four sight lines live in the lock, so they turn with it: locked, they run diagonally.
  const hairs = lock.locator(".cfx__hair");
  await expect(hairs).toHaveCount(4);
  // Same dash as the map crosshair (6 on, 4 off), a little softer so text stays readable under it.
  await expect(hairs.first()).toHaveCSS("opacity", "0.75");
  expect(await hairs.first().evaluate((e) => getComputedStyle(e).backgroundImage)).toContain("6px, rgba(0, 0, 0, 0) 6px, rgba(0, 0, 0, 0) 10px");
  const right = (await lock.locator(".cfx__hair--r").boundingBox())!;
  expect(right.height).toBeGreaterThan(200); // a horizontal line turned 45 deg spans height too
  expect(right.width).toBeGreaterThan(200);

  // The lock is acquired: four corners close in on the target, then blink twice to confirm.
  const frame = page.locator("[data-cfx-frame]");
  await expect(frame).toHaveClass(/is-confirm/);
  const tl = (await frame.locator('[data-c="tl"]').boundingBox())!;
  const br = (await frame.locator('[data-c="br"]').boundingBox())!;
  expect(Math.abs(tl.x - (toggle.b.x - 4))).toBeLessThanOrEqual(1.5);
  expect(Math.abs(br.y + br.height - (toggle.b.y + toggle.b.height + 4))).toBeLessThanOrEqual(1.5);
  const blink = await frame.locator('[data-c="tl"]').evaluate((e) => {
    const s = getComputedStyle(e);
    return [s.animationName, s.animationDuration, s.animationDelay];
  });
  expect(blink).toEqual(["cfx-confirm", "0.2s", "0.2s"]); // 200 ms after the 180 ms close-in: 400 ms in all

  await page.mouse.move(300, 300, { steps: 4 });
  await expect(lock).not.toHaveClass(/is-locked/);
  await expect(frame).not.toHaveClass(/is-on/);
  await page.waitForTimeout(250);
  // Unlocked: straight sight lines, horizontal reaching the left edge, vertical the top.
  const left = (await lock.locator(".cfx__hair--l").boundingBox())!;
  expect(left.height).toBeLessThanOrEqual(1.5);
  expect(left.x).toBeLessThan(0);
  const up = (await lock.locator(".cfx__hair--u").boundingBox())!;
  expect(up.width).toBeLessThanOrEqual(1.5);
  expect(up.y).toBeLessThan(0);
});

for (const [mode, start, what] of [["mat", -28, "start wide and close in on"], ["giai-mat", 14, "start inside and open out around"]] as const) {
test(`22.1 ${mode}: the corners ${what} the new target (transform only)`, async ({ page }) => {
  await setMode(page, mode);
  await page.goto("/vi/");
  await page.mouse.move(300, 300);
  await page.mouse.move(320, 310, { steps: 3 });
  await expect(page.locator("[data-cfx]")).toHaveClass(/is-on/);
  // Enter the target (from elsewhere: an aimed move) and read the corner's transition as soon as it
  // starts (two frames later, see acquire()), in the page, so nothing finishes first.
  const r = await page.locator("[data-mode-toggle]").evaluate(async (t) => {
    t.dispatchEvent(new PointerEvent("pointerover", { pointerType: "mouse", bubbles: true, clientX: 5, clientY: 5 }));
    for (let i = 0; i < 2; i++) await new Promise(requestAnimationFrame);
    const corner = document.querySelector('[data-cfx-frame] [data-c="tl"]')!;
    const move = corner.getAnimations().find((a) => (a as CSSTransition).transitionProperty === "transform")!;
    const [from, to] = (move.effect as KeyframeEffect).getKeyframes().map((k) => new DOMMatrix(String(k["transform"])).e);
    return { from, to, left: t.getBoundingClientRect().left, duration: Number(move.effect!.getComputedTiming().duration) };
  });
  expect(r.from).toBeCloseTo(r.left - 4 + start, 0); // Mat: wide start; Giai mat: inside
  expect(r.to).toBeCloseTo(r.left - 4, 0); // framing the target
  expect(r.duration).toBe(180);
});
}

test("22.2 Giai mat: no ring; the frame opens out around the row under the mouse (no blink); the row's underline sweeps", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await setMode(page, "giai-mat");
  await page.goto("/vi/");
  await page.locator("[data-ledger]").evaluate((e) => e.scrollIntoView({ block: "center" }));
  await page.mouse.move(10, 10);
  await expect(page.locator("[data-cfx-ring]")).toBeHidden();

  const head = page.locator("[data-claim] .row__head").nth(1);
  const target = page.locator("[data-claim] [data-row-toggle]").nth(1);
  const t = await centre(page, "[data-claim] [data-row-toggle] >> nth=1");
  await page.mouse.move(t.x, t.y, { steps: 4 });
  await expect(page.locator("[data-cfx-frame]")).toHaveClass(/is-on/);
  await page.waitForTimeout(260);
  const box = (await target.boundingBox())!;
  const tl = (await page.locator('[data-cfx-frame] [data-c="tl"]').boundingBox())!;
  const br = (await page.locator('[data-cfx-frame] [data-c="br"]').boundingBox())!;
  expect(Math.abs(tl.x - (box.x - 4))).toBeLessThanOrEqual(1.5);
  expect(Math.abs(tl.y - (box.y - 4))).toBeLessThanOrEqual(1.5);
  expect(Math.abs(br.x + br.width - (box.x + box.width + 4))).toBeLessThanOrEqual(1.5);
  expect(Math.abs(br.y + br.height - (box.y + box.height + 4))).toBeLessThanOrEqual(1.5);
  await expect(page.locator("[data-cfx-frame]")).not.toHaveClass(/is-confirm/);
  // Moves by transform only.
  expect(await page.locator('[data-cfx-frame] [data-c="tl"]').evaluate((e) => getComputedStyle(e).transitionProperty)).toBe("transform, opacity");

  const sweep = () => head.evaluate((e) => getComputedStyle(e, "::after").clipPath);
  await expect.poll(sweep).toBe("inset(0px)");
  await page.screenshot({ path: "test-results/screenshots/p22-frame-giai-mat.png", clip: { x: 0, y: Math.max(0, box.y - 120), width: 1280, height: 320 } });
});

test("22.3 the loop stops when the mouse rests, and the layer hides on keyboard navigation", async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __raf: number };
    w.__raf = 0;
    const orig = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb) => {
      w.__raf++;
      return orig(cb);
    };
  });
  await setMode(page, "mat");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/vi/");
  await page.waitForTimeout(1500); // page settles (map, chart idle)
  await page.mouse.move(300, 300);
  await page.mouse.move(600, 420, { steps: 6 });
  await page.waitForTimeout(900); // > 600 ms at rest, ring settled
  const a = await page.evaluate(() => (window as unknown as { __raf: number }).__raf);
  await page.waitForTimeout(500);
  const b = await page.evaluate(() => (window as unknown as { __raf: number }).__raf);
  expect(b - a).toBe(0); // no frame requested while resting

  await page.keyboard.press("Tab");
  await expect(page.locator("[data-cfx]")).not.toHaveClass(/is-on/);
  await page.mouse.move(610, 430);
  await expect(page.locator("[data-cfx]")).toHaveClass(/is-on/);
});

test("22.3 will-change only on the moving parts", async ({ page }) => {
  await page.goto("/vi/");
  await page.mouse.move(300, 300);
  const outside = await page.evaluate(() =>
    [...document.querySelectorAll("body *")]
      .filter((e) => getComputedStyle(e).willChange.includes("transform") && !e.closest("[data-cfx]"))
      .map((e) => e.outerHTML.slice(0, 80)),
  );
  expect(outside).toEqual([]);
  expect(await page.locator("[data-cfx] .cfx__ring").evaluate((e) => getComputedStyle(e).willChange)).toBe("transform");
});
