// Frame cost of opening/closing ledger rows (ROADMAP 20.7, docs/performance-playbook.md).
// Builds with build:prod, serves with astro preview, then in Playwright's Chromium opens and
// closes every toggleable row while recording rAF frame times and the browser's layout work
// (CDP Performance metrics). Runs at CPU 1x and 4x, 3 runs each, median reported, and once more
// with the row transition switched off to isolate what the transition itself costs.
// Usage: node tools/perf/ledger-frames.mjs [--no-build]   (results in .perf/ledger-frames.json)
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

process.env["PLAYWRIGHT_BROWSERS_PATH"] ??= join("F:", "\\", "Dev", "Data", "playwright");
const { chromium } = await import("@playwright/test");

const root = resolve(fileURLToPath(import.meta.url), "..", "..", "..");
const PORT = 4331;
const RUNS = 3;
const THRESHOLD = { 1: 20, 4: 40 }; // p95 frame time, ms (playbook section 1)

if (!process.argv.includes("--no-build")) {
  if (spawnSync("pnpm build:prod", { shell: true, stdio: "inherit", cwd: root }).status !== 0) process.exit(1);
}
const server = spawn(`pnpm exec astro preview --port ${PORT} --ignore-lock`, { shell: true, cwd: root });
await new Promise((ok, fail) => {
  const timer = setTimeout(() => fail(new Error("preview did not start")), 60_000);
  server.stdout.on("data", (d) => String(d).includes(`localhost:${PORT}`) && (clearTimeout(timer), ok()));
});

const p = (xs, q) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))];
};
const median = (xs) => p(xs, 0.5);

async function run(browser, { cpu, transition, viewport }) {
  const page = await browser.newPage({ viewport });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Performance.enable");
  // Measure the ledger, not the entry gate (P25): ?skip=1 opens the page past it.
  await page.goto(`http://localhost:${PORT}/vi/?skip=1`);
  await page.evaluate(() => document.fonts.ready);
  if (!transition) await page.addStyleTag({ content: ".row__panel{transition:none!important}" });
  const toggles = page.locator("[data-row-toggle]");
  const n = await toggles.count();
  await toggles.first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: cpu });
  const metric = async () => Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map((m) => [m.name, m.value]));
  const before = await metric();
  await page.evaluate(() => {
    const w = window;
    w.__frames = [];
    let last = performance.now();
    const tick = (t) => {
      w.__frames.push(t - last);
      last = t;
      if (!w.__stop) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  for (let i = 0; i < n; i++) {
    await toggles.nth(i).click();
    await page.waitForTimeout(400);
    await toggles.nth(i).click();
    await page.waitForTimeout(400);
  }
  const frames = await page.evaluate(() => ((window.__stop = true), window.__frames.slice(2)));
  const after = await metric();
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  await page.close();
  return {
    p95: p(frames, 0.95),
    max: Math.max(...frames),
    long: frames.filter((f) => f > 33.4).length,
    frames: frames.length,
    layouts: after.LayoutCount - before.LayoutCount,
    layoutMs: (after.LayoutDuration - before.LayoutDuration) * 1000,
    styleMs: (after.RecalcStyleDuration - before.RecalcStyleDuration) * 1000,
    toggles: n * 2,
  };
}

const browser = await chromium.launch();
const results = [];
try {
  for (const viewport of [{ width: 1280, height: 900 }, { width: 375, height: 812 }]) {
    for (const cpu of [1, 4]) {
      for (const transition of [true, false]) {
        const runs = [];
        for (let r = 0; r < RUNS; r++) runs.push(await run(browser, { cpu, transition, viewport }));
        const row = { viewport: `${viewport.width}px`, cpu: `${cpu}x`, transition };
        for (const k of Object.keys(runs[0])) row[k] = Math.round(median(runs.map((x) => x[k])) * 10) / 10;
        row.pass = !transition || row.p95 <= THRESHOLD[cpu];
        results.push(row);
        console.log(JSON.stringify(row));
      }
    }
  }
} finally {
  await browser.close();
  server.kill();
  spawnSync("taskkill", ["/pid", String(server.pid), "/T", "/F"], { stdio: "ignore" });
}
mkdirSync(join(root, ".perf"), { recursive: true });
writeFileSync(join(root, ".perf", "ledger-frames.json"), JSON.stringify(results, null, 2));
if (results.some((r) => !r.pass)) {
  console.error("ledger-frames: p95 frame time over the playbook threshold with the transition on");
  process.exit(1);
}
