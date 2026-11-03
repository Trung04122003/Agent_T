import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { BUDGET } from "./city-budget.mjs";

// ROADMAP-v4 P31.5: the budget harness, run on made-up outputs under test-results/ (git-ignored).
const base = join("test-results", "city-budget");
const page = (body, head = "") => `<!doctype html><html><head>${head}</head><body>${body}</body></html>`;

function run(name, files) {
  const dir = join(base, name);
  rmSync(dir, { recursive: true, force: true });
  for (const [file, body] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, file)), { recursive: true });
    writeFileSync(join(dir, file), body);
  }
  const r = spawnSync(process.execPath, ["scripts/city-budget.mjs", dir], { encoding: "utf8" });
  return { code: r.status, out: r.stdout + r.stderr };
}
// Incompressible bytes, so gzip does not shrink the stub under the budget.
const noise = (n) => randomBytes(n).toString("base64");
const dossier = { "vi/index.html": page("dossier", '<link rel="stylesheet" href="/_astro/site.css"><script type="module" src="/_astro/site.js"></script>'), "_astro/site.css": "body{}", "_astro/site.js": "export{}" };

describe("city:budget", () => {
  it("passes with no city route (the flag off)", () => {
    const r = run("off", dossier);
    expect(r.code).toBe(0);
    expect(r.out).toContain("no city route");
  });

  it("passes a small city, counting its JS through imports", () => {
    const r = run("small", {
      ...dossier,
      "vi/city/index.html": page("city", '<link rel="stylesheet" href="/_astro/site.css"><link rel="stylesheet" href="/_astro/city.css"><script type="module" src="/_astro/city.js"></script>'),
      "_astro/city.js": 'import("./engine.js");export{}',
      "_astro/engine.js": "export const x=1",
      "_astro/city.css": ".city{}",
    });
    expect(r.out).toContain("city-budget: OK");
    expect(r.code).toBe(0);
  });

  it("fails on an oversized city JS chunk, even one loaded by a dynamic import", () => {
    const r = run("big-js", {
      ...dossier,
      "vi/city/index.html": page("city", '<script type="module" src="/_astro/city.js"></script>'),
      "_astro/city.js": 'import("./engine.js")',
      "_astro/engine.js": `export const s="${noise(BUDGET.js)}"`,
    });
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/city JS \d+ B gzip > 81920 B/);
  });

  it("fails on oversized city CSS and atlas data; the dossier's shared CSS does not count", () => {
    const r = run("big-css-atlas", {
      ...dossier,
      "_astro/site.css": `/*${noise(BUDGET.css * 2)}*/`,
      "vi/city/index.html": page("city", '<link rel="stylesheet" href="/_astro/site.css"><link rel="stylesheet" href="/_astro/city.css">'),
      "_astro/city.css": `/*${noise(BUDGET.css)}*/`,
      "_astro/atlas.json": JSON.stringify({ d: noise(BUDGET.atlas) }),
    });
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/city CSS \d+ B gzip > 8192 B/);
    expect(r.out).toMatch(/atlas data \d+ B gzip > 61440 B/);
    expect(r.out).not.toContain("site.css");
  });

  it("fails on any image or font in the city: a file, a CSS url(), a JS string, an inline data URL", () => {
    const r = run("assets", {
      ...dossier,
      "vi/city/index.html": page("city", '<link rel="stylesheet" href="/_astro/city.css"><script type="module" src="/_astro/city.js"></script>'),
      "vi/city/sky.png": "x",
      "_astro/city.css": '.a{background:url("/_astro/brick.webp")}.b{src:url(data:font/woff2;base64,AA)}',
      "_astro/city.js": 'const f="/_astro/agent.woff2";export{f}',
    });
    expect(r.code).toBe(1);
    expect(r.out).toContain("sky.png: image or font in the city route");
    expect(r.out).toContain("references /_astro/brick.webp");
    expect(r.out).toContain("references /_astro/agent.woff2");
    expect(r.out).toContain("inline image or font");
  });

  it("counts CSS the build inlined in city pages (each distinct block once), not the dossier's own", () => {
    const shared = `body{${"x".repeat(50)}}`;
    const city = `/*${noise(BUDGET.css)}*/`;
    const r = run("inline-css", {
      ...dossier,
      "en/index.html": page("dossier", `<style>${shared}</style>`),
      "vi/city/index.html": page("city", `<style>${shared}</style><style>${city}</style>`),
      "en/city/index.html": page("city", `<style>${city}</style>`),
    });
    expect(r.code).toBe(1);
    const css = Number(/city CSS ([0-9]+) B gzip >/.exec(r.out)?.[1]);
    expect(css).toBeGreaterThan(BUDGET.css);
    expect(css).toBeLessThan(BUDGET.css * 2); // the vi and en copies count once
  });

  it("a share image in <meta> is not a city asset; an <img> is", () => {
    const meta = run("meta", { ...dossier, "vi/city/index.html": page("city", '<meta property="og:image" content="/og.png">') });
    expect(meta.code).toBe(0);
    const img = run("img", { ...dossier, "vi/city/index.html": page('<img src="/_astro/agent.png" alt="">') });
    expect(img.code).toBe(1);
    expect(img.out).toContain("references /_astro/agent.png");
  });

  it("fails when a dossier page loads a city-only file", () => {
    const r = run("leak", {
      ...dossier,
      "en/index.html": page("dossier", '<link rel="modulepreload" href="/_astro/site.js"><a data-x="/_astro/city-engine.js">x</a>'),
      "vi/city/index.html": page("city", '<script type="module" src="/_astro/city-engine.js"></script>'),
      "_astro/city-engine.js": "export{}",
    });
    expect(r.code).toBe(1);
    expect(r.out).toContain("loads city file city-engine.js");
  });
});
