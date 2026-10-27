import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";
import { FIXTURE } from "../playwright.config";

// P14 / P20: the Giai mat "data floor" — density, evidence bars, header figures from content/.
const ui = JSON.parse(readFileSync("content/ui.json", "utf8"));
type Raw = {
  id: string;
  kind: string;
  visibility?: string;
  paused?: boolean;
  period?: { start: string; end: string | null; ongoing?: boolean } | null;
  evidence?: { type: string; url?: string; consent?: boolean }[];
};
const raw = JSON.parse(readFileSync("content/claims.json", "utf8")) as Raw[];
const shown = raw.filter((c) => c.kind === "classified" || c.visibility !== "hold");
const open = shown.filter((c) => c.kind !== "classified");
const tierOf = (c: Raw) =>
  (c.evidence ?? []).some((e) => (e.type === "link" && e.url) || (e.type === "reference" && e.consent === true))
    ? 3
    : (c.evidence ?? []).some((e) => e.type === "document-on-request")
      ? 2
      : 1;
const setMode = (page: Page, mode: string) => page.addInitScript((m) => localStorage.setItem("mode", m), mode);

test("14.1 no horizontal scroll at 375px in either mode", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  for (const mode of ["mat", "giai-mat"]) {
    await setMode(page, mode);
    await page.goto("/vi/");
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), mode).toBeLessThanOrEqual(0);
  }
});

test("14.1 Giai mat is denser than Mat: tighter rows, column heads, months per entry", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const rowPadding = () => page.locator(".row__toggle").first().evaluate((el) => parseFloat(getComputedStyle(el).paddingTop));
  await setMode(page, "mat");
  await page.goto("/vi/");
  const mat = await rowPadding();
  await expect(page.locator(".ledger__cols")).toBeHidden();
  await expect(page.locator(".row__dur").first()).toBeHidden();

  await page.locator("[data-mode-toggle]").click();
  await expect(page.locator("html")).toHaveAttribute("data-mode", "giai-mat");
  expect(await rowPadding()).toBeLessThan(mat);
  await expect(page.locator(".ledger__cols")).toBeVisible();
  // Column heads sit over their columns.
  const head = (await page.locator(".ledger__cols span").nth(2).boundingBox())!;
  const main = (await page.locator(".row__main").first().boundingBox())!;
  expect(Math.abs(head.x - main.x)).toBeLessThanOrEqual(2);
  // Months per entry, end minus start (the owner counts 06/2023 - 02/2024 as 8).
  const bbe = raw.find((c) => c.id === "role-bbe-ldc")!.period!;
  const [sy, sm] = bbe.start.split("-").map(Number) as [number, number];
  const [ey, em] = bbe.end!.split("-").map(Number) as [number, number];
  await expect(page.locator("#claim-role-bbe-ldc .row__dur")).toHaveText(`${ey * 12 + em - (sy * 12 + sm)} ${ui.durationUnit.vi}`);
});

test("14.2 each evidence bar fills as many cells as its tier; the text stays for screen readers", async ({ page }) => {
  await setMode(page, "giai-mat");
  await page.goto("/vi/");
  for (const c of open) {
    const tier = page.locator(`#claim-${c.id} .row__tier`);
    await expect(tier.locator(".tier-meter i.is-on")).toHaveCount(tierOf(c));
    await expect(tier).toContainText(`T${tierOf(c)}`);
    expect(await tier.textContent()).toContain(ui.evidenceHeading.vi); // word kept, only visually hidden
  }
});

for (const deficiency of ["achromatopsia", "deuteranopia", "protanopia", "tritanopia"] as const) {
  test(`14.2 colour-blind check (${deficiency}): filled and empty cells still differ in lightness`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await setMode(page, "giai-mat");
    await page.goto("/vi/");
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setEmulatedVisionDeficiency", { type: deficiency });
    const legend = page.locator("[data-tier-legend] li");
    await legend.first().scrollIntoViewIfNeeded(); // clips are taken in the viewport
    // Inside of one cell (border excluded), as grey level 0-255.
    const grey = async (cell: ReturnType<Page["locator"]>) => {
      const b = (await cell.boundingBox())!;
      const png = await page.screenshot({ clip: { x: b.x + 1.5, y: b.y + 1.5, width: b.width - 3, height: b.height - 3 } });
      return (await sharp(png).greyscale().stats()).channels[0]!.mean;
    };
    // The T2 bar has both kinds of cell: filled ones must read clearly darker than the empty one.
    const cells = legend.nth(1).locator(".tier-meter i");
    const [a, b, empty] = [await grey(cells.nth(0)), await grey(cells.nth(1)), await grey(cells.nth(2))];
    expect(empty - a).toBeGreaterThan(60);
    expect(empty - b).toBeGreaterThan(60);
    await legend.first().locator("..").screenshot({ path: `test-results/screenshots/p14-tiers-${deficiency}.png` });
  });
}

test("20.3 header figures: Giai mat only; with no owner metric, the tier spread alone", async ({ page }) => {
  expect(JSON.parse(readFileSync("content/metrics.json", "utf8"))).toEqual([]);
  await setMode(page, "mat");
  await page.goto("/vi/");
  await expect(page.locator("[data-stats]")).toBeHidden();
  await page.locator("[data-mode-toggle]").click();
  const board = page.locator("[data-stats]");
  await expect(board).toBeVisible();
  // "Entries on file" and "years on file" are gone: they measured the book, not the work.
  await expect(board.locator(".stats__cell")).toHaveCount(1);
  const t3 = open.filter((c) => tierOf(c) === 3).length;
  await expect(board.locator('[data-stat="t3"] .stats__num')).toHaveText(String(t3));
  const count = (n: number) => open.filter((c) => tierOf(c) === n).length;
  await expect(board.locator('[data-stat="t3"] .stats__note')).toHaveText(`T1 ${count(1)} · T2 ${count(2)} · T3 ${count(3)}`);
});

test.describe("owner metrics (fixture)", () => {
  test.use({ baseURL: FIXTURE });
  test("20.3 a metric shows its value, unit and source code, linked to its entry; notes never", async ({ page }) => {
    await setMode(page, "giai-mat");
    await page.goto("/vi/");
    const cell = page.locator('[data-metric="fx-metric-1"]');
    await expect(cell.locator("dt")).toHaveText("Chỉ số thử");
    await expect(cell.locator(".stats__num")).toHaveText(/^12\s+đơn vị$/);
    await expect(cell.locator(".stats__source")).toHaveText(`${ui.metricSource.vi}: 02`);
    await expect(cell.locator(".stats__source")).toHaveAttribute("href", "#claim-fx-pending");
    expect(await page.content()).not.toContain("METRIC-NOTES-SENTINEL");
  });
});

test("20.2 a paused entry shows 'paused', not a running length (ledger and one-page file)", async ({ page }) => {
  const paused = raw.filter((c) => c.paused && c.visibility !== "hold");
  expect(paused.map((c) => c.id)).toContain("role-bluesea");
  await setMode(page, "giai-mat");
  await page.goto("/vi/");
  for (const c of paused) {
    await expect(page.locator(`#claim-${c.id} .row__dur`)).toHaveText(ui.pausedLabel.vi);
  }
  await page.emulateMedia({ media: "print" });
  for (const c of paused) {
    const row = page.locator(`[data-onepage] [data-op-row="${c.id}"]`);
    await expect(row).toContainText(ui.pausedLabel.vi);
    await expect(row).not.toContainText(ui.durationUnit.vi);
  }
});
