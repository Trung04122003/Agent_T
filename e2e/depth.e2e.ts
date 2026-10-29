import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { FIXTURE } from "../playwright.config";
import { expect, test, type Page } from "./test";

// P28: Mat reveals less (night vision, stirring bars, grain); Giai mat shows more that is real
// (experience balance, source line, file sheet and seal, previews of documents).
const ui = JSON.parse(readFileSync("content/ui.json", "utf8"));
const setMode = (page: Page, mode: string) => page.addInitScript((m) => localStorage.setItem("mode", m), mode);

test.describe("28.1 night vision (Mat)", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("a scaled tile follows the ring in the same frame; 12% dim; Giai mat and the Aa switch turn it off", async ({ page }) => {
    await setMode(page, "mat");
    await page.goto("/vi/");
    await page.mouse.move(300, 300);
    await page.mouse.move(640, 400, { steps: 5 });
    const night = page.locator("[data-cfx-night]");
    await expect(night).toHaveCount(1);
    await page.waitForTimeout(400); // settled
    const state = await page.evaluate(() => {
      const n = document.querySelector<HTMLElement>("[data-cfx-night]")!;
      const ring = document.querySelector<HTMLElement>("[data-cfx-ring]")!;
      const m = new DOMMatrix(getComputedStyle(n).transform);
      const r = new DOMMatrix(getComputedStyle(ring).transform);
      return { scale: m.a, x: m.e, y: m.f, rx: r.e, ry: r.f, bg: getComputedStyle(n).backgroundImage, w: n.offsetWidth };
    });
    expect(state.w).toBe(512); // a small tile, scaled by the GPU
    expect(state.scale).toBeGreaterThan(1);
    expect(Math.abs(state.x - state.rx)).toBeLessThan(1); // same position as the ring, same frame
    expect(Math.abs(state.y - state.ry)).toBeLessThan(1);
    expect(state.bg).toContain("radial-gradient");
    await expect(night).toBeVisible();

    // Off from the Aa panel, and remembered.
    await page.locator("[data-reading-toggle]").click();
    await page.locator("[data-reading-night]").uncheck();
    await expect(page.locator("html")).toHaveAttribute("data-night", "off");
    await expect(night).toBeHidden();
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-night", "off");
    await page.locator("[data-reading-toggle]").click();
    await page.locator("[data-reading-night]").check();
    await expect(page.locator("html")).not.toHaveAttribute("data-night", /.*/);

    // Giai mat: none.
    await page.keyboard.press("Escape");
    await page.locator("[data-mode-toggle]").click();
    await expect(page.locator("html")).toHaveAttribute("data-mode", "giai-mat");
    await expect(night).toBeHidden();
  });
});

test("28.2 Mat bars stir with block characters for 200 ms, never real text; not in Giai mat", async ({ page }) => {
  await setMode(page, "mat");
  const res = await page.goto("/vi/");
  expect(await res!.text()).not.toMatch(/[▓▒░]/); // nothing of it in the page source
  const bar = page.locator(".gate__legal .redact");
  // force: the mouse still really moves there (pointerover fires); what is under test is the stir,
  // not Playwright's actionability wait, which timed out once on a busy machine.
  await bar.hover({ force: true });
  const cover = bar.locator(".stir");
  await expect(cover).toHaveCount(1);
  const text = (await cover.textContent()) ?? "";
  expect(text.length).toBeGreaterThan(0);
  expect(text.replace(/[▓▒░\n]/g, "")).toBe("");
  await expect(cover).toHaveAttribute("aria-hidden", "true");
  await expect(cover).toHaveCount(0, { timeout: 1000 }); // gone after the stir
  // A ledger redaction stirs over its bars only, its category label stays readable.
  const red = page.locator("[data-kind=\"classified\"] .row__head .redaction").first(); // always on screen
  await red.scrollIntoViewIfNeeded();
  await red.locator("svg").hover({ force: true });
  const ledgerCover = red.locator(".stir");
  await expect(ledgerCover).toHaveCount(1);
  const [svgBox, coverBox] = [await red.locator("svg").boundingBox(), await ledgerCover.boundingBox()];
  expect(Math.abs(coverBox!.height - svgBox!.height)).toBeLessThanOrEqual(1);

  await page.locator("[data-mode-toggle]").click();
  await expect(page.locator("html")).toHaveAttribute("data-mode", "giai-mat");
  await page.waitForTimeout(900);
  await page.locator("#gate-codename").hover();
  await page.locator("[data-claim] .redaction").first().hover({ force: true }).catch(() => {});
  await expect(page.locator(".stir")).toHaveCount(0);
});

test("28.2 reduced motion: no stir", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await setMode(page, "mat");
  await page.goto("/vi/");
  await page.locator(".gate__legal .redact").hover();
  await page.waitForTimeout(100);
  await expect(page.locator(".stir")).toHaveCount(0);
});

