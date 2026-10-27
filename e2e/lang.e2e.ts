import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { DEV } from "../playwright.config";
import { gotoStable } from "./helpers";

// ROADMAP 5.3: language switch (option b) with the Decode effect.
const identity = JSON.parse(readFileSync("content/identity.json", "utf8"));
const ui = JSON.parse(readFileSync("content/ui.json", "utf8"));
const codenameEn = identity.codenames.find((c: { locale: string }) => c.locale === "en").name;

/** Record every text the codename shows and every live-region message after this point. */
async function watch(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { __names: string[]; __live: string[]; __loads: number };
    w.__names = [];
    w.__live = [];
    new MutationObserver(() => {
      const h1 = document.querySelector("#gate-codename");
      if (h1) w.__names.push(h1.textContent ?? "");
      const live = document.querySelector("[data-lang-live]")?.textContent;
      if (live && w.__live.at(-1) !== live) w.__live.push(live);
    }).observe(document.documentElement, { subtree: true, childList: true, characterData: true });
  });
}
const seen = (page: Page) =>
  page.evaluate(() => {
    const w = window as unknown as { __names: string[]; __live: string[] };
    return { names: w.__names, live: w.__live };
  });

test("switches vi -> en in place: decodes the codename, keeps mode and focus, Back returns", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/vi/");
  await page.evaluate(() => ((window as unknown as { __marker: boolean }).__marker = true));
  await page.locator("[data-mode-toggle]").click();
  await expect(page.locator("html")).toHaveAttribute("data-mode", "giai-mat");
  await watch(page);

  await page.locator("[data-lang-switch]:not([aria-current])").focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/en\/$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator("[data-gate]")).toContainText(identity.positioning.en);
  await expect(page.locator("[data-mode-toggle]")).toHaveText(ui.modeGiaiMat.en);
  await expect(page.locator(".footer__updated")).toContainText(ui.updatedLabel.en);
  await expect(page.locator("html")).toHaveAttribute("data-mode", "giai-mat");
  expect(await page.evaluate(() => (window as unknown as { __marker?: boolean }).__marker)).toBe(true);

  await expect(page.locator("#gate-codename")).toHaveText(codenameEn);
  const { names, live } = await seen(page);
  expect(names.filter((n) => n !== codenameEn).length).toBeGreaterThan(3); // scrambled frames
  expect(live).toEqual([codenameEn]); // the live region reads the new name only
  await expect(page.locator("#gate-codename")).not.toHaveAttribute("aria-label", /.+/);
  // Focus stays on the language just chosen, which is now the current one.
  const current = page.locator("[data-lang-switch][aria-current=\"page\"]");
  await expect(current).toBeFocused();
  await expect(current).toHaveAccessibleName(`EN ${ui.languageName.en}`);

  // Controls in the swapped regions still work.
  await page.locator("[data-mode-toggle]").click();
  await expect(page.locator("html")).toHaveAttribute("data-mode", "mat");
  await expect(page.locator("[data-mode-live]")).toHaveText(ui.modeAnnounceMat.en);
  const row = page.locator("[data-row-toggle]").first();
  await row.click();
  await expect(row).toHaveAttribute("aria-expanded", "true");

  await page.goBack();
  await expect(page).toHaveURL(/\/vi\/$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "vi");
  await expect(page.locator("[data-gate]")).toContainText(identity.positioning.vi);
  expect(errors).toEqual([]);
});

test("reduced motion: the codename changes at once, no scrambled frame, no fade", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/vi/");
  await watch(page);
  await page.locator("[data-lang-switch]:not([aria-current])").click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator("#gate-codename")).toHaveText(codenameEn);
  const { names } = await seen(page);
  expect(names.every((n) => n === codenameEn)).toBe(true);
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
});

