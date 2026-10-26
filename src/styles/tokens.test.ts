import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// UX-v2 sections 0 and 3 (ROADMAP 12.1): one accent colour, all colours from tokens.css.
const files = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? files(join(dir, d.name)) : /\.(css|astro)$/.test(d.name) ? [join(dir, d.name)] : [],
  );

describe("visual system v2", () => {
  it("no hard-coded colour outside tokens.css (so no second accent can sneak in)", () => {
    const offenders = files("src")
      .filter((f) => !f.endsWith("tokens.css"))
      .filter((f) => /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i.test(readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "")));
    expect(offenders).toEqual([]);
  });

  it("each mode defines exactly one accent token", () => {
    const css = readFileSync("src/styles/tokens.css", "utf8");
    expect(css.match(/--accent\s*:/g)?.length).toBe(2); // one per mode
    expect(css).not.toMatch(/--accent-2|--accent2|--secondary/);
  });

  it("numbers are tabular everywhere and the grid is static", () => {
    const base = readFileSync("src/styles/base.css", "utf8");
    expect(base).toMatch(/font-variant-numeric:\s*tabular-nums/);
    expect(readFileSync("src/styles/tokens.css", "utf8")).not.toMatch(/--grid[^;]*animation/);
  });
});
