import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { mix, palette, TOKENS } from "./palette";

// UX-v4 section 4: the city's colours are the dossier's tokens and mixes of them, nothing new.
const css = readFileSync("src/styles/tokens.css", "utf8");
const block = (selector: string) => css.slice(css.indexOf(selector), css.indexOf("}", css.indexOf(selector)));
const read = (b: string, name: string) => new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`).exec(b)?.[1];

describe("city palette", () => {
  it("uses the same token values as tokens.css, in both modes", () => {
    for (const [mode, selector] of [["giai-mat", ':root[data-mode="giai-mat"]'], ["mat", ':root[data-mode="mat"]']] as const) {
      const b = block(selector);
      const t = TOKENS[mode];
      expect({ bg: read(b, "bg"), surface: read(b, "surface"), ink: read(b, "ink"), inkMuted: read(b, "ink-muted"), line: read(b, "line"), accent: read(b, "accent") }).toEqual(t);
    }
  });

  it("mixes in sRGB, ends included", () => {
    expect(mix("#000000", "#ffffff", 0)).toBe("#000000");
    expect(mix("#000000", "#ffffff", 1)).toBe("#ffffff");
    expect(mix("#000000", "#ffffff", 0.5)).toBe("#808080");
  });

  it("night is darker than dawn on the ground", () => {
    const lum = (h: string) => parseInt(h.slice(1, 3), 16) + parseInt(h.slice(3, 5), 16) + parseInt(h.slice(5, 7), 16);
    expect(lum(palette("mat").ground)).toBeLessThan(lum(palette("giai-mat").ground));
  });
});
