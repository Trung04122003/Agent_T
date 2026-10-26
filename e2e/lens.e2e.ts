import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

// ROADMAP P7 on the real content: entry UI (7.2), FLIP (7.3), three orders (7.4).
const lenses = JSON.parse(readFileSync("content/lenses.json", "utf8")).lenses as Array<{ id: string; label: { vi: string; en: string } }>;
const ui = JSON.parse(readFileSync("content/ui.json", "utf8"));
const rowIds = (page: Page) => page.locator(".ledger__list > [data-claim]").evaluateAll((els) => els.map((e) => e.getAttribute("data-claim")));
const card = (page: Page, id: string) => page.locator(`[data-lens="${id}"]`);

test("7.2 entry shows the question and three directions; choosing one sets ?lens= and Back undoes it", async ({ page }) => {
  await page.goto("/vi/");
  const nav = page.locator("[data-lens-nav]");
  await expect(nav.getByRole("heading")).toHaveText(ui.lensQuestion.vi);
  await expect(nav.locator("[data-lens]")).toHaveText(lenses.map((l) => l.label.vi));
  const initial = await rowIds(page);

  await card(page, "client").click();
  await expect(page).toHaveURL(/\?lens=client$/);
  await expect(card(page, "client")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("[data-lens-title]")).toHaveText("Khách hàng");
  const client = await rowIds(page);
  expect(client).not.toEqual(initial);
  expect(client[0]).toBe("role-bluesea"); // role-prudential is on hold (ROADMAP 9.6)

  await card(page, "curious").click();
  await expect(page).toHaveURL(/\?lens=curious$/);
  await page.goBack();
  await expect(page).toHaveURL(/\?lens=client$/);
  expect(await rowIds(page)).toEqual(client);
  await page.goBack();
  await expect(page).toHaveURL(/\/vi\/$/);
  expect(await rowIds(page)).toEqual(initial);
  await expect(page.locator("[data-lens-title]")).toHaveText("");
  await expect(page.locator("html")).toHaveAttribute("lang", "vi"); // Back did not trigger a language swap
});

test("7.2 pressing the active direction again returns to the default order", async ({ page }) => {
  await page.goto("/vi/");
  const initial = await rowIds(page);
  await card(page, "partner").click();
  await card(page, "partner").click();
  await expect(page).toHaveURL(/\/vi\/$/);
  expect(await rowIds(page)).toEqual(initial);
});

test("7.2 a shared ?lens= link opens in that order, keyboard works, the language switch keeps it", async ({ page }) => {
  await page.goto("/vi/?lens=curious");
  expect((await rowIds(page))[0]).toBe("project-air-quality");
  await card(page, "partner").focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\?lens=partner$/);
  await page.locator("[data-lang-switch]:not([aria-current])").click();
  await expect(page).toHaveURL(/\/en\/\?lens=partner$/);
  await expect(card(page, "partner")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("[data-lens-title]")).toHaveText(lenses[0]!.label.en);
  expect((await rowIds(page))[0]).toBe("role-bbe-ldc");
});

test("7.3 FLIP: moved rows slide 350 ms, 30 ms apart, transform only", async ({ page }) => {
  await page.goto("/vi/");
  await card(page, "curious").evaluate((el: HTMLElement) => el.click());
  const anims = await page.evaluate(() =>
    document.getAnimations().map((a) => {
      const e = a.effect as KeyframeEffect;
      const t = e.getComputedTiming();
      return {
        row: (e.target as Element).hasAttribute("data-claim"),
        duration: Math.round(Number(t.duration)),
        delay: Math.round(Number(t.delay)),
        props: Object.keys(e.getKeyframes()[0]!).filter((k) => !["offset", "computedOffset", "easing", "composite"].includes(k)),
      };
    }),
  );
  const rows = anims.filter((a) => a.row);
  expect(rows.length).toBeGreaterThan(2);
  expect(rows.length).toBeLessThanOrEqual(12);
  expect(rows.map((r) => r.delay)).toEqual(rows.map((_, i) => i * 30));
  for (const r of rows) {
    expect(r.duration).toBe(350);
    expect(r.props).toEqual(["transform"]);
  }
  for (const a of anims) expect(a.props.filter((p) => !["transform", "opacity"].includes(p))).toEqual([]);
});

test("7.3 reduced motion: reorders at once", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/vi/");
  const result = await card(page, "client").evaluate((el: HTMLElement) => {
    el.click();
    return {
      first: document.querySelector(".ledger__list > [data-claim]")?.getAttribute("data-claim"),
      running: document.getAnimations().length,
    };
  });
  expect(result).toEqual({ first: "role-bluesea", running: 0 });
});

test("7.4 the three directions give three different orders of the same ids", async ({ page }) => {
  await page.goto("/vi/");
  const initial = await rowIds(page);
  const orders: string[] = [];
  for (const l of lenses) {
    await page.goto(`/vi/?lens=${l.id}`);
    const ids = await rowIds(page);
    expect([...ids].sort()).toEqual([...initial].sort());
    orders.push(ids.join());
  }
  expect(new Set(orders).size).toBe(3);
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });
  test("no entry controls; the ledger keeps its default order", async ({ page }) => {
    await page.goto("/vi/?lens=client");
    await expect(page.locator("[data-lens-nav]")).toBeHidden();
    expect((await rowIds(page))[0]).toBe("edu-duy-tan");
  });
});
