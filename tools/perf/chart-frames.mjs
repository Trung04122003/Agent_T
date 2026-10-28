// Frame times while the pointer scrubs the commitment chart (ROADMAP 23.2,
// docs/performance-playbook.md). Serves the build:prod output with astro preview and, in
// Playwright's Chromium, moves the mouse across the chart plot left to right and back four times
// (~240 small moves), recording every rAF interval. CPU 1x and 4x, Mat and Giai mat, 3 runs each,
// median reported. Thresholds: p95 <= 20 ms (1x), <= 40 ms (4x).
// Usage: node tools/perf/chart-frames.mjs [--build] [--label before|after]
//   (results in .perf/chart-frames-<label>.json)
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

process.env["PLAYWRIGHT_BROWSERS_PATH"] ??= join("F:", "\\", "Dev", "Data", "playwright");
const { chromium } = await import("@playwright/test");

const root = resolve(fileURLToPath(import.meta.url), "..", "..", "..");
const PORT = 4334;
const RUNS = 3;
const THRESHOLD = { 1: 20, 4: 40 };
const label = process.argv.includes("--label") ? process.argv[process.argv.indexOf("--label") + 1] : "run";

if (process.argv.includes("--build")) {
  if (spawnSync("pnpm build:prod", { shell: true, stdio: "inherit", cwd: root }).status !== 0) process.exit(1);
}
const server = spawn(`pnpm exec astro preview --port ${PORT} --ignore-lock`, { shell: true, cwd: root });
await new Promise((ok, fail) => {
  const timer = setTimeout(() => fail(new Error("preview did not start")), 60_000);
  server.stdout.on("data", (d) => String(d).includes(`localhost:${PORT}`) && (clearTimeout(timer), ok()));
});

const q = (xs, k) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(k * xs.length))];

async function run(browser, { cpu, mode }) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  // Measure the page, not the entry gate (P25): a reader who passed it this session.
  await context.addInitScript(() => sessionStorage.setItem("gateSeen", "1"));
  await context.addInitScript((m) => localStorage.setItem("mode", m), mode);
  const page = await context.newPage();
  await page.goto(`http://localhost:${PORT}/vi/`);
  await page.evaluate(() => document.fonts.ready);
  await page.locator("[data-chart]").evaluate((e) => e.scrollIntoView({ block: "center" }));
  const box = await page.locator("[data-chart-plot]").boundingBox();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: cpu });
  await page.evaluate(() => {
    window.__frames = [];
    let last = performance.now();
    const tick = (t) => {
      window.__frames.push(t - last);
      last = t;
      if (!window.__stop) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  const y = box.y + box.height / 2;
  for (let pass = 0; pass < 4; pass++) {
    for (let i = 0; i <= 60; i++) {
      const k = pass % 2 ? 60 - i : i;
      await page.mouse.move(box.x + 4 + ((box.width - 8) * k) / 60, y + ((i % 7) - 3) * 6);
    }
  }
  await page.waitForTimeout(300);
  const frames = await page.evaluate(() => ((window.__stop = true), window.__frames.slice(5)));
  await context.close();
  return { p95: q(frames, 0.95), max: Math.max(...frames), long: frames.filter((f) => f > 33.4).length, frames: frames.length };
}

const browser = await chromium.launch();
const results = [];
try {
  for (const mode of ["mat", "giai-mat"]) {
    for (const cpu of [1, 4]) {
      const runs = [];
      for (let r = 0; r < RUNS; r++) runs.push(await run(browser, { cpu, mode }));
      const row = { label, mode, cpu: `${cpu}x` };
      for (const k of Object.keys(runs[0])) row[k] = Math.round(q(runs.map((x) => x[k]), 0.5) * 10) / 10;
      row.pass = row.p95 <= THRESHOLD[cpu];
      results.push(row);
      console.log(JSON.stringify(row));
    }
  }
} finally {
  await browser.close();
  spawnSync("taskkill", ["/pid", String(server.pid), "/T", "/F"], { stdio: "ignore" });
}
mkdirSync(join(root, ".perf"), { recursive: true });
writeFileSync(join(root, ".perf", `chart-frames-${label}.json`), JSON.stringify(results, null, 2));
process.exit(results.every((r) => r.pass) ? 0 : 1);
