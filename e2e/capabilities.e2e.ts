import { readFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./test";

// Owner request 2026-11-01: the capability matrix, and each ledger row linked to its place.
const claims = JSON.parse(readFileSync("content/claims.json", "utf8")) as {
  id: string;
  kind: string;
  visibility?: string;
  org?: { vi: string } | null;
  domains?: string[];
}[];
const { domains } = JSON.parse(readFileSync("content/domains.json", "utf8")) as { domains: { id: string; vi: string; en: string }[] };
const ui = JSON.parse(readFileSync("content/ui.json", "utf8"));
const open = claims.filter((c) => c.kind !== "classified" && c.visibility !== "hold" && c.domains?.length);

test("matrix: a real table, one row per entry, a mark exactly where content/ says, totals; axe clean", async ({ page }) => {
  await page.goto("/vi/");
  const table = page.locator("[data-matrix] table");
  await expect(table.locator("thead th")).toHaveText([ui.flowEntry.vi, ...domains.map((d) => d.vi)]);
  await expect(table.locator("tbody tr")).toHaveCount(open.length);
  for (const c of open) {
    const cells = table.locator(`tr[data-matrix-row="${c.id}"] td`);
    const has = await cells.evaluateAll((tds) => tds.map((td) => td.getAttribute("data-has")));
    expect(has, c.id).toEqual(domains.map((d) => String(c.domains!.includes(d.id))));
    // Screen readers hear "yes" where there is a mark, nothing elsewhere.
    await expect(cells.locator(".visually-hidden")).toHaveCount(c.domains!.length);
  }
  await expect(table.locator("tfoot td")).toHaveText(domains.map((d) => String(open.filter((c) => c.domains!.includes(d.id)).length)));
  const result = await new AxeBuilder({ page }).include("[data-matrix]").analyze();
  expect(result.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
});

test("matrix at 375 px: fits the width", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/vi/");
  await page.locator("[data-matrix]").scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
});

test("a ledger row's 'see it on the map' brings the map up and picks Da Nang on both maps", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/vi/");
  const row = page.locator('[data-claim="role-jci"]');
  await expect(row).toHaveAttribute("data-place-ref", "da-nang");
  const toggle = row.locator("[data-row-toggle]");
  if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
  const link = row.locator("[data-goto-place]");
  await expect(link).toContainText(ui.ledgerOnMap.vi);
  await link.click();
  const pick = page.locator('[data-place-btn="da-nang"]');
  await expect(pick).toHaveAttribute("aria-pressed", "true");
  await expect(pick).toBeFocused();
  await expect(pick).toContainText(`${open.length} ${ui.mapPlaceEntries.vi}`);
  await expect(page.locator("[data-map-svg]")).toHaveClass(/is-zoomed/);
  await expect(page.locator("[data-map-3d-svg]")).toHaveClass(/is-zoomed/);
});

test("pointing at a ledger row lights its place on the map", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/vi/");
  await page.locator('[data-claim="role-prudential"] .row__head').hover();
  await expect(page.locator('[data-map-svg] [data-place="da-nang"]')).toHaveClass(/is-active/);
  await page.mouse.move(5, 5);
  await expect(page.locator('[data-map-svg] [data-place="da-nang"]')).not.toHaveClass(/is-active/);
});

test("without JavaScript the link is a plain jump to the map", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("/vi/");
  await expect(page.locator('[data-claim="role-jci"] [data-goto-place]')).toHaveAttribute("href", "#map-title");
  await context.close();
});
