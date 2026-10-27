import { expect, test } from "@playwright/test";

// ROADMAP 19.2 / UX-v2 section 6: things that must never come (back) onto the page.
const WORDS = [
  // money, growth, made-up performance
  "%", "₫", "$", "vnd", "usd", "lợi nhuận", "tăng trưởng", "doanh thu", "profit", "growth", "revenue",
  // real agencies and their marks
  "top secret", "noforn", "fbi", "cia", "nsa", "tuyệt mật", "tối mật",
];

for (const locale of ["vi", "en"]) {
  for (const mode of ["mat", "giai-mat"]) {
    test(`cut list holds on /${locale}/ in ${mode}`, async ({ page }) => {
      await page.addInitScript((m) => localStorage.setItem("mode", m), mode);
      await page.goto(`/${locale}/`);
      // No ticker, sound, video or other moving media.
      await expect(page.locator("marquee, audio, video, [autoplay]")).toHaveCount(0);
      // What a reader sees, words matched whole where they are words.
      const text = (await page.locator("body").innerText()).toLowerCase();
      for (const w of WORDS) {
        const hit = /^[\p{L}\s]+$/u.test(w) ? new RegExp(`(^|[^\\p{L}])${w}([^\\p{L}]|$)`, "u").test(text) : text.includes(w);
        expect(hit, w).toBe(false);
      }
      // Nothing loops forever, even after scrolling through the page.
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(2500);
      const endless = await page.evaluate(() =>
        document.getAnimations().filter((a) => (a.effect as KeyframeEffect).getComputedTiming().iterations === Infinity).length,
      );
      expect(endless).toBe(0);
    });
  }
}
