import { expect, test, type Page } from "./test";

// ROADMAP 1.4 / SPEC section 5: mode switch without effects.
const html = (page: Page) => page.locator("html");
const toggle = (page: Page) => page.locator("[data-mode-toggle]");
const live = (page: Page) => page.locator("[data-mode-live]");

test("defaults to Mat, ignoring prefers-color-scheme", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/vi/");
  await expect(html(page)).toHaveAttribute("data-mode", "mat");
  await expect(toggle(page)).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(10, 10, 11)");
});

test("saved mode is applied before first paint", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("mode", "giai-mat");
    // Record data-mode the moment <body> is created and on the first animation frame,
    // both of which happen before anything is painted.
    const w = window as unknown as { __seen: (string | undefined)[] };
    w.__seen = [];
    new MutationObserver((_, obs) => {
      if (document.body) {
        w.__seen.push(document.documentElement.dataset["mode"]);
        obs.disconnect();
      }
    }).observe(document, { childList: true, subtree: true });
    requestAnimationFrame(() => w.__seen.push(document.documentElement.dataset["mode"]));
  });
  await page.goto("/vi/");
  const seen = await page.evaluate(() => (window as unknown as { __seen: string[] }).__seen);
  expect(seen).toEqual(["giai-mat", "giai-mat"]);
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(243, 241, 234)");
  await expect(toggle(page)).toHaveAttribute("aria-pressed", "true");
});

test("Tab then Enter/Space switch mode, announce it, keep focus, and persist", async ({ page }) => {
  await page.goto("/vi/");
  // The language switch (VI, EN) comes first, at the start of the control bar.
  await page.keyboard.press("Tab");
  await expect(page.locator("[data-lang-switch=\"vi\"]")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.locator("[data-lang-switch=\"en\"]")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(toggle(page)).toBeFocused();

  await page.keyboard.press("Enter");
  await expect(html(page)).toHaveAttribute("data-mode", "giai-mat");
  await expect(toggle(page)).toHaveAttribute("aria-pressed", "true");
  await expect(live(page)).toHaveText("Chế độ Giải mật");
  await expect(toggle(page)).toBeFocused();

  await page.reload();
  await expect(html(page)).toHaveAttribute("data-mode", "giai-mat");

  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Space");
  await expect(html(page)).toHaveAttribute("data-mode", "mat");
  await expect(live(page)).toHaveText("Chế độ Mật");
  expect(await page.evaluate(() => localStorage.getItem("mode"))).toBe("mat");
});

test("still works when storage is blocked", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new DOMException("blocked", "SecurityError");
      },
    });
  });
  await page.goto("/vi/");
  await expect(html(page)).toHaveAttribute("data-mode", "mat");
  await toggle(page).click();
  await expect(html(page)).toHaveAttribute("data-mode", "giai-mat");
  await expect(live(page)).toHaveText("Chế độ Giải mật");
  expect(errors).toEqual([]);
});

test("ignores an invalid saved value", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("mode", "<script>"));
  await page.goto("/vi/");
  await expect(html(page)).toHaveAttribute("data-mode", "mat");
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });
  test("shows Mat and no mode switch", async ({ page }) => {
    await page.goto("/vi/");
    await expect(html(page)).toHaveAttribute("data-mode", "mat");
    await expect(toggle(page)).toBeHidden();
  });
});
