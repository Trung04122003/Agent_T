// Write docs/city/content-map.md from the city content map (ROADMAP-v4 P31.2), through the test that
// checks it, so the document and the build always agree. Usage: pnpm city:content-map
import { spawnSync } from "node:child_process";

const r = spawnSync("pnpm exec vitest run src/city/content-map.test.ts", {
  shell: true,
  stdio: "inherit",
  env: { ...process.env, WRITE_CONTENT_MAP: "1" },
});
process.exit(r.status ?? 1);
