// Owner-review screenshots of Agent T City (ROADMAP-v4 rule 9): fixed camera, both modes, into
// docs/city/review/<phase>/. Run against a flag-on build in preview, and optionally the dev server
// for the dev-only city sheet:
//   node tools/city-review.mjs <phase> <preview-url> [dev-url] [district-id]
// e.g. node tools/city-review.mjs P34 http://localhost:4324 http://localhost:4325
// Browsers come from drive F (same path as scripts/playwright.mjs).
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

process.env["PLAYWRIGHT_BROWSERS_PATH"] ??= join("F:", "\\", "Dev", "Data", "playwright");
const { chromium } = await import("@playwright/test");

const [phase, site, dev, district = "role-prudential"] = process.argv.slice(2);
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
  // His long shadow (36.5), close zoom, standing at the alley's mouth.
  await page.goto(`${site}/vi/city/`);
  await page.waitForFunction(() => document.querySelector("[data-city-stage]")?.getAttribute("data-entrance") === "done", null, { timeout: 8000 });
  await stage.focus();
  await page.keyboard.press("+");
  await page.waitForTimeout(900);
  const sh = join(out, `agent-shadow-${mode}.png`);
  await stage.screenshot({ path: sh });
  shots.push(sh);
  if (mode === "mat") {
    // Signature moments (UX-v4 section 11): 11, Agent T stepping out of the alley into the light;
    // 1, his lantern's cone cut by buildings (the mouse aims it); 8, rain on the glass tower (High).
    await page.goto(`${site}/vi/city/`);
    await page.waitForFunction(() => document.querySelector("[data-city-stage]")?.getAttribute("data-entrance") === "stepping", null, { timeout: 8000 });
    await page.waitForTimeout(550);
    const m11 = join(out, "moment-11-alley.png");
    await stage.screenshot({ path: m11 });
    shots.push(m11);
    await page.waitForFunction(() => document.querySelector("[data-city-stage]")?.getAttribute("data-entrance") === "done", null, { timeout: 8000 });
    await stage.hover({ position: { x: 150, y: 470 } });
    await page.waitForTimeout(700);
    const m1 = join(out, "moment-1-lantern.png");
    await stage.screenshot({ path: m1 });
    shots.push(m1);
    await page.goto(`${site}/vi/city/?quality=high`);
    await page.waitForFunction(() => document.querySelector("[data-city-stage]")?.getAttribute("data-entrance") === "done", null, { timeout: 8000 });
    await stage.hover({ position: { x: 420, y: 520 } });
    await page.waitForTimeout(800);
    const m8 = join(out, "moment-8-rain.png");
    await stage.screenshot({ path: m8 });
    shots.push(m8);
  }
  // P37: the HUD, a briefing (the ledger's own row), and a district left lit after its briefing.
  await page.goto(`${site}/vi/city/?lens=client`);
  await page.waitForFunction(() => document.querySelector("[data-city-stage]")?.getAttribute("data-entrance") === "done", null, { timeout: 8000 });
  const hudShot = join(out, `hud-${mode}.png`);
  await stage.screenshot({ path: hudShot });
  shots.push(hudShot);
  await page.goto(`${site}/vi/city/?lens=client#d-role-prudential`);
  await page.waitForSelector('dialog[data-brief="role-prudential"][open]');
  await page.waitForTimeout(300);
  const brief = join(out, `briefing-${mode}.png`);
  await page.screenshot({ path: brief });
  shots.push(brief);
  if (mode === "mat") {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(600);
    const lit = join(out, "district-lit-mat.png");
    await page.keyboard.press("-");
    await page.waitForTimeout(600);
    await stage.screenshot({ path: lit });
    shots.push(lit);
  }
  // The Lite view, drawn from the same plan.
  await page.goto(`${site}/vi/city/?lite`);
  const lite = join(out, `city-lite-${mode}.png`);
  await page.locator("[data-city-lite]").screenshot({ path: lite });
  shots.push(lite);
  await context.close();
}
// P40: the Atlas table, close, in both modes; moment 2 (the beacon rising out of the fog, far zoom)
// and moment 6 (the terraces rising under the cursor). Still frames (reduced motion).
for (const mode of ["mat", "giai-mat"]) {
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 }, deviceScaleFactor: 1, reducedMotion: "reduce" });
  await context.addInitScript((m) => {
    localStorage.setItem("mode", m);
    localStorage.setItem("cursorFx", "system");
  }, mode);
  const page = await context.newPage();
  await page.goto(`${site}/vi/city/`);
  await page.waitForFunction(() => document.querySelector("[data-city-stage]")?.getAttribute("data-atlas") === "ready");
  const stage = page.locator("[data-city-stage]");
  await stage.focus();
  await page.keyboard.press("+");
  await page.waitForTimeout(500);
  const b = await page.evaluate(() => document.querySelector(".city-layer--top").atlasBeacon());
  const close = join(out, `atlas-${mode}.png`);
  await stage.screenshot({ path: close });
  shots.push(close);
  if (mode === "mat") {
    await stage.hover({ position: { x: b.x - 6, y: b.y + 4 } });
    await page.waitForTimeout(400);
    const m6 = join(out, "moment-6-terraces.png");
    await stage.screenshot({ path: m6 });
    shots.push(m6);
    await page.mouse.move(5, 5);
    await stage.focus();
    await page.keyboard.press("-");
    await page.keyboard.press("-");
    await page.waitForTimeout(500);
    const m2 = join(out, "moment-2-beacon.png");
    await stage.screenshot({ path: m2 });
    shots.push(m2);
  }
  await context.close();
}

