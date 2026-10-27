import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

// Owner decision after P20 (DECISIONS-v3.md): the positioning line and risks 02-03 come in a Mat
// wording and a plain (Giai mat) one. The plain one is what print, search and no-JS readers get.
const identity = JSON.parse(readFileSync("content/identity.json", "utf8"));
const risks = JSON.parse(readFileSync("content/risks.json", "utf8")) as Array<{
  id: string;
  risk: Record<string, string>;
  mitigation: Record<string, string>;
  mat?: { risk: Record<string, string>; mitigation: Record<string, string> };
}>;
const setMode = (page: Page, mode: string) => page.addInitScript((m) => localStorage.setItem("mode", m), mode);

for (const locale of ["vi", "en"] as const) {
  test(`positioning: Mat wording in Mat, plain wording in Giai mat (${locale})`, async ({ page }) => {
    expect(identity.positioningMat).toBeTruthy();
    await setMode(page, "mat");
    await page.goto(`/${locale}/`);
    const line = page.locator(".gate__positioning:visible");
    await expect(line).toHaveCount(1);
    await expect(line).toHaveText(identity.positioningMat[locale]);
    await page.locator("[data-mode-toggle]").click();
    await expect(page.locator("html")).toHaveAttribute("data-mode", "giai-mat");
    await expect(line).toHaveText(identity.positioning[locale]);
  });

  test(`risks: Mat wording where there is one, plain in Giai mat (${locale})`, async ({ page }) => {
    await setMode(page, "mat");
    await page.goto(`/${locale}/`);
    const shown = (id: string) => page.locator(`[data-risk="${id}"] .risks__body:visible`);
    for (const r of risks) {
      await expect(shown(r.id)).toHaveCount(1);
      await expect(shown(r.id).locator(".risks__risk")).toContainText((r.mat ?? r).risk[locale]!);
    }
    await page.locator("[data-mode-toggle]").click();
    await expect(page.locator("html")).toHaveAttribute("data-mode", "giai-mat");
    for (const r of risks) await expect(shown(r.id).locator(".risks__mitigation")).toContainText(r.mitigation[locale]!);
  });
}

test("print, search and no-JS readers get the plain wording", async ({ page, browser }) => {
  await setMode(page, "mat");
  await page.goto("/vi/");
  await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", identity.positioning.vi);
  await page.emulateMedia({ media: "print" });
  await expect(page.locator("[data-onepage] .op__positioning")).toHaveText(identity.positioning.vi);
  const text = (await page.locator("[data-onepage]").textContent())!;
  expect(text).not.toContain(identity.positioningMat.vi);
  for (const r of risks) if (r.mat) expect(text).not.toContain(r.mat.risk.vi);

  const noJs = await browser.newContext({ javaScriptEnabled: false });
  const p = await noJs.newPage();
  await p.goto(new URL("/vi/", page.url()).href);
  await expect(p.locator(".gate__positioning:visible")).toHaveText(identity.positioning.vi);
  await noJs.close();
});
