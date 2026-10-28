import { expect, test } from "./test";

// ROADMAP 1.5 / UX section 4: print is always Giai mat, without controls.
test("print media shows Giai mat and no mode switch, even when Mat is active", async ({ page }) => {
  await page.goto("/vi/");
  await expect(page.locator("html")).toHaveAttribute("data-mode", "mat");
  await expect(page.locator("[data-mode-toggle]")).toBeVisible();

  await page.emulateMedia({ media: "print" });
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(243, 241, 234)");
  await expect(page.locator("body")).toHaveCSS("color", "rgb(17, 17, 17)");
  await expect(page.locator("[data-mode-toggle]")).toBeHidden();
  await expect(page.locator("header.controls")).toBeHidden();

  await page.emulateMedia({ media: "screen" });
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(10, 10, 11)");
});