// P41: moment 7, the dive into the table (a frame mid-plunge, with motion) and the real map open
// in its overlay, in both modes.
for (const mode of ["mat", "giai-mat"]) {
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 }, deviceScaleFactor: 1 });
  await context.addInitScript((m) => {
    localStorage.setItem("mode", m);
    localStorage.setItem("cursorFx", "system");
  }, mode);
  const page = await context.newPage();
  await page.goto(`${site}/vi/city/`);
  await page.waitForFunction(() => document.querySelector("[data-city-stage]")?.getAttribute("data-atlas") === "ready");
  await page.waitForFunction(() => document.querySelector("[data-city-stage]")?.getAttribute("data-entrance") === "done");
  const stage = page.locator("[data-city-stage]");
  await stage.scrollIntoViewIfNeeded();
  const b = await page.evaluate(() => document.querySelector(".city-layer--top").atlasBeacon());
  await stage.click({ position: { x: b.x, y: b.y + 10 } });
  await page.waitForFunction(() => document.querySelector("[data-city-stage]")?.dataset.dive === "in", null, { timeout: 15_000 });
  await page.waitForTimeout(260);
  if (mode === "mat") {
    const mid = join(out, "moment-7-dive.png");
    await page.screenshot({ path: mid });
    shots.push(mid);
  }
  await page.waitForFunction(() => document.querySelector("dialog[data-brief='atlas']")?.open);
  await page.waitForTimeout(500);
  const open = join(out, `atlas-map-${mode}.png`);
  await page.screenshot({ path: open });
  shots.push(open);
  await context.close();
}

// P38: one district in its four states, night and dawn (still frames), and night beside dawn.
{
  const states = ["sealed", "scouted", "briefed", "declassified"];
  const cells = [];
  for (const mode of ["mat", "giai-mat"]) {
    for (const state of states) {
      const context = await browser.newContext({ viewport: { width: 1366, height: 900 }, deviceScaleFactor: 1, reducedMotion: "reduce" });
      await context.addInitScript(([m, s]) => {
        localStorage.setItem("mode", m);
        localStorage.setItem("cursorFx", "system");
        sessionStorage.setItem("city:districts", s);
      }, [mode, JSON.stringify({ [district]: state })]);
      const page = await context.newPage();
      await page.goto(`${site}/vi/city/?quality=medium`);
      await page.waitForFunction(() => performance.getEntriesByName("city:first-frame").length > 0);
      const stage = page.locator("[data-city-stage]");
      await stage.focus();
      await page.keyboard.press("+");
      await page.waitForTimeout(500);
      cells.push({ label: `${mode} · ${state}`, src: `data:image/png;base64,${(await stage.screenshot()).toString("base64")}` });
      await context.close();
    }
  }
  const page = await browser.newPage({ viewport: { width: 1640, height: 800 }, deviceScaleFactor: 1 });
  const grid = (list, cols, w) =>
    `<body style="margin:0;background:#888;font:14px monospace"><div style="display:grid;grid-template-columns:repeat(${cols},${w}px);gap:6px;padding:6px">${list
      .map((c) => `<figure style="margin:0"><img src="${c.src}" style="width:${w}px;display:block"><figcaption style="padding:2px 4px;background:#fff">${c.label}</figcaption></figure>`)
      .join("")}</div></body>`;
  await page.setContent(grid(cells, 4, 400));
  const statesFile = join(out, "district-states.png");
  await page.locator("div").first().screenshot({ path: statesFile });
  shots.push(statesFile);
  const read = (f) => `data:image/png;base64,${readFileSync(join(out, f)).toString("base64")}`;
  await page.setContent(grid([{ label: "Mat (night)", src: read("city-plaza-mat.png") }, { label: "Giai mat (dawn)", src: read("city-plaza-giai-mat.png") }], 2, 700));
  const sideFile = join(out, "night-dawn.png");
  await page.locator("div").first().screenshot({ path: sideFile });
  shots.push(sideFile);
  await page.close();
}
if (dev) {
  const page = await browser.newPage({ viewport: { width: 1640, height: 900 }, deviceScaleFactor: 1 });
  await page.goto(`${dev}/dev/city-sheet`);
  await page.waitForSelector("[data-city-sheet] canvas");
  const file = join(out, "city-sheet.png");
  await page.locator("[data-city-sheet]").screenshot({ path: file });
  shots.push(file);
  await page.goto(`${dev}/dev/agent-sheet`);
  await page.waitForSelector("[data-agent-sheet] canvas");
  const agentFile = join(out, "agent-sheet.png");
  await page.locator("[data-agent-sheet]").screenshot({ path: agentFile });
  shots.push(agentFile);
}
await browser.close();
console.log(shots.join("\n"));
