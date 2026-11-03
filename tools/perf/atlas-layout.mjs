// The Atlas ripple causes no layout (ROADMAP-v4 40.4): a Chromium trace of the mouse moving over the
// Atlas table for 3 s (provinces rising and settling under it), counting Layout and style recalc
// events. The ripple is canvas drawing only, so the count should be 0.
// Usage: node tools/perf/atlas-layout.mjs [url]   (default http://localhost:4324; the machine's GPU)
import { join } from "node:path";

process.env["PLAYWRIGHT_BROWSERS_PATH"] ??= join("F:", "\\", "Dev", "Data", "playwright");
const { chromium } = await import("@playwright/test");

const base = process.argv[2] ?? "http://localhost:4324";
const browser = await chromium.launch({ args: process.env["CITY_GPU"] !== "0" ? ["--use-angle=d3d11", "--ignore-gpu-blocklist", "--enable-gpu"] : [] });
const page = await browser.newPage({ viewport: { width: 1366, height: 900 }, deviceScaleFactor: 1 });
await page.addInitScript(() => {
  localStorage.setItem("mode", "mat");
  localStorage.setItem("cursorFx", "system");
});
await page.goto(`${base}/vi/city/`);
await page.waitForFunction(() => document.querySelector("[data-city-stage]")?.getAttribute("data-entrance") === "done", null, { timeout: 10_000 });
await page.waitForFunction(() => document.querySelector("[data-city-stage]")?.getAttribute("data-atlas") === "ready");
const stage = page.locator("[data-city-stage]");
await stage.scrollIntoViewIfNeeded();
await stage.focus();
await page.keyboard.press("+");
await page.waitForTimeout(800);
// The table: around the beacon's foot (Da Nang), where the provinces are.
const b = await page.evaluate(() => document.querySelector(".city-layer--top").atlasBeacon());
await stage.hover({ position: { x: b.x, y: b.y } });
await page.waitForTimeout(500);
await browser.startTracing(page, { categories: ["devtools.timeline"] });
const t0 = Date.now();
let i = 0;
while (Date.now() - t0 < 3000) {
  await stage.hover({ position: { x: b.x - 80 + ((i * 13) % 160), y: b.y - 40 + ((i * 7) % 80) } });
  await page.waitForTimeout(40);
  i++;
}
const trace = JSON.parse((await browser.stopTracing()).toString("utf8"));
const events = trace.traceEvents ?? trace;
const count = (name) => events.filter((e) => e.name === name && (e.ph === "X" || e.ph === "B")).length;
console.log(`pointer moves: ${i}; Layout: ${count("Layout")}; style recalc (UpdateLayoutTree): ${count("UpdateLayoutTree")}; paint: ${count("Paint")}`);
await browser.close();
