import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

// ROADMAP 5.1: /vi/ and /en/ with the right lang (and dir) attributes; "/" leads to /vi/.
const identity = JSON.parse(readFileSync("content/identity.json", "utf8"));
const ui = JSON.parse(readFileSync("content/ui.json", "utf8"));

for (const locale of ["vi", "en"] as const) {
  test(`/${locale}/ has lang="${locale}", dir="ltr" and ${locale} content`, async ({ page }) => {
    await page.goto(`/${locale}/`);
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
    await expect(page.locator("[data-gate]")).toContainText(identity.positioning[locale]);
    await expect(page.locator("[data-mode-toggle]")).toHaveText(ui.modeGiaiMat[locale]);
    await expect(page.locator("#ledger-heading")).toHaveText(ui.ledgerHeading[locale]);
    await expect(page.locator(".footer__updated")).toContainText(ui.updatedLabel[locale]);
    const alternates = await page.locator('link[rel="alternate"]').evaluateAll((ls) =>
      ls.map((l) => `${l.getAttribute("hreflang")} ${l.getAttribute("href")}`),
    );
    expect(alternates).toEqual(["vi /vi/", "en /en/"]);
  });
}

test("language links point to the same page in the other locale, named in that language", async ({ page }) => {
  await page.goto("/vi/");
  const link = page.locator("[data-lang-switch]");
  await expect(link).toHaveAttribute("href", "/en/");
  await expect(link).toHaveAttribute("hreflang", "en");
  await expect(link).toHaveAttribute("lang", "en");
  await expect(link).toHaveText(ui.languageName.en);
});

test('"/" redirects to /vi/', async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/vi\/$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "vi");
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });
  test('"/" still redirects, and the language link is a plain link', async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/vi\/$/);
    await page.locator("[data-lang-switch]").click();
    await expect(page).toHaveURL(/\/en\/$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  });
});

// Regression: evidence notes were a plain string and stayed Vietnamese on /en/.
test("evidence notes follow the page language (real content)", async ({ page }) => {
  const claims = JSON.parse(readFileSync("content/claims.json", "utf8")) as Array<{
    visibility?: string;
    evidence?: { note: { vi: string; en: string } }[];
  }>;
  const notes = claims.filter((c) => c.visibility === "open").flatMap((c) => c.evidence ?? []).map((e) => e.note);
  expect(notes.length).toBeGreaterThan(0);
  for (const locale of ["vi", "en"] as const) {
    const other = locale === "vi" ? "en" : "vi";
    await page.goto(`/${locale}/`);
    const text = await page.evaluate(() => document.body.textContent ?? "");
    expect(notes.filter((n) => !text.includes(n[locale]))).toEqual([]);
    expect(notes.filter((n) => n[other] !== n[locale] && text.includes(n[other]))).toEqual([]);
  }
});
