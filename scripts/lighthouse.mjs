// Lighthouse, mobile (ROADMAP 8.3 / SPEC section 10): Performance >= 90, Accessibility >= 95.
// Builds, serves dist/ with astro preview, and audits /vi/ and /en/ with Lighthouse's default
// mobile emulation and throttling, using Playwright's Chromium on drive F.
// Usage: node scripts/lighthouse.mjs   (reports in test-results/lighthouse/)
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

process.env["PLAYWRIGHT_BROWSERS_PATH"] ??= join("F:", "\\", "Dev", "Data", "playwright");
const { chromium } = await import("@playwright/test");
const { default: lighthouse } = await import("lighthouse");

const root = resolve(fileURLToPath(import.meta.url), "..", "..");
const PORT = 4330;
const DEBUG_PORT = 9333;
const BUDGET = { performance: 90, accessibility: 95 };
const outDir = join(root, "test-results", "lighthouse");

if (spawnSync("pnpm build", { shell: true, stdio: "inherit", cwd: root }).status !== 0) process.exit(1);
const server = spawn(`pnpm preview --port ${PORT} --ignore-lock`, { shell: true, cwd: root });
await new Promise((ok, fail) => {
  const timer = setTimeout(() => fail(new Error("preview did not start")), 60_000);
  server.stdout.on("data", (d) => {
    if (String(d).includes(`localhost:${PORT}`)) {
      clearTimeout(timer);
      ok();
    }
  });
});

const browser = await chromium.launch({ args: [`--remote-debugging-port=${DEBUG_PORT}`] });
let failed = false;
try {
  mkdirSync(outDir, { recursive: true });
  for (const path of ["/vi/", "/en/"]) {
    const result = await lighthouse(`http://localhost:${PORT}${path}`, {
      port: DEBUG_PORT,
      output: "html",
      onlyCategories: ["performance", "accessibility", "best-practices", "seo"],
      logLevel: "error",
    });
    const { categories, audits } = result.lhr;
    const score = (k) => Math.round((categories[k]?.score ?? 0) * 100);
    const name = path.replaceAll("/", "") || "root";
    writeFileSync(join(outDir, `${name}.html`), result.report);
    console.log(
      `${path}  performance ${score("performance")}  accessibility ${score("accessibility")}  ` +
        `best-practices ${score("best-practices")}  seo ${score("seo")}  | ` +
        `LCP ${audits["largest-contentful-paint"].displayValue}  CLS ${audits["cumulative-layout-shift"].displayValue}  ` +
        `TBT ${audits["total-blocking-time"].displayValue}`,
    );
    for (const [k, min] of Object.entries(BUDGET)) {
      if (score(k) < min) {
        failed = true;
        console.error(`  FAIL ${k} ${score(k)} < ${min}`);
      }
    }
  }
} finally {
  await browser.close();
  // Kill the whole tree (shell -> pnpm -> astro) while the shell still exists; on Windows a plain
  // kill only stops the shell and leaves astro preview listening.
  if (process.platform === "win32" && server.pid) spawnSync("taskkill", ["/pid", String(server.pid), "/T", "/F"]);
  else server.kill();
}
console.log(failed ? "lighthouse: budget NOT met" : "lighthouse: OK");
process.exit(failed ? 1 : 0);
