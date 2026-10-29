import { readFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { SITE } from "../playwright.config";
import { expect, test, type Page } from "./test";

// P27: reading profiles and the "Aa" panel.
const ui = JSON.parse(readFileSync("content/ui.json", "utf8"));
const SPEC_TEXT = "Lê Thái Trung — Ắ Ằ Ẳ Ẵ Ặ Ế Ề Ể Ễ Ệ Ố Ồ Ổ Ỗ Ộ Ớ Ờ Ở Ỡ Ợ Ứ Ừ Ử Ữ Ự";
const PROFILES = [
  { id: "ho-so", face: "Be Vietnam Pro", file: "be-vietnam-pro" },
  { id: "bien-ban", face: "Source Serif 4", file: "source-serif-4" },
  { id: "de-doc", face: "Lexend", file: "lexend" },
  { id: "may-chu", face: "IBM Plex Mono", file: "ibm-plex-mono" },
] as const;

const openPanel = async (page: Page) => {
  await page.locator("[data-reading-toggle]").click();
  await expect(page.locator("[data-reading-panel]")).toBeVisible();
};
const choose = async (page: Page, id: string) => {
  await openPanel(page);
  await page.locator(`input[name="reading-font"][value="${id}"]`).check();
  await page.keyboard.press("Escape");
};
/** The faces the browser really drew a node's text with (CDP), glyph counts included. */
async function drawnWith(page: Page, selector: string): Promise<{ familyName: string; glyphCount: number }[]> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("DOM.enable");
  await cdp.send("CSS.enable");
  const { root } = await cdp.send("DOM.getDocument");
  const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector });
  const { fonts } = await cdp.send("CSS.getPlatformFontsForNode", { nodeId });
  return fonts;
}

for (const p of PROFILES) {
  test(`27.1 "${p.id}": the SPEC Vietnamese test text is drawn entirely in ${p.face}`, async ({ page }) => {
    await page.goto("/vi/");
    if (p.id !== "ho-so") await choose(page, p.id);
    if (p.id !== "ho-so") await expect(page.locator("html")).toHaveAttribute("data-font", p.id);
    // A probe in the page's body text style, holding the test text.
    await page.evaluate((text) => {
      const el = document.createElement("p");
      el.id = "font-probe";
      el.textContent = text;
      document.querySelector("main")!.prepend(el);
    }, SPEC_TEXT);
    await page.evaluate(() => document.fonts.ready);
    const fonts = await drawnWith(page, "#font-probe");
    expect(fonts.map((f) => f.familyName)).toEqual([p.face]); // no fallback face for any glyph
  });
}

test("27.2 a profile changes body text and headings only; mono labels, strips and figures keep their faces", async ({ page }) => {
  await page.goto("/vi/");
  const face = (sel: string) => page.locator(sel).first().evaluate((el) => getComputedStyle(el).fontFamily);
  const before = { label: await face(".banner__level"), num: await face(".stats__num"), code: await face(".row__code") };
  await choose(page, "bien-ban");
  await expect(page.locator("html")).toHaveAttribute("data-font", "bien-ban"); // applied once the face has loaded
  expect(await face("#gate-codename")).toContain("Source Serif 4");
  expect(await face(".gate__positioning")).toContain("Source Serif 4");
  expect({ label: await face(".banner__level"), num: await face(".stats__num"), code: await face(".row__code") }).toEqual(before);
});

test("27.3 other faces load only when chosen; the switch moves nothing (CLS 0)", async ({ page }) => {
  const fonts: string[] = [];
  page.on("request", (r) => r.url().endsWith(".woff2") && fonts.push(r.url()));
  await page.addInitScript(() => {
    const w = window as unknown as { __cls: number };
    w.__cls = 0;
    new PerformanceObserver((l) => {
      for (const e of l.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) w.__cls += e.value;
    }).observe({ type: "layout-shift", buffered: true });
  });
  await page.goto("/vi/");
  await page.waitForLoadState("networkidle");
  for (const f of ["source-serif-4", "lexend"]) expect(fonts.some((u) => u.includes(f)), `${f} before any choice`).toBe(false);
  const clsBefore = await page.evaluate(() => (window as unknown as { __cls: number }).__cls);
  await choose(page, "de-doc");
  await expect(page.locator("html")).toHaveAttribute("data-font", "de-doc");
  await page.waitForTimeout(800);
  expect(fonts.some((u) => u.includes("lexend"))).toBe(true);
  // Every shift counted, even those right after the input (which CLS itself would forgive).
  expect(await page.evaluate(() => (window as unknown as { __cls: number }).__cls)).toBeCloseTo(clsBefore, 3);
});

for (const p of PROFILES.filter((x) => x.id !== "may-chu")) {
  // (Máy chữ shares IBM Plex Mono with the labels, so its files load with every page anyway.)
  test(`27.3 "${p.id}" stays within 70 KB on a page (woff2 files as served, 400 + 700)`, async ({ browser }) => {
    // A fresh browser context, so nothing comes from cache; the gate is passed for this session.
    const context = await browser.newContext({ baseURL: SITE });
    await context.addInitScript(() => sessionStorage.setItem("gateSeen", "1"));
    const page = await context.newPage();
    const sizes = new Map<string, number>();
    page.on("response", async (r) => {
      if (r.status() === 200 && r.url().includes(`/${p.file}-`) && r.url().endsWith(".woff2")) sizes.set(r.url(), (await r.body()).length);
    });
    await page.goto("/vi/");
    if (p.id !== "ho-so") {
      await choose(page, p.id);
      await expect(page.locator("html")).toHaveAttribute("data-font", p.id);
    }
    await page.evaluate(() => document.fonts.ready);
    await page.waitForLoadState("networkidle");
    const total = [...sizes.values()].reduce((a, b) => a + b, 0);
    test.info().annotations.push({ type: "size", description: `${p.id}: ${sizes.size} files, ${total} B` });
    expect(total).toBeGreaterThan(0);
    if (p.id !== "ho-so") expect(total).toBeLessThanOrEqual(70 * 1024);
    await context.close();
  });
}

