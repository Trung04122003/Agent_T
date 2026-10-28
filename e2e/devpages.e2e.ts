import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "./test";
import { DEV } from "../playwright.config";
import { gotoStable } from "./helpers";

const identity = JSON.parse(readFileSync("content/identity.json", "utf8"));

// ROADMAP 2.4: legal-name options page exists under `astro dev` only.
test("legal-name options: three options, full name in Giai mat", async ({ page }) => {
  await gotoStable(page, `${DEV}/dev/name`);
  await expect(page.locator("[data-option]")).toHaveCount(3);
  const legal = (id: string) => page.locator(`[data-option="${id}"] .legal`);

  await expect(legal("a")).toHaveText(identity.legalName);
  await expect(legal("b").locator(".redact")).toBeVisible();
  await expect(legal("b")).not.toContainText(identity.legalName, { useInnerText: true });
  await expect(legal("c")).toHaveText("L. T. T.", { useInnerText: true });

  await page.locator("[data-mode-toggle]").click();
  for (const id of ["a", "b", "c"]) await expect(legal(id)).toHaveText(identity.legalName, { useInnerText: true });
  await page.screenshot({ path: "test-results/screenshots/name-options-giai-mat.png", fullPage: true });
  await page.locator("[data-mode-toggle]").click();
  await page.screenshot({ path: "test-results/screenshots/name-options-mat.png", fullPage: true });
});

test("dist/ contains no dev-only route or asset", () => {
  // webServer runs `pnpm build` before the tests, so dist/ is fresh.
  const files = readdirSync("dist", { recursive: true }).map(String);
  expect(files.length).toBeGreaterThan(0);
  expect(files.filter((f) => /(^|[\\/])dev([\\/]|$)/.test(f) || /playfair|name-options/i.test(f))).toEqual([]);
  const html = files.filter((f) => f.endsWith(".html"));
  expect(html.map((f) => f.replace(/\\/g, "/")).sort()).toEqual(["404.html", "en/index.html", "index.html", "vi/index.html"]);
  for (const f of html) {
    const body = readFileSync(join("dist", f), "utf8");
    expect(body).not.toContain("/dev/");
    expect(body).not.toContain("L. T. T.");
  }
});
