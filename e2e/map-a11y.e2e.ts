import { readFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./test";

// ROADMAP 6.4: screen readers get a text list (the legend) instead of the drawing; axe finds no issue.
const places = JSON.parse(readFileSync("content/places.json", "utf8")) as Array<{
  role: "origin" | "current" | "home";
  label: { vi: string; en: string };
  region: { vi: string; en: string } | null;
}>;
const ui = JSON.parse(readFileSync("content/ui.json", "utf8"));

for (const locale of ["vi", "en"] as const) {
  test(`map text alternative lists every place and both archipelagos (${locale})`, async ({ page }) => {
    await page.goto(`/${locale}/`);
    const map = page.locator("[data-map]");
    await expect(map.locator("svg")).toHaveAttribute("aria-hidden", "true");
    await expect(map.getByRole("heading", { level: 2 })).toHaveText(ui.mapTitle[locale]);
    // What a screen reader reads: the accessible list, in order.
    const items = map.getByRole("list").getByRole("listitem");
    await expect(items).toHaveText([
      ...places.map((p) => {
        const name = p.region ? `${p.label[locale]}, ${p.region[locale]}` : p.label[locale];
        return `${name} — ${ui[{ origin: "placeRoleOrigin", current: "placeRoleCurrent", home: "placeRoleHome" }[p.role]][locale]}`;
      }),
      ui.hoangSaLabel[locale],
      ui.truongSaLabel[locale],
    ]);
  });
}

test("axe: no accessibility violations in the map section", async ({ page }) => {
  await page.goto("/vi/");
  await page.locator("[data-map]").scrollIntoViewIfNeeded();
  const result = await new AxeBuilder({ page }).include("[data-map]").analyze();
  expect(result.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
});
