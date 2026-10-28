import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

// P23: the chart crosshair. Giai mat: lines snapped to a month and to its count, readouts on the
// axes. Mat: the same lines, the readouts covered. Keyboard and touch drive it too.
type Raw = { kind: string; visibility?: string; paused?: boolean; period?: { start: string; end: string | null; ongoing?: boolean } | null };
const raw = JSON.parse(readFileSync("content/claims.json", "utf8")) as Raw[];
const setMode = (page: Page, mode: string) => page.addInitScript((m) => localStorage.setItem("mode", m), mode);

// Independent recount of the months (paused entries out, ROADMAP 23.4), to check the page's data.
function recount(): { start: string; counts: number[] } {
  const open = raw.filter((c) => c.kind !== "classified" && c.visibility !== "hold" && c.period && !c.paused);
  const idx = (p: string) => Number(p.slice(0, 4)) * 12 + Number(p.slice(5, 7)) - 1;
  const now = new Date();
  const nowI = now.getUTCFullYear() * 12 + now.getUTCMonth();
  const spans = open.map((c) => [idx(c.period!.start), c.period!.ongoing ? nowI : idx(c.period!.end!)] as const);
  const first = Math.min(...spans.map((s) => s[0]));
  const counts: number[] = [];
  for (let i = first; i <= nowI; i++) counts.push(spans.filter((s) => s[0] <= i && i <= s[1]).length);
  return { start: `${Math.floor(first / 12)}-${String((first % 12) + 1).padStart(2, "0")}`, counts };
}
const label = (start: string, i: number) => {
  const k = Number(start.slice(0, 4)) * 12 + Number(start.slice(5, 7)) - 1 + i;
  return `${String((k % 12) + 1).padStart(2, "0")}/${Math.floor(k / 12)}`;
};
const translate = (t: string | null) => (t ?? "").match(/translate\(([-\d.]+)[ ,]+([-\d.]+)\)/)!.slice(1).map(Number);

async function pointAt(page: Page, frac: number) {
  const plot = page.locator("[data-chart-plot]");
  await plot.scrollIntoViewIfNeeded();
  const b = (await plot.boundingBox())!;
  const months = Number(await plot.getAttribute("data-months"));
  const x = b.x + b.width * frac;
  await page.mouse.move(b.x + b.width / 2, b.y - 40);
  await page.mouse.move(x, b.y + b.height / 2, { steps: 3 });
  return { month: Math.min(months - 1, Math.floor(((x - b.x) / b.width) * months)), plot };
}

test("23.1 Giai mat: the crosshair snaps to a month and its count; the axes read the month and the count", async ({ page }) => {
  await setMode(page, "giai-mat");
  await page.goto("/vi/");
  const { start, counts } = recount();
  const plot = page.locator("[data-chart-plot]");
  expect(await plot.getAttribute("data-start")).toBe(start);
  expect(JSON.parse((await plot.getAttribute("data-counts"))!)).toEqual(counts);
  const top = Number(await plot.getAttribute("data-top"));

  await expect(plot.locator("[data-xhair-x]")).toBeHidden();
  for (const frac of [0.05, 0.55, 0.97]) {
    const { month } = await pointAt(page, frac);
    await expect(plot).toHaveClass(/is-xhair/);
    await expect(plot.locator("[data-xhair-date]")).toHaveText(label(start, month));
    await expect(plot.locator("[data-xhair-count]")).toHaveText(String(counts[month]));
    expect(translate(await plot.locator("[data-xhair-v]").getAttribute("transform"))).toEqual([month + 0.5, 0]);
    expect(translate(await plot.locator("[data-xhair-h]").getAttribute("transform"))).toEqual([0, top - counts[month]!]);
    await expect(page.locator("[data-chart-count]")).toHaveText(String(counts[month]));
  }
  // Both readouts stay inside the chart card, the date one on the x axis, the count on the y axis.
  const card = (await page.locator("[data-chart]").boundingBox())!;
  for (const tag of ["[data-xhair-x]", "[data-xhair-y]"]) {
    const t = (await plot.locator(tag).boundingBox())!;
    expect(t.x).toBeGreaterThanOrEqual(card.x);
    expect(t.x + t.width).toBeLessThanOrEqual(card.x + card.width);
  }
  await page.mouse.move(5, 5);
  await expect(plot).not.toHaveClass(/is-xhair/);
});

