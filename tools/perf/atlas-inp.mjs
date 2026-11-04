// INP of opening and closing the real map from the city (ROADMAP-v4 41.3, docs/performance-playbook.md):
// the longest interaction, input to next paint, from the browser's Event Timing API (what web-vitals
// reads; that library is not installed here), as tools/perf/gate-inp.mjs does. Three interactions per
// run: a click on the Atlas table (Agent T walks there and dives: the click itself is measured), Esc
// to come back, and the "real map" button (the overlay at once). The machine's GPU; CPU 1x and 4x,
// 3 runs each, median. Threshold INP <= 200 ms.
// Usage: node tools/perf/atlas-inp.mjs [url]   (default http://localhost:4324)
import { join } from "node:path";

process.env["PLAYWRIGHT_BROWSERS_PATH"] ??= join("F:", "\\", "Dev", "Data", "playwright");
const { chromium } = await import("@playwright/test");

const base = process.argv[2] ?? "http://localhost:4324";
const RUNS = 3;
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const browser = await chromium.launch({ args: process.env["CITY_GPU"] !== "0" ? ["--use-angle=d3d11", "--ignore-gpu-blocklist", "--enable-gpu"] : [] });

async function run(rate) {
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  await page.addInitScript(() => {
    localStorage.setItem("mode", "mat");
    localStorage.setItem("cursorFx", "system");
    window.__inp = [];
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) if (e.interactionId) window.__inp.push([e.name, e.duration]);
    }).observe({ type: "event", durationThreshold: 16, buffered: true });
  });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate });
  await page.goto(`${base}/vi/city/`);
  await page.waitForFunction(() => document.querySelector("[data-city-stage]")?.getAttribute("data-atlas") === "ready", null, { timeout: 30_000 });
  await page.waitForFunction(() => document.querySelector("[data-city-stage]")?.getAttribute("data-entrance") === "done", null, { timeout: 30_000 });
  const stage = page.locator("[data-city-stage]");
  await stage.scrollIntoViewIfNeeded();
  const b = await page.evaluate(() => document.querySelector(".city-layer--top").atlasBeacon());
  const worst = async (fn) => {
    await page.evaluate(() => (window.__inp = []));
    await fn();
    await page.waitForTimeout(400);
    return Math.max(0, ...(await page.evaluate(() => window.__inp.map((x) => x[1]))));
  };
  const dive = await worst(async () => {
    await stage.click({ position: { x: b.x, y: b.y + 10 } });
    await page.waitForFunction(() => document.querySelector("dialog[data-brief='atlas']")?.open, null, { timeout: 30_000 });
  });
  const back = await worst(async () => {
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.querySelector("dialog[data-brief='atlas']")?.open);
  });
  const button = await worst(async () => {
    await page.locator("[data-atlas-open]").click();
    await page.waitForFunction(() => document.querySelector("dialog[data-brief='atlas']")?.open);
  });
  await page.close();
  return { dive, back, button };
}

for (const rate of [1, 4]) {
  const runs = [];
  for (let i = 0; i < RUNS; i++) runs.push(await run(rate));
  const m = (k) => median(runs.map((r) => r[k]));
  console.log(`CPU ${rate}x: INP click on the table ${m("dive")} ms, Esc back ${m("back")} ms, "real map" button ${m("button")} ms (threshold 200)`);
}
await browser.close();
