import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

// P13: the Mat "console" — classification strip, file furniture, stamp, viewfinder.
const ui = JSON.parse(readFileSync("content/ui.json", "utf8"));
const setMode = (page: Page, mode: string) => page.addInitScript((m) => localStorage.setItem("mode", m), mode);

test("13.1 classification strip top and bottom, own words only, no real agency marks", async ({ page }) => {
  await setMode(page, "mat");
  await page.goto("/vi/");
  for (const pos of ["top", "bottom"]) {
    const banner = page.locator(`[data-banner="${pos}"]`);
    await expect(banner).toBeVisible();
    // What is on screen (innerText: visible parts only, after text-transform).
    const shown = (await banner.locator(".banner__level").innerText()).replace(/\s+/g, " ").trim();
    expect(shown).toBe(`${ui.portraitLabel.vi} · ${ui.classLevelLabel.vi}: ${ui.modeMat.vi}`.toLocaleUpperCase("vi"));
    const text = (await banner.textContent())!.toUpperCase();
    for (const word of ["TOP SECRET", "NOFORN", "FBI", "CIA", "NSA", "TUYỆT MẬT", "TỐI MẬT", "//"]) expect(text).not.toContain(word);
  }
  // Top strip comes first in the page, bottom one last.
  const order = await page.evaluate(() => {
    const all = [...document.body.children];
    return [all.indexOf(document.querySelector('[data-banner="top"]')!), all.indexOf(document.querySelector('[data-banner="bottom"]')!), all.length];
  });
  expect(order).toEqual([0, order[2]! - 1, order[2]]);
  // Mat: solid brass band.
  const [bg, accent] = await page.locator('[data-banner="top"]').evaluate((el) => {
    const probe = document.createElement("span");
    probe.style.color = "var(--accent)";
    el.append(probe);
    const colors = [getComputedStyle(el).backgroundColor, getComputedStyle(probe).color];
    probe.remove();
    return colors;
  });
  expect(bg).toBe(accent);
});

test("13.1 Giai mat: the old level is struck through", async ({ page }) => {
  await setMode(page, "giai-mat");
  await page.goto("/vi/");
  const level = page.locator('[data-banner="top"] .banner__level');
  await expect(level).toContainText(ui.modeGiaiMat.vi);
  await expect(level.locator("s")).toHaveText(ui.modeMat.vi);
  await expect(level.locator("s")).toBeVisible();
});

test("13.2 file number, DTG from the build, page marks 1/3 to 3/3", async ({ page }) => {
  await page.goto("/vi/");
  const file = page.locator('[data-banner="top"] [data-file-no]');
  await expect(file).toHaveText(/^CUPID-\d{4}$/);
  await expect(page.locator('[data-banner="top"] [data-dtg]')).toHaveText(/^\d{6}Z [A-Z]{3} \d{2}$/);
  const fileNo = await file.textContent();
  const marks = page.locator("[data-page-mark]");
  await expect(marks).toHaveText([1, 2, 3].map((n) => new RegExp(`^${fileNo}\\s*${ui.pageLabel.vi} ${n}/3$`)));
  for (const id of ["gate", "ledger", "map"]) await expect(page.locator(`[data-page-mark="${id}"]`)).toHaveAttribute("aria-hidden", "true");
});

test("13.2 the strips follow an in-place language switch", async ({ page }) => {
  await page.goto("/vi/");
  await page.locator("[data-lang-switch]:not([aria-current])").click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  for (const pos of ["top", "bottom"]) {
    await expect(page.locator(`[data-banner="${pos}"] .banner__level`)).toContainText(ui.portraitLabel.en);
  }
  await expect(page.locator('[data-page-mark="ledger"]')).toContainText(`${ui.pageLabel.en} 2/3`);
});

const stampAnims = (page: Page) =>
  page.locator("[data-claim]").first().locator("[data-stamp]").evaluate((el) =>
    el.getAnimations().map((a) => {
      const e = a.effect as KeyframeEffect;
      const t = e.getComputedTiming();
      const props = new Set(e.getKeyframes().flatMap((k) => Object.keys(k)).filter((k) => !["offset", "computedOffset", "easing", "composite"].includes(k)));
      return { duration: Number(t.duration), delay: Number(t.delay), props: [...props].sort() };
    }),
  );

test("13.3 Mat: opening a row lands a stamp (transform + opacity, 220 ms)", async ({ page }) => {
  await setMode(page, "mat");
  await page.goto("/vi/");
  const row = page.locator("[data-claim]").first();
  await row.locator("[data-row-toggle]").click();
  expect(await stampAnims(page)).toEqual([{ duration: 220, delay: 120, props: ["opacity", "transform"] }]);
  await expect(row.locator("[data-stamp]")).toBeVisible();
  await expect(row.locator("[data-stamp]")).toContainText(ui.stampOpened.vi);
  await expect(row.locator("[data-stamp]")).toHaveAttribute("aria-hidden", "true");
});

test("13.3 Giai mat: no stamp", async ({ page }) => {
  await setMode(page, "giai-mat");
  await page.goto("/vi/");
  const row = page.locator("[data-claim]").first();
  await row.locator("[data-row-toggle]").click();
  await expect(row.locator("[data-stamp]")).toBeHidden();
  expect(await stampAnims(page)).toEqual([]);
});

test("13.3 reduced motion: the stamp is there at once, no animation", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await setMode(page, "mat");
  await page.goto("/vi/");
  const row = page.locator("[data-claim]").first();
  await row.locator("[data-row-toggle]").click();
  await expect(row.locator("[data-stamp]")).toBeVisible();
  expect(await stampAnims(page)).toEqual([]);
});

test("13.4 viewfinder: portrait lines and map reticle in Mat only, vector only", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await setMode(page, "mat");
  await page.goto("/vi/");
  await expect(page.locator("[data-finder]")).toBeVisible();
  expect(await page.locator("[data-finder] image, [data-finder] [href]").count()).toBe(0);
  await page.locator('[data-place-btn="da-nang"]').click();
  await expect(page.locator('[data-place="da-nang"] .map__reticle')).toHaveCSS("opacity", "1");
  await expect(page.locator('[data-place="thuong-tin"] .map__reticle')).toHaveCSS("opacity", "0");

  await page.locator("[data-mode-toggle]").click();
  await expect(page.locator("html")).toHaveAttribute("data-mode", "giai-mat");
  await expect(page.locator("[data-finder]")).toBeHidden();
  await expect(page.locator('[data-place="da-nang"] .map__reticle')).toHaveCSS("opacity", "0");
});