test("23.1 Mat: same crosshair, readouts covered; declassifying shows the figures", async ({ page }) => {
  await setMode(page, "mat");
  await page.goto("/vi/");
  const { month, plot } = await pointAt(page, 0.55);
  const { start } = recount();
  // A vertical line has no geometric width, so check its visibility rather than its box.
  await expect(plot).toHaveClass(/is-xhair/);
  await expect(plot.locator("[data-chart-xhair]")).toHaveCSS("visibility", "visible");
  for (const tag of ["[data-xhair-x]", "[data-xhair-y]"]) {
    await expect(plot.locator(`${tag} .chart__redact`)).toBeVisible();
    expect((await plot.locator(tag).innerText()).trim()).toBe(""); // no real text on screen
  }
  await page.locator("[data-mode-toggle]").click();
  await expect(page.locator("html")).toHaveAttribute("data-mode", "giai-mat");
  // Declassified: the readouts now carry the figures, not the bars.
  await expect(plot.locator("[data-xhair-date]")).not.toHaveCSS("display", "none");
  await expect(plot.locator("[data-xhair-x] .chart__redact")).toHaveCSS("display", "none");
  // The declassify scene (720 ms) takes the pointer while it runs; point again once it is over.
  await expect(page.locator("html")).not.toHaveAttribute("data-scene", /./);
  await pointAt(page, 0.55);
  await expect(plot.locator("[data-xhair-date]")).toBeVisible();
  await expect(plot.locator("[data-xhair-date]")).toHaveText(label(start, month));
});

test("23.2 scrubbing moves the crosshair without rebuilding the drawing", async ({ page }) => {
  await page.goto("/vi/");
  await pointAt(page, 0.1);
  await page.evaluate(() => {
    const w = window as unknown as { __mut: number };
    w.__mut = 0;
    new MutationObserver((l) => (w.__mut += l.filter((m) => m.type === "childList").length)).observe(
      document.querySelector("[data-chart-plot] svg")!,
      { childList: true, subtree: true },
    );
  });
  const b = (await page.locator("[data-chart-plot]").boundingBox())!;
  for (let i = 0; i <= 20; i++) await page.mouse.move(b.x + (b.width * i) / 20, b.y + b.height / 2);
  expect(await page.evaluate(() => (window as unknown as { __mut: number }).__mut)).toBe(0);
});

test("23.2 the crosshair still works after an in-place language switch", async ({ page }) => {
  await setMode(page, "giai-mat");
  await page.goto("/vi/");
  await page.locator("[data-lang-switch]:not([aria-current])").click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  const { month, plot } = await pointAt(page, 0.3);
  await expect(plot).toHaveClass(/is-xhair/);
  await expect(plot.locator("[data-xhair-date]")).toHaveText(label(recount().start, month));
});

test("23.3 keyboard: the crosshair follows the arrow keys", async ({ page }) => {
  await setMode(page, "giai-mat");
  await page.goto("/vi/");
  const plot = page.locator("[data-chart-plot]");
  const segs = JSON.parse((await plot.getAttribute("data-segments"))!) as { a: number; label: string }[];
  await plot.focus();
  await page.keyboard.press("Home");
  await expect(plot).toHaveClass(/is-xhair/);
  expect(translate(await plot.locator("[data-xhair-v]").getAttribute("transform"))[0]).toBe(segs[0]!.a + 0.5);
  await page.keyboard.press("ArrowRight");
  expect(translate(await plot.locator("[data-xhair-v]").getAttribute("transform"))[0]).toBe(segs[1]!.a + 0.5);
  await expect(page.locator("[data-chart-when]")).toHaveText(segs[1]!.label);
  await page.keyboard.press("Tab");
  await expect(plot).not.toHaveClass(/is-xhair/);
});

test.describe("23.3 touch", () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 375, height: 812 } });
  test("a tap shows the crosshair, a horizontal drag scrubs, the page still scrolls vertically", async ({ page }) => {
    await setMode(page, "giai-mat");
    await page.goto("/vi/");
    const plot = page.locator("[data-chart-plot]");
    await plot.scrollIntoViewIfNeeded();
    await expect(plot).toHaveCSS("touch-action", "pan-y");
    const b = (await plot.boundingBox())!;
    const months = Number(await plot.getAttribute("data-months"));
    await page.touchscreen.tap(b.x + b.width * 0.2, b.y + b.height / 2);
    await expect(plot).toHaveClass(/is-xhair/);
    const first = await plot.locator("[data-xhair-date]").textContent();
    // A horizontal drag: the browser leaves it to the page (pan-y), so pointer moves arrive.
    const end = b.x + b.width * 0.8;
    await plot.evaluate((el, x) => {
      const o = { pointerType: "touch", bubbles: true, clientY: el.getBoundingClientRect().top + 20 };
      el.dispatchEvent(new PointerEvent("pointermove", { ...o, clientX: x }));
    }, end);
    await expect(plot.locator("[data-xhair-date]")).not.toHaveText(first!);
    expect(translate(await plot.locator("[data-xhair-v]").getAttribute("transform"))[0]).toBe(Math.floor(((end - b.x) / b.width) * months) + 0.5);
    // Leaving with a finger lifted keeps the reading on screen (no hover on touch).
    await plot.evaluate((el) => el.dispatchEvent(new PointerEvent("pointerleave", { pointerType: "touch" })));
    await expect(plot).toHaveClass(/is-xhair/);
    // No horizontal page overflow from the readouts at 375 px.
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
  });
});
