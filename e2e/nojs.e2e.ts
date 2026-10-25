import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

// ROADMAP 8.1: with JavaScript off, every public entry is readable (UX section 1, principle 1).
type L = { vi: string; en: string };
type Claim = {
  id: string;
  kind: string;
  visibility?: string;
  org?: L | null;
  title?: L | null;
  teaser?: L | null;
  summary?: L | null;
  label?: L;
  evidence?: { note: L }[];
};
const claims = JSON.parse(readFileSync("content/claims.json", "utf8")) as Claim[];
const identity = JSON.parse(readFileSync("content/identity.json", "utf8"));
const places = JSON.parse(readFileSync("content/places.json", "utf8")) as { label: L }[];

test.use({ javaScriptEnabled: false });

for (const locale of ["vi", "en"] as const) {
  test(`every public string is visible without JS (${locale})`, async ({ page }) => {
    await page.goto(`/${locale}/`);
    const expected: string[] = [identity.legalName, identity.positioning[locale], ...places.map((p) => p.label[locale])];
    for (const c of claims) {
      if (c.kind === "classified") expected.push(c.label![locale]);
      else if (c.visibility === "open") {
        for (const k of ["org", "title", "teaser", "summary"] as const) if (c[k]) expected.push(c[k]![locale]);
        for (const e of c.evidence ?? []) expected.push(e.note[locale]);
      }
    }
    // innerText only contains what is rendered and visible (it applies text-transform: compare lower case).
    const norm = (s: string) => s.replace(/\s+/g, " ").toLocaleLowerCase(locale);
    const visible = norm(await page.evaluate(() => document.body.innerText));
    expect(expected.filter((s) => !visible.includes(norm(s)))).toEqual([]);
    // Hidden entries stay out entirely.
    for (const c of claims.filter((x) => x.visibility === "hold")) {
      await expect(page.locator(`#claim-${c.id}`)).toHaveCount(0);
    }
    // No control that needs JS is offered.
    await expect(page.locator("[data-mode-toggle]")).toBeHidden();
    await expect(page.locator("[data-lens-nav]")).toBeHidden();
  });
}
