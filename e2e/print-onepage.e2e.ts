import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

// P18: the one-page file. Print gives one A4 page, Giai mat, from the same content/.
const raw = JSON.parse(readFileSync("content/claims.json", "utf8")) as Array<{
  id: string;
  kind: string;
  visibility?: string;
  label?: { vi: string; en: string };
  org?: { vi: string; en: string } | null;
  title?: { vi: string; en: string } | null;
}>;
const ui = JSON.parse(readFileSync("content/ui.json", "utf8"));
const printJson = JSON.parse(readFileSync("content/print.json", "utf8"));
const open = raw.filter((c) => c.kind !== "classified" && c.visibility !== "hold");
const left = raw.filter((c) => c.kind === "classified" || c.visibility === "hold");

for (const locale of ["vi", "en"] as const) {
  test(`18.1 print to PDF (${locale}): exactly one A4 page, Giai mat, no hold or classified entry`, async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("mode", "mat")); // even from Mat
    await page.goto(`/${locale}/`);
    await page.evaluate(() => document.fonts.ready);
    await page.emulateMedia({ media: "print" });

    const sheet = page.locator("[data-onepage]");
    await expect(sheet).toBeVisible();
    // Nothing else prints.
    for (const sel of ["[data-gate]", "[data-ledger]", "[data-map]", "[data-chart]", "header.controls", "[data-banner]"]) {
      await expect(page.locator(sel).first(), sel).toBeHidden();
    }
    // Giai mat: the legal name, the struck-out level.
    await expect(sheet.locator(".op__legal")).toBeVisible();
    await expect(sheet.locator(".op__strip s")).toHaveText(ui.modeMat[locale]);
    // Every open entry, nothing else.
    expect(await sheet.locator("[data-op-row]").evaluateAll((rs) => rs.map((r) => r.getAttribute("data-op-row")))).toEqual(
      open.map((c) => c.id),
    );
    const text = (await sheet.textContent())!;
    for (const c of left) {
      for (const s of [c.label?.[locale], c.org?.[locale], c.title?.[locale]]) if (s) expect(text, `${c.id}: ${s}`).not.toContain(s);
    }

    // Real PDF: count its pages.
    const pdf = await page.pdf({ format: "A4", preferCSSPageSize: true, printBackground: true });
    const pages = pdf.toString("latin1").match(/\/Type\s*\/Page(?!s)/g) ?? [];
    expect(pages.length).toBe(1);
    await page.screenshot({ path: `test-results/screenshots/p18-print-${locale}.png`, fullPage: true });
    const { writeFileSync } = await import("node:fs");
    writeFileSync(`test-results/p18-onepage-${locale}.pdf`, pdf);
  });
}

test("18.1 on screen the one-page file stays hidden", async ({ page }) => {
  await page.goto("/vi/");
  await expect(page.locator("[data-onepage]")).toBeHidden();
});

test("18.2 approved by the owner: the button shows and opens the print dialog", async ({ page }) => {
  expect(printJson.approval).toMatchObject({ on: "2026-10-27" });
  await page.addInitScript(() => {
    (window as unknown as { __prints: number }).__prints = 0;
    window.print = () => void (window as unknown as { __prints: number }).__prints++;
  });
  await page.goto("/vi/");
  const button = page.locator("[data-print-button]");
  await expect(button).toBeVisible();
  await expect(button).toHaveText(ui.printButton.vi);
  await button.click();
  expect(await page.evaluate(() => (window as unknown as { __prints: number }).__prints)).toBe(1);
  // The approval record itself is internal: never on the page.
  expect(await page.content()).not.toContain(printJson.approval.by);
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });
  test("18.2 no button (it could not do anything)", async ({ page }) => {
    await page.goto("/vi/");
    await expect(page.locator("[data-print-cta]")).toBeHidden();
  });
});
