import { readFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { FIXTURE } from "../playwright.config";

// P17: owner-written blocks. The fixture site carries test content; the real site has none yet,
// so nothing of these blocks may appear there.
const ui = JSON.parse(readFileSync("content/ui.json", "utf8"));
const realRisks = JSON.parse(readFileSync("content/risks.json", "utf8")) as unknown[];
const setMode = (page: Page, mode: string) => page.addInitScript((m) => localStorage.setItem("mode", m), mode);
const open = (page: Page, id: string) => page.locator(`#claim-${id} [data-row-toggle]`).click();

test("17.1 tear sheet: written cells plus time and tier; an empty one does not render", async ({ page }) => {
  await setMode(page, "giai-mat");
  await page.goto(`${FIXTURE}/vi/`);
  await open(page, "fx-pending");
  const sheet = page.locator("#claim-fx-pending [data-tear-sheet]");
  await expect(sheet).toBeVisible();
  await expect(sheet.locator("[data-cell]")).toHaveCount(5);
  await expect(sheet.locator('[data-cell="role"] dd')).toHaveText("Vai trò thử");
  await expect(sheet.locator('[data-cell="scale"] dd')).toHaveText("Quy mô thử");
  await expect(sheet.locator('[data-cell="result"] dd')).toHaveText("Kết quả thử");
  await expect(sheet.locator('[data-cell="evidence"] dd')).toHaveText(/T1/);

  // fx-extra-1 has a tear sheet whose cells are all null: nothing, not even a heading.
  await open(page, "fx-extra-1");
  await expect(page.locator("#claim-fx-extra-1 [data-tear-sheet]")).toHaveCount(0);
  expect(await page.locator("#claim-fx-extra-1").textContent()).not.toContain(ui.tearSheetHeading.vi);
});

test("17.1 tear sheet is a Giai mat block", async ({ page }) => {
  await setMode(page, "mat");
  await page.goto(`${FIXTURE}/vi/`);
  await open(page, "fx-pending");
  await expect(page.locator("#claim-fx-pending [data-tear-sheet]")).toBeHidden();
});

test("17.2 AAR: Mat shows the label only, Giai mat opens the four fields in order", async ({ page }) => {
  await setMode(page, "mat");
  await page.goto(`${FIXTURE}/vi/`);
  await open(page, "fx-pending");
  const aar = page.locator("#claim-fx-pending [data-aar]");
  await expect(aar.locator(".aar__label")).toContainText(ui.aarHeading.vi);
  await expect(aar.locator(".aar__seal")).toBeVisible();
  await expect(aar.locator(".aar__grid")).toBeHidden();

  await page.locator("[data-mode-toggle]").click();
  await expect(page.locator("html")).toHaveAttribute("data-mode", "giai-mat");
  await expect(aar.locator(".aar__grid")).toBeVisible();
  await expect(aar.locator("dt")).toHaveText([ui.aarPlanned.vi, ui.aarActual.vi, ui.aarWhy.vi, ui.aarNext.vi]);
  await expect(aar.locator("dd")).toHaveText(["Dự định thử", "Thực tế thử", "Lý do thử", "Lần sau thử"]);
  await expect(aar.locator(".aar__seal")).toBeHidden();
});

test("17.3 limits and risks at the end of the page, in the owner's order, both modes", async ({ page }) => {
  await page.goto(`${FIXTURE}/en/`);
  const risks = page.locator("[data-risks]");
  await expect(risks.locator("#risks-heading")).toHaveText(ui.risksHeading.en);
  await expect(risks.locator(".risks__risk")).toHaveText([`${ui.riskLabel.en}: Test risk one.`, `${ui.riskLabel.en}: Test risk two.`]);
  await expect(risks.locator(".risks__mitigation")).toHaveText([
    `${ui.mitigationLabel.en}Test mitigation one.`,
    `${ui.mitigationLabel.en}Test mitigation two.`,
  ]);
  // Last section before the footer.
  const last = await page.evaluate(() => [...document.querySelectorAll("main > section")].at(-1)?.hasAttribute("data-risks"));
  expect(last).toBe(true);
});

test("never in the page: hold AAR text, risk notes", async ({ page }) => {
  for (const locale of ["vi", "en"]) {
    await page.goto(`${FIXTURE}/${locale}/`);
    const html = await page.content();
    expect(html).not.toContain("HOLD-AAR-SENTINEL");
    expect(html).not.toContain("RISK-NOTES-SENTINEL");
  }
});

test("the real site shows exactly the owner's blocks from content/, never their notes", async ({ page }) => {
  const claims = JSON.parse(readFileSync("content/claims.json", "utf8")) as Array<{
    id: string;
    visibility?: string;
    tearSheet?: Record<string, unknown> | null;
    aar?: unknown;
  }>;
  const shown = claims.filter((c) => c.visibility !== "hold");
  const withSheet = shown.filter((c) => c.tearSheet && Object.values(c.tearSheet).some(Boolean)).map((c) => c.id);
  const withAar = shown.filter((c) => c.aar).map((c) => c.id);
  await setMode(page, "giai-mat");
  await page.goto("/vi/");
  const ids = (sel: string) =>
    page.locator(sel).evaluateAll((els) => els.map((e) => e.closest("[data-claim]")!.getAttribute("data-claim")));
  expect(await ids("[data-tear-sheet]")).toEqual(withSheet);
  expect(await ids("[data-aar]")).toEqual(withAar);
  await expect(page.locator("[data-risk]")).toHaveCount(realRisks.length);
  const html = await page.content();
  for (const r of realRisks as { notes?: string }[]) if (r.notes) expect(html).not.toContain(r.notes);
});

test("axe: no violations in the owner blocks (fixture, rows open, Giai mat)", async ({ page }) => {
  await setMode(page, "giai-mat");
  await page.goto(`${FIXTURE}/vi/`);
  await open(page, "fx-pending");
  for (const sel of ["#claim-fx-pending", "[data-risks]"]) {
    const result = await new AxeBuilder({ page }).include(sel).analyze();
    expect(result.violations.map((v) => `${sel} ${v.id}: ${v.nodes.length}`)).toEqual([]);
  }
});
