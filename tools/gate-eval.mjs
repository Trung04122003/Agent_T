// Lab evaluation of the entry gate (ROADMAP P25; owner exception: measure the gate, locally).
// Serves the build:prod output, opens /vi/ as a first-time reader in three profiles and reads the
// gate's own event log (src/scripts/gate-metrics.ts) plus timings from the page:
//   skipReady   ms from navigation start until "Skip" is visible and can be clicked
//   lensesIn    ms until the lens buttons have finished coming in
//   lineShown   ms until the focused lens's line has typed out
//   actions     user actions it took to enter (target: 1)
//   enterToPage ms from that action until the gate is gone and the page heading has focus
//   events      the event types the gate logged, in order
// Profiles: desktop mouse (1280x800), desktop keyboard (Enter on the focused lens), phone touch
// (Pixel 5, CPU 4x). 3 runs each, median reported. Nothing is sent anywhere.
// Usage: node tools/gate-eval.mjs [--build]   (results in .perf/gate-eval.json)
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

process.env["PLAYWRIGHT_BROWSERS_PATH"] ??= join("F:", "\\", "Dev", "Data", "playwright");
const { chromium, devices } = await import("@playwright/test");

const root = resolve(fileURLToPath(import.meta.url), "..", "..");
const PORT = 4337;
const RUNS = 3;

if (process.argv.includes("--build")) {
  if (spawnSync("pnpm build:prod", { shell: true, stdio: "inherit", cwd: root }).status !== 0) process.exit(1);
}
const server = spawn(`pnpm exec astro preview --port ${PORT} --ignore-lock`, { shell: true, cwd: root });
await new Promise((ok, fail) => {
  const timer = setTimeout(() => fail(new Error("preview did not start")), 60_000);
  server.stdout.on("data", (d) => String(d).includes(`localhost:${PORT}`) && (clearTimeout(timer), ok()));
});

const PROFILES = {
  "desktop-mouse": { context: { viewport: { width: 1280, height: 800 } }, cpu: 1 },
  "desktop-keyboard": { context: { viewport: { width: 1280, height: 800 } }, cpu: 1 },
  "phone-touch": { context: { ...devices["Pixel 5"] }, cpu: 4 },
};
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

async function run(browser, name) {
  const { context: options, cpu } = PROFILES[name];
  const context = await browser.newContext(options);
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: cpu });
  await page.goto(`http://localhost:${PORT}/vi/`, { waitUntil: "commit" });
  const gate = page.locator("[data-entry]");
  await gate.locator("[data-entry-skip]").waitFor({ state: "visible" });
  const skipReady = await page.evaluate(() => performance.now());
  await page.waitForFunction(() => performance.getEntriesByName("gate:lenses-in").length > 0);
  const lensesIn = await page.evaluate(() => performance.getEntriesByName("gate:lenses-in")[0].startTime);
  // The line has typed out: its sweep is finished.
  await page.waitForFunction(() => {
    const line = document.querySelector("[data-entry-line]");
    return (line?.textContent ?? "") !== "" && line.getAnimations().every((a) => a.playState === "finished");
  });
  const lineShown = await page.evaluate(() => performance.now());

  const before = await page.evaluate(() => performance.now());
  let actions = 0;
  if (name === "desktop-mouse") (await gate.locator('[data-entry-lens="client"]').click(), actions++);
  if (name === "desktop-keyboard") (await page.keyboard.press("Enter"), actions++);
  if (name === "phone-touch") (await gate.locator('[data-entry-lens="curious"]').tap(), actions++);
  await page.waitForFunction(() => document.documentElement.dataset["gate"] === "skip" && document.activeElement?.id === "gate-codename");
  const enterToPage = (await page.evaluate(() => performance.now())) - before;
  const events = await page.evaluate(() => JSON.parse(localStorage.getItem("gateMetrics") ?? "[]").map((e) => e.type));
  await context.close();
  return { skipReady, lensesIn, lineShown, actions, enterToPage, events: events.join(">") };
}

const browser = await chromium.launch();
const results = [];
try {
  for (const name of Object.keys(PROFILES)) {
    const runs = [];
    for (let r = 0; r < RUNS; r++) runs.push(await run(browser, name));
    const row = { profile: name };
    for (const k of ["skipReady", "lensesIn", "lineShown", "actions", "enterToPage"]) row[k] = Math.round(median(runs.map((x) => x[k])));
    row.events = runs[0].events;
    results.push(row);
    console.log(JSON.stringify(row));
  }
} finally {
  await browser.close();
  spawnSync("taskkill", ["/pid", String(server.pid), "/T", "/F"], { stdio: "ignore" });
}
mkdirSync(join(root, ".perf"), { recursive: true });
writeFileSync(join(root, ".perf", "gate-eval.json"), JSON.stringify(results, null, 2));
