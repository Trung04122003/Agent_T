// INP of entering through the gate (ROADMAP 26.5, docs/performance-playbook.md). INP comes from
// the browser's Event Timing API (what the web-vitals library reads; not installed here): the
// longest interaction duration, input to next paint. Also reports how long the gate takes to
// close (26.1: <= 700 ms), from the click to the "gate:entered" mark, or to data-gate="skip" on
// builds without that mark.
// Serves the build:prod output; first view of /vi/, click "Client". Desktop 1280x800 (aperture)
// and phone Pixel 5 (fade), CPU 1x and 4x, 3 runs each, median reported. Threshold INP <= 200 ms.
// Usage: node tools/perf/gate-inp.mjs [--build] [--label before|after]  (.perf/gate-inp-<label>.json)
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

process.env["PLAYWRIGHT_BROWSERS_PATH"] ??= join("F:", "\\", "Dev", "Data", "playwright");
const { chromium, devices } = await import("@playwright/test");

const root = resolve(fileURLToPath(import.meta.url), "..", "..", "..");
const PORT = 4338;
const RUNS = 3;
const label = process.argv.includes("--label") ? process.argv[process.argv.indexOf("--label") + 1] : "run";

if (process.argv.includes("--build")) {
  if (spawnSync("pnpm build:prod", { shell: true, stdio: "inherit", cwd: root }).status !== 0) process.exit(1);
}
const server = spawn(`pnpm exec astro preview --port ${PORT} --ignore-lock`, { shell: true, cwd: root });
await new Promise((ok, fail) => {
  const timer = setTimeout(() => fail(new Error("preview did not start")), 60_000);
  server.stdout.on("data", (d) => String(d).includes(`localhost:${PORT}`) && (clearTimeout(timer), ok()));
});

const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

async function run(browser, device, cpu) {
  const context = await browser.newContext(device === "desktop" ? { viewport: { width: 1280, height: 800 } } : { ...devices["Pixel 5"] });
  await context.addInitScript(() => {
    window.__inp = 0;
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) if (e.interactionId) window.__inp = Math.max(window.__inp, e.duration);
    }).observe({ type: "event", durationThreshold: 16, buffered: true });
  });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: cpu });
  await page.goto(`http://localhost:${PORT}/vi/`);
  const lens = page.locator('[data-entry-lens="client"]');
  await lens.waitFor({ state: "visible" });
  await page.waitForTimeout(1500); // the gate's opening is over
  const t0 = await page.evaluate(() => performance.now());
  if (device === "desktop") await lens.click();
  else await lens.tap();
  await page.waitForFunction(() => document.documentElement.dataset["gate"] === "skip" && !document.documentElement.dataset["vt"]);
  const closed = await page.evaluate(() => performance.getEntriesByName("gate:entered")[0]?.startTime ?? performance.now());
  const ready = await page.evaluate(() => performance.getEntriesByName("gate:aperture-ready")[0]?.startTime ?? null);
  await page.waitForTimeout(400); // let late event entries arrive
  const inp = await page.evaluate(() => window.__inp);
  await context.close();
  return { inp, close: closed - t0, ready: ready === null ? 0 : ready - t0 };
}

const browser = await chromium.launch();
const results = [];
try {
  for (const device of ["desktop", "phone"]) {
    for (const cpu of [1, 4]) {
      const runs = [];
      for (let r = 0; r < RUNS; r++) runs.push(await run(browser, device, cpu));
      const row = { label, device, cpu: `${cpu}x`, inp: Math.round(median(runs.map((x) => x.inp))), close: Math.round(median(runs.map((x) => x.close))), ready: Math.round(median(runs.map((x) => x.ready))) };
      row.pass = row.inp <= 200;
      results.push(row);
      console.log(JSON.stringify(row));
    }
  }
} finally {
  await browser.close();
  spawnSync("taskkill", ["/pid", String(server.pid), "/T", "/F"], { stdio: "ignore" });
}
mkdirSync(join(root, ".perf"), { recursive: true });
writeFileSync(join(root, ".perf", `gate-inp-${label}.json`), JSON.stringify(results, null, 2));