test("28.3 Mat grain: a still tile under 8 KB at 3% (baked into its alpha), a background layer; none in Giai mat", async ({ page }) => {
  const png = readFileSync("public/noise.png");
  expect(png.length).toBeLessThanOrEqual(8 * 1024);
  expect(png[25]).toBe(4); // colour type: grey + alpha
  const idat = png.indexOf("IDAT");
  const raw = inflateSync(png.subarray(idat + 4, idat + 4 + png.readUInt32BE(idat - 4)));
  const alphas = new Set<number>();
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) alphas.add(raw[y * 129 + 2 + x * 2]!);
  expect([...alphas]).toEqual([8]); // 8/255, about 3%
  await setMode(page, "mat");
  await page.goto("/vi/");
  const bodyBg = () => page.evaluate(() => getComputedStyle(document.body).backgroundImage);
  expect(await bodyBg()).toContain("noise.png");
  expect(await page.evaluate(() => document.getAnimations().filter((a) => (a.effect as KeyframeEffect).target === document.body).length)).toBe(0);
  await page.locator("[data-mode-toggle]").click();
  await expect(page.locator("html")).toHaveAttribute("data-mode", "giai-mat");
  expect(await bodyBg()).not.toContain("noise.png");
});

test("28.4 / 28.6 Giai mat: running balance, the note on how it is counted, a source line per entry", async ({ page }) => {
  await setMode(page, "giai-mat");
  await page.goto("/vi/");
  await expect(page.locator("[data-balance-note]")).toHaveText(ui.balanceNote.vi);
  const balances = await page.locator("[data-balance]").evaluateAll((els) => els.map((e) => Number(e.getAttribute("data-balance"))));
  expect(balances.length).toBeGreaterThan(0);
  for (const b of balances) expect(b).toBeGreaterThan(0);
  // The balance never exceeds the months from the first start to now.
  const rows = page.locator('[data-claim]:not([data-kind="classified"])');
  for (const row of await rows.all()) {
    const tier = (await row.locator(".row__tier").getAttribute("data-tier"))!;
    const source = row.locator("[data-source]");
    await expect(source).toBeVisible();
    await expect(source).toContainText(`${ui.sourceLabel.vi} · ${tier}:`);
    if (tier === "T1") await expect(source).toContainText(ui.sourceSelf.vi);
  }
  // Mat: neither the balance nor the source line.
  await page.locator("[data-mode-toggle]").click();
  await expect(page.locator("html")).toHaveAttribute("data-mode", "mat");
  await expect(page.locator("[data-source]").first()).toBeHidden();
  await expect(page.locator("[data-balance-note]")).toBeHidden();
});

test("28.5 Giai mat sheet: ruled and softly shadowed; the seal lands during Declassify (transform + opacity)", async ({ page }) => {
  await setMode(page, "mat");
  await page.goto("/vi/");
  await expect(page.locator("[data-seal]")).toBeHidden();
  const seal = await page.locator("[data-mode-toggle]").evaluate(async (button) => {
    (button as HTMLElement).click();
    // The scene starts when the View Transition is ready: wait for it, then read the seal's animation.
    for (let i = 0; i < 30 && !document.documentElement.dataset["scene"]; i++) await new Promise(requestAnimationFrame);
    const el = document.querySelector("[data-seal]")!;
    return el.getAnimations().map((a) => {
      const t = a.effect!.getComputedTiming();
      const props = Object.keys((a.effect as KeyframeEffect).getKeyframes()[0]!).filter((k) => !["offset", "computedOffset", "easing", "composite"].includes(k));
      return { duration: Number(t.duration), delay: Number(t.delay), props: props.sort() };
    });
  });
  expect(seal).toEqual([{ duration: 150, delay: 570, props: ["opacity", "transform"] }]);
  await expect(page.locator("[data-seal]")).toBeVisible();
  await expect(page.locator("[data-seal]")).toHaveText(ui.sealDeclassified.vi);
  const sheet = await page.locator(".ledger.sheet").evaluate((e) => ({ bg: getComputedStyle(e).backgroundImage, shadow: getComputedStyle(e).boxShadow }));
  expect(sheet.bg).toContain("repeating-linear-gradient");
  expect(sheet.shadow).not.toBe("none");
});

test("28.5 reduced motion: the seal is simply there, no animation", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await setMode(page, "mat");
  await page.goto("/vi/");
  await page.locator("[data-mode-toggle]").click();
  await expect(page.locator("[data-seal]")).toBeVisible();
  expect(await page.locator("[data-seal]").evaluate((e) => e.getAnimations().length)).toBe(0);
});

test("28.7 a document preview shows only where the owner gave one", async ({ page }) => {
  await setMode(page, "giai-mat");
  await page.goto("/vi/");
  await expect(page.locator("[data-preview]")).toHaveCount(0); // none in content/ yet
  await page.goto(`${FIXTURE}/vi/`);
  const fixture = page.locator("#claim-fx-verified");
  await fixture.locator("[data-row-toggle]").click();
  const img = fixture.locator("[data-preview] img");
  await expect(img).toHaveAttribute("src", "/og.png");
  await expect(img).toHaveAttribute("alt", "Bản xem trước thử");
  await expect(img).toBeVisible();
});