test("P12: the identity card and mode button decode, then the positioning appears word by word", async ({ page }) => {
  await page.goto("/vi/");
  await page.evaluate(() => {
    const w = window as unknown as { __frames: Record<string, string[]> };
    w.__frames = { label: [], button: [] };
    new MutationObserver(() => {
      const label = document.querySelector(".gate__label")?.textContent ?? "";
      const button = document.querySelector("[data-mode-toggle]")?.textContent?.trim() ?? "";
      if (w.__frames.label!.at(-1) !== label) w.__frames.label!.push(label);
      if (w.__frames.button!.at(-1) !== button) w.__frames.button!.push(button);
    }).observe(document.documentElement, { subtree: true, childList: true, characterData: true });
  });
  await page.locator("[data-lang-switch]:not([aria-current])").click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");

  // Word by word: one opacity animation per word, starting after the decode (420 ms), 70 ms apart.
  await page.waitForFunction(() => document.querySelectorAll(".gate__positioning span").length > 0);
  const words = await page.evaluate(() =>
    [...document.querySelectorAll(".gate__positioning span")].map((s) => {
      const a = s.getAnimations()[0]!;
      const t = (a.effect as KeyframeEffect).getComputedTiming();
      return { delay: Math.round(Number(t.delay)), duration: Number(t.duration) };
    }),
  );
  // The page opens in Mat: the line on screen is the Mat wording when there is one.
  const shownLine = (identity.positioningMat ?? identity.positioning).en as string;
  expect(words.length).toBe(shownLine.split(/\s+/).length);
  words.forEach((w, i) => expect(w).toEqual({ delay: 420 + i * 70, duration: 240 }));

  // Ends as plain text with the right strings, nothing left over.
  await expect(page.locator(".gate__positioning span")).toHaveCount(0, { timeout: 5000 });
  await expect(page.locator(".gate__positioning:visible")).toHaveText(shownLine);
  await expect(page.locator(".gate__label")).toHaveText(ui.codenameLabel.en);
  await expect(page.locator("[data-mode-toggle]")).toHaveText(ui.modeGiaiMat.en);
  await expect(page.locator(".gate__label")).not.toHaveAttribute("aria-label", /.+/);
  const frames = await page.evaluate(() => (window as unknown as { __frames: Record<string, string[]> }).__frames);
  expect(frames.label!.filter((f) => f !== ui.codenameLabel.en).length).toBeGreaterThan(3); // scrambled
  expect(frames.button!.filter((f) => f !== ui.modeGiaiMat.en).length).toBeGreaterThan(3);
});

test("ctrl+click keeps the browser's default (new tab), no in-place swap", async ({ page, context }) => {
  await page.goto("/vi/");
  const [popup] = await Promise.all([context.waitForEvent("page"), page.locator("[data-lang-switch]:not([aria-current])").click({ modifiers: ["Control"] })]);
  await popup.waitForLoadState();
  expect(popup.url()).toMatch(/\/en\/$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "vi");
});

test("RTL or non-Latin names use a 300 ms mask sweep instead of scrambling; Latin decodes in 420 ms", async ({ page }) => {
  await gotoStable(page, `${DEV}/dev/fonts`);
  const result = await page.evaluate(async () => {
    const { revealName } = await import("/src/scripts/decode.ts" as string);
    const el = document.createElement("h1");
    document.body.append(el);
    const frames: string[] = [];
    new MutationObserver(() => frames.push(el.textContent ?? "")).observe(el, { childList: true, characterData: true, subtree: true });

    const run = async (text: string, dir: string) => {
      frames.length = 0;
      const t0 = performance.now();
      const done = revealName(el, text, dir);
      await new Promise((r) => requestAnimationFrame(r));
      const anim = el.getAnimations()[0];
      const timing = anim ? (anim.effect as KeyframeEffect).getComputedTiming().duration : null;
      const props = anim ? Object.keys((anim.effect as KeyframeEffect).getKeyframes()[0]!).filter((k) => !["offset", "computedOffset", "easing", "composite"].includes(k)) : [];
      await done;
      return { text, frames: [...frames], timing, props, ms: Math.round(performance.now() - t0) };
    };
    return [await run("خالد", "rtl"), await run("武蔵", "ltr"), await run("Calisto", "ltr")];
  });
  const [arabic, japanese, latin] = result;
  for (const r of [arabic, japanese]) {
    expect(r!.timing).toBe(300);
    expect(r!.props).toEqual(["clipPath"]);
    expect(r!.frames.every((f) => f === r!.text)).toBe(true); // never shuffled
  }
  expect(latin!.timing).toBeNull();
  expect(latin!.frames.filter((f) => f !== "Calisto").length).toBeGreaterThan(3);
  expect(latin!.ms).toBeGreaterThanOrEqual(400);
  expect(latin!.ms).toBeLessThan(700);
});

test("after an in-place switch to en, evidence notes are in English", async ({ page }) => {
  await page.goto("/vi/");
  await page.locator("[data-lang-switch]:not([aria-current])").click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  const claims = JSON.parse(readFileSync("content/claims.json", "utf8")) as Array<{ evidence?: { note: { vi: string } }[] }>;
  const vi = claims.flatMap((c) => c.evidence ?? []).map((e) => e.note.vi);
  const text = await page.evaluate(() => document.body.textContent ?? "");
  expect(vi.filter((n) => text.includes(n))).toEqual([]);
});
