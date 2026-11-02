import { readFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./test";

// Owner request 2026-11-01: the evidence trail, every open entry -> its named sources -> their tier.
const claims = JSON.parse(readFileSync("content/claims.json", "utf8")) as {
  id: string;
  kind: string;
  visibility?: string;
  org?: { vi: string; en: string } | null;
  evidence?: { note: { vi: string; en: string } }[];
}[];
const ui = JSON.parse(readFileSync("content/ui.json", "utf8"));
const open = claims.filter((c) => c.kind !== "classified" && c.visibility !== "hold" && (c.evidence?.length ?? 0) > 0);
const pairs = open.reduce((n, c) => n + c.evidence!.length, 0);

test("every open entry, by name; nothing held or classified; a ribbon per pair and per source", async ({ page }) => {
  await page.goto("/vi/");
  const flow = page.locator("[data-flow]");
  await expect(flow.locator(".flow__title")).toHaveText(ui.flowTitle.vi);
  const names = await flow.locator(".flow__node--entry").allInnerTexts();
  expect(names.sort()).toEqual(open.map((c) => c.org!.vi).sort());
  for (const held of claims.filter((c) => c.visibility === "hold" && c.org)) expect(await flow.innerText()).not.toContain(held.org!.vi);
  const sources = await flow.locator(".flow__node--source").count();
  await expect(flow.locator(".flow__ribbon")).toHaveCount(pairs + sources);
  await expect(flow.locator(".flow__node--tier b")).toHaveText(["T2", "T3"]);
  // No source name keeps "available on request": the tier says it.
  for (const s of await flow.locator(".flow__node--source").allInnerTexts()) expect(s).not.toMatch(/cung cấp khi có yêu cầu/);
});

test("screen readers get the trail as a table, one row per pair; the drawing is hidden from them", async ({ page }) => {
  await page.goto("/vi/");
  const flow = page.locator("[data-flow]");
  await expect(flow.locator("[data-flow-plot]")).toHaveAttribute("aria-hidden", "true");
  const table = flow.getByRole("table");
  await expect(table.getByRole("row")).toHaveCount(pairs + 1);
  await expect(table.locator("tbody th").first()).toHaveAttribute("scope", "row");
  await expect(table.locator("a")).toHaveCount(0); // nothing focusable while hidden
  const result = await new AxeBuilder({ page }).include("[data-flow]").analyze();
  expect(result.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
});

test("pointing at an entry lights its trail only; leaving clears it", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/vi/");
  const flow = page.locator("[data-flow]");
  await flow.scrollIntoViewIfNeeded();
  await flow.locator('.flow__node--entry[data-entries="role-prudential"]').hover();
  await expect(flow).toHaveClass(/is-hot/);
  // Its own node, its source, its tier, and the two ribbons between them.
  await expect(flow.locator(".flow__node.is-lit")).toHaveCount(3);
  await expect(flow.locator(".flow__ribbon.is-lit")).toHaveCount(2);
  await expect(flow.locator('.flow__node--entry[data-entries="edu-duy-tan"]')).toHaveCSS("opacity", "0.35");
  await page.mouse.move(5, 5);
  await expect(flow).not.toHaveClass(/is-hot/);
  await expect(flow.locator(".is-lit")).toHaveCount(0);
});

test("after an in-place switch to English: English names, and hover still works", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/vi/");
  await page.locator('[data-lang-switch="en"]').first().click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  const flow = page.locator("[data-flow]");
  await expect(flow.locator(".flow__title")).toHaveText(ui.flowTitle.en);
  await flow.scrollIntoViewIfNeeded();
  await flow.locator(".flow__node--entry").first().hover();
  await expect(flow).toHaveClass(/is-hot/);
});

test.describe("375 px", () => {
  test.use({ viewport: { width: 375, height: 812 } });
  test("fits the width; rows taller so names wrap", async ({ page }) => {
    await page.goto("/vi/");
    const flow = page.locator("[data-flow]");
    await flow.scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
    const row = (await flow.locator(".flow__node--entry").first().boundingBox())!;
    expect(row.height).toBeGreaterThanOrEqual(50);
    await page.screenshot({ path: "test-results/screenshots/flow-375.png", fullPage: false });
  });
});
