import { expect, test, type Page } from "@playwright/test";
import { FIXTURE, SITE } from "../playwright.config";

// ROADMAP 3.3 / 3.4 on the test dataset (e2e/fixtures/claims.json).
test.use({ baseURL: FIXTURE });

const row = (page: Page, id: string) => page.locator(`#claim-${id}`);
const toggle = (page: Page, id: string) => row(page, id).locator("[data-row-toggle]");

test("Mat shows org, title and period of every open entry (SPEC section 5)", async ({ page }) => {
  await page.goto("/vi/");
  await expect(page.locator("html")).toHaveAttribute("data-mode", "mat");
  await expect(row(page, "fx-verified")).toContainText("Tổ chức Thử Một");
  await expect(row(page, "fx-verified")).toContainText("Vai trò thử");
  await expect(row(page, "fx-verified")).toContainText("01/2023 – nay");
  await expect(row(page, "fx-pending")).toContainText("Dự án thử");
  await expect(row(page, "fx-pending")).toContainText("2021 – 06/2022");
  await expect(row(page, "fx-plain")).toContainText("Trường thử");
  await expect(page.locator("#claim-fx-hold")).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText("HOLD-SENTINEL");
});

test("rows follow the order of claims.json, coded 01, 02 ...", async ({ page }) => {
  await page.goto("/vi/");
  const ids = await page.locator("[data-claim]").evaluateAll((els) => els.map((e) => e.getAttribute("data-claim")));
  expect(ids).toEqual(["fx-verified", "fx-pending", "fx-plain", "fx-classified", "fx-extra-1", "fx-extra-2", "fx-extra-3"]);
  await expect(page.locator(".row__code")).toHaveText(["01", "02", "03", "04", "05", "06", "07"]);
});