test("27.4 the panel: names in their own face, targets >= 44 px, keyboard, Esc returns focus; axe passes", async ({ page }) => {
  await page.goto("/vi/");
  const toggle = page.locator("[data-reading-toggle]");
  await expect(toggle).toHaveAttribute("aria-label", ui.readingButton.vi);
  await toggle.focus();
  await page.keyboard.press("Enter");
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  const panel = page.locator("[data-reading-panel]");
  for (const [id, name] of [["bien-ban", ui.fontBienBan.vi], ["de-doc", ui.fontDeDoc.vi], ["may-chu", ui.fontMayChu.vi]] as const) {
    const label = panel.locator(`label:has(input[value="${id}"]) span`);
    await expect(label).toHaveText(name);
    expect(await label.evaluate((el) => getComputedStyle(el).fontFamily)).toContain(PROFILES.find((p) => p.id === id)!.face);
  }
  for (const el of await panel.locator("label, button").all()) expect((await el.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  expect((await toggle.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  const result = await new AxeBuilder({ page }).include("[data-reading-panel]").analyze();
  expect(result.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
  // Keyboard: arrows move within a radio group; Esc closes and gives focus back.
  await panel.locator('input[value="ho-so"]').focus();
  await page.keyboard.press("ArrowDown");
  await expect(page.locator("html")).toHaveAttribute("data-font", "bien-ban");
  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
  await expect(toggle).toBeFocused();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
});

test("27.4 text size, custom cursor and Default", async ({ page }) => {
  await page.goto("/vi/");
  await openPanel(page);
  const rootSize = () => page.evaluate(() => getComputedStyle(document.documentElement).fontSize);
  await page.locator('input[name="reading-size"][value="lg"]').check();
  expect(await rootSize()).toBe("18.4px"); // 115%
  await page.locator('input[name="reading-size"][value="sm"]').check();
  expect(await rootSize()).toBe("14.4px"); // 90%
  await page.locator("[data-reading-cursor]").uncheck();
  await expect(page.locator("html")).toHaveAttribute("data-cursor", "system");
  await page.locator('input[name="reading-font"][value="may-chu"]').check();
  await expect(page.locator("html")).toHaveAttribute("data-font", "may-chu");
  await page.locator("[data-reading-reset]").click();
  await expect(page.locator("html")).not.toHaveAttribute("data-font", /.*/);
  await expect(page.locator("html")).not.toHaveAttribute("data-size", /.*/);
  await expect(page.locator("html")).toHaveAttribute("data-cursor", "custom");
  await expect(page.locator('input[name="reading-font"][value="ho-so"]')).toBeChecked();
  expect(await rootSize()).toBe("16px");
});

test("27.5 kept for the next visit and applied before the first paint; print uses the default", async ({ page }) => {
  await page.goto("/vi/");
  await choose(page, "bien-ban");
  await openPanel(page);
  await page.locator('input[name="reading-size"][value="lg"]').check();
  await page.addInitScript(() => {
    document.addEventListener("readystatechange", () => {
      const w = window as unknown as { __early: string | undefined };
      if (document.readyState === "interactive") w.__early ??= `${document.documentElement.dataset["font"]}/${document.documentElement.dataset["size"]}`;
    });
  });
  await page.reload();
  expect(await page.evaluate(() => (window as unknown as { __early: string }).__early)).toBe("bien-ban/lg");
  await page.emulateMedia({ media: "print" });
  const printed = await page.evaluate(() => ({
    face: getComputedStyle(document.body).fontFamily,
    size: getComputedStyle(document.documentElement).fontSize,
  }));
  expect(printed.face).toContain("Be Vietnam Pro");
  expect(printed.size).toBe("16px");
});

test("27.4 the panel still works after an in-place language switch", async ({ page }) => {
  await page.goto("/vi/");
  await page.locator("[data-lang-switch]:not([aria-current])").click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await openPanel(page);
  await expect(page.locator("[data-reading-panel] legend").first()).toHaveText(ui.readingTypeface.en);
  await page.locator('input[name="reading-font"][value="de-doc"]').check();
  await expect(page.locator("html")).toHaveAttribute("data-font", "de-doc");
});

test.describe("27.7 at 375 px", () => {
  test.use({ viewport: { width: 375, height: 812 } });
  test("A+ in every profile never widens the page; no claim of dyslexia support", async ({ page }) => {
    await page.goto("/vi/");
    await openPanel(page);
    await page.locator('input[name="reading-size"][value="lg"]').check();
    for (const p of PROFILES) {
      await page.locator(`input[name="reading-font"][value="${p.id}"]`).check();
      await page.evaluate(() => document.fonts.ready);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), p.id).toBeLessThanOrEqual(0);
    }
    const panel = page.locator("[data-reading-panel]");
    const box = (await panel.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(375);
    const text = (await page.locator("body").textContent())!.toLowerCase();
    for (const word of ["dyslexi", "chứng khó đọc"]) expect(text).not.toContain(word);
  });
});
