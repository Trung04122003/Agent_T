import { expect, test, type Page } from "@playwright/test";
import { FIXTURE } from "../playwright.config";

// UX-v2 section 1 (ROADMAP 12.2-12.3): at most 2 effects running at once, each <= 600 ms.
// An "effect" is a group of animations that read as one thing: the reveal (View Transition),
// the redaction bars, the FLIP of ledger rows, or one named CSS/WAAPI animation.

type Sample = { max: number; groups: string[]; longest: number; longestName: string };

async function startSampling(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { __s: { max: number; groups: string[]; longest: number; longestName: string }; __stop: boolean };
    w.__s = { max: 0, groups: [], longest: 0, longestName: "" };
    w.__stop = false;
    const key = (a: Animation): string => {
      const e = a.effect as KeyframeEffect;
      if (e.pseudoElement?.startsWith("::view-transition")) return "reveal";
      const t = e.target as Element | null;
      if (t?.classList.contains("bar-anim")) return "bars";
      if (t?.hasAttribute("data-claim")) return "flip";
      const name = (a as CSSAnimation).animationName;
      if (name) return `css:${name}`;
      const props = Object.keys(e.getKeyframes()[0] ?? {}).filter((k) => !["offset", "computedOffset", "easing", "composite"].includes(k));
      return `js:${t?.className.toString().split(" ")[0] ?? t?.tagName}:${props.join("+")}`;
    };
    const tick = () => {
      // Only animations actually moving now: past their delay and not yet finished.
      const running = document.getAnimations().filter((a) => {
        if (a.playState !== "running") return false;
        const t = (a.effect as KeyframeEffect).getComputedTiming();
        const local = Number(t.localTime);
        return local >= Number(t.delay) && local < Number(t.delay) + Number(t.activeDuration);
      });
      const groups = [...new Set(running.map(key))];
      if (groups.length > w.__s.max) w.__s = { ...w.__s, max: groups.length, groups };
      for (const a of running) {
        const d = Number((a.effect as KeyframeEffect).getComputedTiming().duration);
        if (d > w.__s.longest) w.__s = { ...w.__s, longest: d, longestName: key(a) };
      }
      if (!w.__stop) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}
async function stopSampling(page: Page, ms = 1600): Promise<Sample> {
  await page.waitForTimeout(ms);
  return page.evaluate(() => {
    const w = window as unknown as { __s: Sample; __stop: boolean };
    w.__stop = true;
    return w.__s;
  });
}
function check(name: string, s: Sample) {
  test.info().annotations.push({
    type: "budget",
    description: `${name}: max ${s.max} [${s.groups.join(", ")}], longest ${Math.round(s.longest)} ms (${s.longestName})`,
  });
  expect(s.max, `${name}: ${s.groups.join(", ")}`).toBeLessThanOrEqual(2);
  expect(s.longest, `${name}: ${s.longestName}`).toBeLessThanOrEqual(600);
}

test("mode change on the Gate screen", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/vi/");
  await startSampling(page);
  await page.locator("[data-mode-toggle]").click();
  check("Gate open", await stopSampling(page));
  await startSampling(page);
  await page.locator("[data-mode-toggle]").click();
  check("Gate close", await stopSampling(page));
});

test("View declassified link", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${FIXTURE}/vi/`);
  await page.locator("#claim-fx-pending [data-row-toggle]").click();
  await page.waitForTimeout(400);
  await startSampling(page);
  await page.locator("#claim-fx-pending [data-declassify]").click();
  check("declassify link", await stopSampling(page));
});

test("lens change", async ({ page }) => {
  await page.goto("/vi/");
  await page.locator("[data-lens-nav]").scrollIntoViewIfNeeded();
  await startSampling(page);
  await page.locator('[data-lens="curious"]').click();
  check("lens", await stopSampling(page));
});

test("language change", async ({ page }) => {
  await page.goto("/vi/");
  await startSampling(page);
  await page.locator("[data-lang-switch]:not([aria-current])").click();
  check("language", await stopSampling(page));
});

test("map reveal", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/vi/");
  await startSampling(page);
  await page.locator("[data-map]").scrollIntoViewIfNeeded();
  check("map", await stopSampling(page, 2500));
});
