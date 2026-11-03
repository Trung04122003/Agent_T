// Agent T City per-frame allocation check (ROADMAP-v4 35.5): a Chromium trace of 5 s on the city with
// everything that runs every frame switched on (Mat, ?quality=high: rain over the darkness each frame,
// signs stirring), the mouse still. Counts young-generation collections (Scavenge) and reports the
// JS heap before and after: a frame loop that allocates shows up as scavenges every second or so.
// A second run moves the mouse (the light mask is rebuilt every frame); the Lite view of the same page
// (no canvas world) is the baseline.
// Usage: node tools/perf/city-alloc.mjs [url]   (default http://localhost:4324)
import { join } from "node:path";

process.env["PLAYWRIGHT_BROWSERS_PATH"] ??= join("F:", "\\", "Dev", "Data", "playwright");
const { chromium } = await import("@playwright/test");

const base = process.argv[2] ?? "http://localhost:4324";
const browser = await chromium.launch();

async function run(moving, query = "?quality=high") {
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 });
  await page.addInitScript(() => {
    localStorage.setItem("mode", "mat");
    localStorage.setItem("cursorFx", "system");
  });
  await page.goto(`${base}/vi/city/${query}`);
  if (query !== "?lite") await page.waitForFunction(() => performance.getEntriesByName("city:first-frame").length > 0);
  const stage = page.locator(query === "?lite" ? "[data-city-lite]" : "[data-city-stage]");
  await stage.scrollIntoViewIfNeeded();
  await stage.hover({ position: { x: 200, y: 150 } });
  await page.waitForTimeout(1500);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("HeapProfiler.collectGarbage");
  const before = (await cdp.send("Runtime.getHeapUsage")).usedSize;
  await browser.startTracing(page, { categories: ["devtools.timeline", "v8", "disabled-by-default-v8.gc"] });
  const t0 = Date.now();
  let i = 0;
  while (Date.now() - t0 < 5000) {
    if (moving) await stage.hover({ position: { x: 200 + ((i * 37) % 300), y: 150 + ((i * 23) % 200) } });
    else await page.waitForTimeout(250);
    i++;
  }
  const trace = JSON.parse((await browser.stopTracing()).toString("utf8"));
  const after = (await cdp.send("Runtime.getHeapUsage")).usedSize;
  const events = trace.traceEvents ?? trace;
  const scavenges = events.filter((e) => e.ph === "X" || e.ph === "B").filter((e) => /^(MinorGC|Scavenge|V8\.GCScavenger)$/.test(e.name)).length;
  const frames = await page.evaluate(() => document.querySelector("[data-city-stage]")?.dataset.rain);
  await page.close();
  return { moving, scavenges, heapBeforeMB: before / 1048576, heapAfterMB: after / 1048576, rain: frames };
}

{
  const r = await run(false, "?lite");
  console.log(`baseline, Lite view (same page, no canvas world): ${r.scavenges} scavenge(s) in 5 s, heap ${r.heapBeforeMB.toFixed(2)} -> ${r.heapAfterMB.toFixed(2)} MB`);
}
for (const moving of [false, true]) {
  const r = await run(moving);
  console.log(
    `${moving ? "mouse moving (mask rebuilt each frame)" : "mouse still (rain + darkness every frame)"}: ${r.scavenges} scavenge(s) in 5 s, heap ${r.heapBeforeMB.toFixed(2)} -> ${r.heapAfterMB.toFixed(2)} MB, rain ${r.rain}`,
  );
}
await browser.close();
