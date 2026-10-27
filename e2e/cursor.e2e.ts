import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { DEV } from "../playwright.config";
import { gotoStable } from "./helpers";

// P21: CSS cursors. Real OS cursors (no lag), pointer devices only, a fallback keyword last,
// per mode, switchable to the system cursors, the choice stored and applied before paint.
const cursor = (page: Page, sel: string) => page.locator(sel).first().evaluate((e) => getComputedStyle(e).cursor);
const setMode = (page: Page, mode: string) => page.addInitScript((m) => localStorage.setItem("mode", m), mode);

test("21.1 the four cursor files: 32x32 with explicit size, centred, a 1px contrast halo", () => {
  for (const [file, halo] of [
    ["mat", "#0a0a0b"],
    ["mat-target", "#0a0a0b"],
    ["giai", "#f3f1ea"],
    ["giai-target", "#f3f1ea"],
  ] as const) {
    const svg = readFileSync(`public/cursors/${file}.svg`, "utf8");
    expect(svg, file).toMatch(/<svg[^>]*width="32"[^>]*height="32"/);
    expect(svg, file).toMatch(/viewBox="0 0 32 32"/);
    // Halo: a 3px stroke in the contrast colour under the 1px drawing (1px either side).
    expect(svg, file).toContain(`stroke="${halo}" stroke-width="3"`);
    expect(svg, file).toContain('stroke-width="1"');
    expect(Buffer.byteLength(svg), file).toBeLessThan(1500);
  }
});

test("21.2 Mat and Giai mat each get their own cursor, targets a second one, a fallback keyword last", async ({ page }) => {
  await setMode(page, "mat");
  await page.goto("/vi/");
  expect(await cursor(page, "body")).toMatch(/^url\(".*\/cursors\/mat\.svg"\) 16 16, crosshair$/);
  expect(await cursor(page, "[data-mode-toggle]")).toMatch(/\/cursors\/mat-target\.svg"\) 16 16, pointer$/);
  expect(await cursor(page, "[data-row-toggle] .row__org")).toMatch(/mat-target\.svg/); // inside a target
  expect(await cursor(page, ".gate__positioning")).toBe("text"); // selectable text keeps the I-beam

  await page.locator("[data-mode-toggle]").click();
  await expect(page.locator("html")).toHaveAttribute("data-mode", "giai-mat");
  expect(await cursor(page, "body")).toMatch(/\/cursors\/giai\.svg"\) 16 16, crosshair$/);
  expect(await cursor(page, "[data-mode-toggle]")).toMatch(/\/cursors\/giai-target\.svg"\) 16 16, pointer$/);
});

test("21.2 data-cursor=\"system\" leaves the system cursors alone", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("cursorFx", "system"));
  await page.goto("/vi/");
  await expect(page.locator("html")).toHaveAttribute("data-cursor", "system");
  expect(await cursor(page, "body")).not.toContain("url(");
  expect(await cursor(page, "[data-mode-toggle]")).not.toContain("url(");
  // Never `cursor: none`, whatever the setting.
  expect(await cursor(page, "body")).not.toBe("none");
});

test.describe("on a touch device", () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 375, height: 812 } });
  test("21.3 no custom cursor without a fine pointer that hovers", async ({ page }) => {
    await page.goto("/vi/");
    expect(await page.evaluate(() => matchMedia("(hover: hover) and (pointer: fine)").matches)).toBe(false);
    expect(await cursor(page, "body")).not.toContain("url(");
    expect(await cursor(page, "[data-mode-toggle]")).not.toContain("url(");
  });
});

test("21.4 the choice is stored, applied before paint, and toggled on the dev page", async ({ page }) => {
  // Before paint: the attribute is already there when the first script of the body could run.
  await page.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      (window as unknown as { __early: string | undefined }).__early = document.documentElement.dataset["cursor"];
    });
  });
  await gotoStable(page, `${DEV}/dev/cursor`);
  expect(await page.evaluate(() => (window as unknown as { __early?: string }).__early)).toBe("custom");
  await expect(page.locator("[data-cursor-state]")).toHaveText("custom");

  await page.locator("[data-cursor-switch]").click();
  await expect(page.locator("html")).toHaveAttribute("data-cursor", "system");
  expect(await page.evaluate(() => localStorage.getItem("cursorFx"))).toBe("system");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-cursor", "system");
  await expect(page.locator("[data-cursor-state]")).toHaveText("system");

  await page.locator("[data-cursor-switch]").click();
  await expect(page.locator("html")).toHaveAttribute("data-cursor", "custom");
});

test("21.4 blocked storage: renders with the default cursor, the switch still works, no error", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    const deny = () => {
      throw new DOMException("blocked", "SecurityError");
    };
    Storage.prototype.getItem = deny;
    Storage.prototype.setItem = deny;
  });
  await gotoStable(page, `${DEV}/dev/cursor`);
  await expect(page.locator("html")).toHaveAttribute("data-cursor", "custom");
  expect(await cursor(page, "body")).toContain("url(");
  await page.locator("[data-cursor-switch]").click();
  await expect(page.locator("html")).toHaveAttribute("data-cursor", "system");
  expect(errors).toEqual([]);
});

test("21.1 bench screenshot: the four cursors on every ground, both modes", async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 900 });
  for (const mode of ["mat", "giai-mat"]) {
    await page.addInitScript((m) => localStorage.setItem("mode", m), mode);
    await gotoStable(page, `${DEV}/dev/cursor`);
    await page.evaluate((m) => (document.documentElement.dataset["mode"] = m), mode);
    await page.locator(".bench").screenshot({ path: `test-results/screenshots/p21-cursor-bench-${mode}.png` });
  }
});
