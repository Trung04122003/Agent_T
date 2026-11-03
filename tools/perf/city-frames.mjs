// Agent T City frame times (ROADMAP-v4 rule 3-4, docs/performance-playbook.md): on a flag-on build in
// preview, page /vi/city/, Mat. Each run: first frame after DOM ready, then 6 s of Agent T walking
// with the arrow keys, the camera following (new chunks bake while it moves, the lantern's mask is
// rebuilt every frame) and a zoom out and in; rAF intervals give p95 and long
// frames. Reports the tier, the bake counters the stage exposes, and the JS heap. 1x and 4x CPU, median
// of 3 runs. Usage: node tools/perf/city-frames.mjs [url] [query]   (default http://localhost:4324)
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

process.env["PLAYWRIGHT_BROWSERS_PATH"] ??= join("F:", "\\", "Dev", "Data", "playwright");
const { chromium } = await import("@playwright/test");

const base = process.argv[2] ?? "http://localhost:4324";
/** Extra query, e.g. "?quality=high" to measure the High tier (rain) on purpose. */
const query = process.argv[3] ?? "";
const RUNS = 3;
const viewports = [
  [1366, 768],
  [1920, 1080],
];
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const p95 = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length * 0.95)];

async function run(browser, [w, h], rate) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate });
  await page.addInitScript(() => {
    localStorage.setItem("mode", "mat");
    window.__frames = [];
    let last = performance.now();
    const tick = (t) => {
      window.__frames.push(t - last);
      last = t;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await page.goto(`${base}/vi/city/${query}`);
  await page.waitForFunction(() => performance.getEntriesByName("city:first-frame").length > 0, null, { timeout: 30_000 });
  const firstFrame = await page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0];
    return performance.getEntriesByName("city:first-frame")[0].startTime - nav.domContentLoadedEventEnd;
  });
  const stage = page.locator("[data-city-stage]");
  await stage.scrollIntoViewIfNeeded();
  await stage.focus();
  // Since P36 the arrow keys walk Agent T (the camera follows): let his entrance finish first.
  await page.waitForFunction(() => document.querySelector("[data-city-stage]")?.getAttribute("data-entrance") === "done", null, { timeout: 10_000 });
  await page.evaluate(() => (window.__frames = []));
  for (const key of ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"]) {
    await page.keyboard.down(key);
    await page.waitForTimeout(1200);
    await page.keyboard.up(key);
  }
  await page.keyboard.press("-");
  await page.waitForTimeout(600);
  await page.keyboard.press("+");
  await page.waitForTimeout(600);
  const frames = (await page.evaluate(() => window.__frames)).slice(5);
  const info = await stage.evaluate((el) => ({ ...el.dataset }));
  const heap = (await cdp.send("Runtime.getHeapUsage")).usedSize;
  await page.close();
  return {
    firstFrame,
    p95: p95(frames),
    max: Math.max(...frames),
    long: frames.filter((f) => f > 33.4).length,
    frames: frames.length,
    tier: info.tier,
    chunks: Number(info.bakeChunks),
    bakeMs: Number(info.bakeMs),
    bakeMax: Number(info.bakeMax),
    backing: Number(info.backing),
    heapMB: heap / 1048576,
  };
}

const browser = await chromium.launch();
const rows = [];
for (const vp of viewports) {
  for (const rate of [1, 4]) {
    const runs = [];
    for (let i = 0; i < RUNS; i++) runs.push(await run(browser, vp, rate));
    const m = (k) => median(runs.map((r) => r[k]));
    const row = {
      viewport: `${vp[0]}x${vp[1]}`,
      cpu: `${rate}x`,
      firstFrame: m("firstFrame"),
      p95: m("p95"),
      max: m("max"),
      long: m("long"),
      tier: runs.map((r) => r.tier).join("/"),
      chunks: m("chunks"),
      bakeAvg: m("bakeMs") / m("chunks"),
      bakeMax: m("bakeMax"),
      backingMB: m("backing") / 1048576,
      heapMB: m("heapMB"),
    };
    rows.push(row);
    console.log(
      `${row.viewport} ${row.cpu}: first frame ${row.firstFrame.toFixed(0)} ms, p95 ${row.p95.toFixed(1)} ms, max ${row.max.toFixed(1)} ms, >33 ms ${row.long}, tier ${row.tier}, chunks ${row.chunks}, bake avg ${row.bakeAvg.toFixed(1)} ms max ${row.bakeMax.toFixed(1)} ms, backing ${row.backingMB.toFixed(1)} MB, heap ${row.heapMB.toFixed(1)} MB`,
    );
  }
}
await browser.close();
mkdirSync(".perf", { recursive: true });
writeFileSync(join(".perf", `city-frames${query ? "-" + query.replace(/[^a-z0-9]+/gi, "-") : ""}.json`), JSON.stringify(rows, null, 2));
