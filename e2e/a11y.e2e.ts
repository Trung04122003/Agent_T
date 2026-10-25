import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// ROADMAP 8.2: axe on whole pages (both languages, both modes, rows open) and a keyboard pass.
for (const locale of ["vi", "en"] as const) {
  for (const mode of ["mat", "giai-mat"] as const) {
    test(`axe: no serious or critical issue on /${locale}/ in ${mode}`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.addInitScript((m) => localStorage.setItem("mode", m), mode);
      await page.goto(`/${locale}/`);
      // Open every row so panel content (summaries, links, redactions) is checked too.
      for (const t of await page.locator("[data-row-toggle]").all()) await t.click();
      const { violations } = await new AxeBuilder({ page }).analyze();
      const blocking = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(blocking.map((v) => `${v.impact} ${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
      // Minor or moderate findings are listed in the report, not hidden.
      test.info().annotations.push({ type: "axe-other", description: violations.map((v) => `${v.impact} ${v.id}`).join("; ") || "none" });
    });
  }
}

test("keyboard: Tab reaches every control in reading order, each with a visible focus ring", async ({ page }) => {
  await page.goto("/vi/");
  const seen: { key: string; top: number; outline: string }[] = [];
  for (let i = 0; i < 80; i++) {
    await page.keyboard.press("Tab");
    const info = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return null;
      const cs = getComputedStyle(el);
      const key =
        el.getAttribute("data-claim") ??
        el.closest("[data-claim]")?.getAttribute("data-claim") ??
        el.getAttribute("data-lens") ??
        (el.hasAttribute("data-mode-toggle") ? "mode" : null) ??
        el.textContent?.trim().slice(0, 30) ??
        el.tagName;
      return { key: `${el.tagName}:${key}`, top: el.getBoundingClientRect().top + scrollY, outline: `${cs.outlineStyle} ${cs.outlineWidth}` };
    });
    if (!info) break; // wrapped past the end
    if (seen.some((s) => s.key === info.key)) break;
    seen.push(info);
  }
  const keys = seen.map((s) => s.key);
  const rowToggles = await page.locator("[data-row-toggle]").count();
  expect(keys.some((k) => k.startsWith("A:") && k.includes("English"))).toBe(true); // language switch
  expect(keys).toContain("BUTTON:mode");
  expect(keys.filter((k) => k.startsWith("BUTTON:partner") || k.startsWith("BUTTON:client") || k.startsWith("BUTTON:curious"))).toHaveLength(3);
  expect(keys.filter((k) => /^BUTTON:(edu|role|project|classified)/.test(k))).toHaveLength(rowToggles);
  expect(keys.some((k) => k.includes("Made with Natural Earth"))).toBe(true);
  // Reading order: positions never jump back up the page (the control bar comes first).
  const tops = seen.slice(2).map((s) => s.top);
  for (let i = 1; i < tops.length; i++) expect(tops[i]!).toBeGreaterThanOrEqual(tops[i - 1]! - 1);
  for (const s of seen) expect(s.outline, s.key).toMatch(/^solid [1-9]/);
});
