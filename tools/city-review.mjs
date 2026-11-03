// Owner-review screenshots of Agent T City (ROADMAP-v4 rule 9): fixed camera, both modes, into
// docs/city/review/<phase>/. Run against a flag-on build in preview, and optionally the dev server
// for the dev-only city sheet:
//   node tools/city-review.mjs <phase> <preview-url> [dev-url]
// e.g. node tools/city-review.mjs P34 http://localhost:4324 http://localhost:4325
// Browsers come from drive F (same path as scripts/playwright.mjs).
import { mkdirSync } from "node:fs";
import { join } from "node:path";

process.env["PLAYWRIGHT_BROWSERS_PATH"] ??= join("F:", "\\", "Dev", "Data", "playwright");
const { chromium } = await import("@playwright/test");

const [phase, site, dev] = process.argv.slice(2);
if (!phase || !site) {
  console.error("usage: node tools/city-review.mjs <phase> <preview-url> [dev-url]");
  process.exit(1);
}
const out = join("docs", "city", "review", phase);
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const shots = [];
for (const mode of ["mat", "giai-mat"]) {
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 }, deviceScaleFactor: 1 });
  await context.addInitScript((m) => {
    localStorage.setItem("mode", m);
    localStorage.setItem("cursorFx", "system"); // the dossier's cursor layer stays out of the shots
  }, mode);
  const page = await context.newPage();
  await page.goto(`${site}/vi/city/`);
  const stage = page.locator("[data-city-stage]");
  await page.waitForFunction(() => performance.getEntriesByName("city:first-frame").length > 0);
  await stage.focus();
  // Middle zoom over the plaza (the opening view), then the far step.
  for (const [name, keys] of [["plaza", []], ["far", ["-"]]]) {
    for (const k of keys) await page.keyboard.press(k);
    await page.waitForTimeout(400);
    const file = join(out, `city-${name}-${mode}.png`);
    await stage.screenshot({ path: file });
    shots.push(file);
  }
  if (mode === "mat") {
    // Signature moments (UX-v4 section 11): 1, the lantern's cone cut by buildings (the mouse aims it
    // up and left, past the kiosk); 8, rain on the glass tower (High tier, the lantern on the tower).
    await page.goto(`${site}/vi/city/`);
    await page.waitForFunction(() => performance.getEntriesByName("city:first-frame").length > 0);
    await stage.hover({ position: { x: 150, y: 150 } });
    await page.waitForTimeout(500);
    const m1 = join(out, "moment-1-lantern.png");
    await stage.screenshot({ path: m1 });
    shots.push(m1);
    await page.goto(`${site}/vi/city/?quality=high`);
    await page.waitForFunction(() => performance.getEntriesByName("city:first-frame").length > 0);
    await stage.hover({ position: { x: 560, y: 400 } });
    await page.waitForTimeout(800);
    const m8 = join(out, "moment-8-rain.png");
    await stage.screenshot({ path: m8 });
    shots.push(m8);
  }
  // The Lite view, drawn from the same plan.
  await page.goto(`${site}/vi/city/?lite`);
  const lite = join(out, `city-lite-${mode}.png`);
  await page.locator("[data-city-lite]").screenshot({ path: lite });
  shots.push(lite);
  await context.close();
}
if (dev) {
  const page = await browser.newPage({ viewport: { width: 1640, height: 900 }, deviceScaleFactor: 1 });
  await page.goto(`${dev}/dev/city-sheet`);
  await page.waitForSelector("[data-city-sheet] canvas");
  const file = join(out, "city-sheet.png");
  await page.locator("[data-city-sheet]").screenshot({ path: file });
  shots.push(file);
}
await browser.close();
console.log(shots.join("\n"));