for (const base of [FIXTURE, SITE]) {
  test(`desktop: org/title column lines up with or without a period (${base})`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${base}/vi/`);
    const xs = await page.locator(".row__main").evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().x)));
    expect(xs.length).toBeGreaterThan(3);
    expect(new Set(xs).size).toBe(1);
  });
}

test("rows start closed and open/close with Enter and Space (aria-expanded)", async ({ page }) => {
  await page.goto("/vi/");
  const t = toggle(page, "fx-verified");
  await expect(t).toHaveAttribute("aria-expanded", "false");
  await expect(row(page, "fx-verified").locator(".row__teaser")).toBeHidden();

  await t.focus();
  await page.keyboard.press("Enter");
  await expect(t).toHaveAttribute("aria-expanded", "true");
  await expect(row(page, "fx-verified").locator(".row__teaser")).toBeVisible();
  await expect(t).toBeFocused();

  await page.keyboard.press("Space");
  await expect(t).toHaveAttribute("aria-expanded", "false");
  await expect(row(page, "fx-verified").locator(".row__teaser")).toBeHidden();
});

test("Tab skips the content of closed rows and follows reading order", async ({ page }) => {
  await page.goto("/vi/");
  await toggle(page, "fx-verified").focus();
  await page.keyboard.press("Tab");
  await expect(toggle(page, "fx-pending")).toBeFocused();

  await page.keyboard.press("Enter");
  await page.keyboard.press("Tab");
  await expect(row(page, "fx-pending").locator("[data-declassify]")).toBeFocused();
});

test("Mat: open row shows teaser and redaction, not the summary or evidence", async ({ page }) => {
  await page.goto("/vi/");
  await toggle(page, "fx-verified").click();
  const r = row(page, "fx-verified");
  await expect(r.locator(".row__teaser")).toBeVisible();
  await expect(r.locator(".redaction svg")).toBeVisible();
  await expect(r.locator(".row__summary")).toBeHidden();
  await expect(r.locator(".row__evidence")).toBeHidden();
});

test("classified row only ever says it is not open by request", async ({ page }) => {
  await page.goto("/vi/");
  const r = row(page, "fx-classified");
  await expect(r.locator(".redaction svg")).toHaveAttribute("aria-label", "Hồ sơ thử — bảo mật theo nghề");
  await toggle(page, "fx-classified").click();
  await expect(r.locator(".row__closed")).toHaveText("Hồ sơ này không mở theo yêu cầu.");
  await page.locator("[data-mode-toggle]").click();
  await expect(r.locator(".row__closed")).toHaveText("Hồ sơ này không mở theo yêu cầu.");
  await expect(r.locator("[data-declassify]")).toHaveCount(0);
});

test("View declassified: switches mode, opens and scrolls to the row, keeps focus there", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 600 });
  await page.goto("/vi/");
  await toggle(page, "fx-pending").click();
  const link = row(page, "fx-pending").locator("[data-declassify]");
  await link.focus();
  await page.keyboard.press("Enter");

  await expect(page.locator("html")).toHaveAttribute("data-mode", "giai-mat");
  await expect(page.locator("[data-mode-live]")).toHaveText("Chế độ Giải mật");
  await expect(row(page, "fx-pending").locator(".row__summary")).toBeVisible();
  await expect(row(page, "fx-pending").locator(".row__summary")).toHaveText("Tóm tắt thử nghiệm số hai.");
  await expect(toggle(page, "fx-pending")).toBeFocused();
  await expect(toggle(page, "fx-pending")).toHaveAttribute("aria-expanded", "true");
  await expect(toggle(page, "fx-pending")).toBeInViewport();
  expect(page.url()).toContain("#claim-fx-pending");
});

test("Giai mat shows summary and evidence links", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("mode", "giai-mat"));
  await page.goto("/vi/");
  await toggle(page, "fx-verified").click();
  const r = row(page, "fx-verified");
  await expect(r.locator(".row__summary")).toBeVisible();
  await expect(r.locator(".row__evidence a")).toHaveAttribute("href", "https://example.com/evidence");
  await expect(r.locator(".redaction")).toBeHidden();
  await expect(r.locator(".row__tier")).toHaveText("Bằng chứng T3");
});

test("print opens every row in its Giai mat version", async ({ page }) => {
  await page.goto("/vi/");
  await page.emulateMedia({ media: "print" });
  await expect(row(page, "fx-pending").locator(".row__summary")).toBeVisible();
  await expect(row(page, "fx-pending").locator(".redaction")).toBeHidden();
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });
  test("every public row is readable, in its Giai mat version", async ({ page }) => {
    await page.goto("/vi/");
    await expect(row(page, "fx-verified").locator(".row__summary")).toBeVisible();
    await expect(row(page, "fx-verified").locator(".row__evidence")).toBeVisible();
    await expect(row(page, "fx-pending").locator(".row__summary")).toBeVisible();
    await expect(row(page, "fx-pending").locator(".redaction")).toBeHidden();
  });
});

test("9.2 teaser in Mat only, summary in Giai mat only (never both)", async ({ page }) => {
  await page.goto(`${FIXTURE}/vi/`);
  await toggle(page, "fx-verified").click();
  const r = row(page, "fx-verified");
  await expect(r.locator(".row__teaser")).toBeVisible();
  await expect(r.locator(".row__summary")).toBeHidden();
  await page.locator("[data-mode-toggle]").click();
  await expect(r.locator(".row__summary")).toBeVisible();
  await expect(r.locator(".row__teaser")).toBeHidden();
});

test("9.3 redaction and link only where a summary exists", async ({ page }) => {
  await page.goto(`${FIXTURE}/vi/`);
  for (const id of ["fx-pending", "fx-plain"]) await toggle(page, id).click();
  await expect(row(page, "fx-pending").locator(".redaction")).toBeVisible();
  await expect(row(page, "fx-pending").locator("[data-declassify]")).toBeVisible();
  await expect(row(page, "fx-plain").locator(".row__teaser")).toBeVisible();
  await expect(row(page, "fx-plain").locator(".redaction, [data-declassify]")).toHaveCount(0);
  await page.screenshot({ path: "test-results/screenshots/p9-ledger-mat.png", fullPage: true });
});
