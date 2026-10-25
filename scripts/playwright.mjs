// Run the Playwright CLI with browsers stored on drive F (ROADMAP 0.1), without a global env var.
// Usage: node scripts/playwright.mjs <playwright args>
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const cli = fileURLToPath(import.meta.resolve("@playwright/test/cli"));
const env = { ...process.env, PLAYWRIGHT_BROWSERS_PATH: join("F:", "\\", "Dev", "Data", "playwright") };
const r = spawnSync(process.execPath, [cli, ...process.argv.slice(2)], { stdio: "inherit", env });
process.exit(r.status ?? 1);
