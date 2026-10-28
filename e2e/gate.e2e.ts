import { readFileSync } from "node:fs";
import { expect, test } from "./test";

// ROADMAP 2.1: Gate shows codename and positioning from content/, and nothing that is not in content/.
const read = (name: string) => JSON.parse(readFileSync(`content/${name}`, "utf8"));
const identity = read("identity.json");
const ui = read("ui.json");

/** Every displayable vi string in identity.json and ui.json (notes excluded). */
function allowedStrings(): Set<string> {
  const out = new Set<string>();
  const walk = (v: unknown, key = ""): void => {
    if (key === "notes" || key === "en") return;
    if (typeof v === "string") out.add(v.trim());
    else if (Array.isArray(v)) v.forEach((x) => walk(x));
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) walk(x, k);
  };
  walk(identity);
  walk(ui);
  walk(JSON.parse(readFileSync("content/lenses.json", "utf8"))); // the readers' own lines (P25)
  return out;
}

test("Gate shows codename, legal name and positioning from content/", async ({ page }) => {
  await page.goto("/vi/");
  const gate = page.locator("[data-level0]");
  await expect(gate.locator("h1")).toHaveText("Cupid");
  await expect(gate).toContainText(identity.legalName);
  await expect(gate).toContainText(identity.positioning.vi);
  await expect(gate).toContainText(ui.codenameLabel.vi);
  await expect(gate).toContainText(ui.gateScrollHint.vi);
  await expect(gate).not.toContainText(identity.positioning.notes);
});

// Legal name, option B: bar in Mat, name in Giai mat; name visible without JS and in print.
const legal = (page: import("@playwright/test").Page) => page.locator("[data-legal-name]");

test("Mat: legal name is covered by a text-free bar", async ({ page }) => {
  await page.goto("/vi/");
  const bar = legal(page).locator(".redact");
  await expect(bar).toBeVisible();
  await expect(bar).toHaveAttribute("role", "img");
  await expect(bar).toHaveAttribute("aria-label", ui.legalNameRedacted.vi);
  expect(await bar.evaluate((el) => el.textContent)).toBe("");
  await expect(legal(page).locator(".gate__legal-name")).toBeHidden();
  await expect(bar).toHaveCSS("background-color", "rgb(122, 115, 95)");
});

test("Giai mat: legal name shown in place, no bar", async ({ page }) => {
  await page.goto("/vi/");
  await page.locator("[data-mode-toggle]").click();
  await expect(legal(page).locator(".gate__legal-name")).toBeVisible();
  await expect(legal(page).locator(".gate__legal-name")).toHaveText(identity.legalName);
  await expect(legal(page).locator(".redact")).toBeHidden();
});

test("print shows the legal name even when Mat is active (one-page file, P18)", async ({ page }) => {
  await page.goto("/vi/");
  await page.emulateMedia({ media: "print" });
  await expect(page.locator("[data-onepage] .op__legal")).toHaveText(identity.legalName);
  await expect(page.locator("[data-onepage] .redact")).toHaveCount(0);
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });
  test("legal name is readable (no way to reach Giai mat)", async ({ page }) => {
    await page.goto("/vi/");
    await expect(legal(page).locator(".gate__legal-name")).toBeVisible();
    await expect(legal(page).locator(".redact")).toBeHidden();
  });
});

test("Gate contains no text that is missing from content/", async ({ page }) => {
  await page.goto("/vi/");
  const texts = await page.locator("[data-level0]").evaluate((root) => {
    const found: string[] = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const s = n.textContent?.trim();
      if (s) found.push(s);
    }
    for (const el of root.querySelectorAll("[alt], [aria-label], [title]")) {
      for (const a of ["alt", "aria-label", "title"]) {
        const v = el.getAttribute(a)?.trim();
        if (v) found.push(v);
      }
    }
    return found;
  });
  expect(texts.length).toBeGreaterThan(0);
  const allowed = allowedStrings();
  // Built surface only (ROADMAP 13.2): the file number (codename + build yymm) and the page mark.
  const codename = (await page.locator("#gate-codename").textContent())!.trim();
  const fileNo = new RegExp(`^${codename.toUpperCase()}-\\d{4}$`);
  allowed.add(`${ui.pageLabel.vi} 1/3`);
  expect(texts.filter((s) => !allowed.has(s) && !fileNo.test(s))).toEqual([]);
});
