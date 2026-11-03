import { describe, expect, it } from "vitest";
import { depthKey, sortByDepth, TILE, tileOf, toScreen, toWorld, Z_PX } from "./iso";

describe("2:1 isometric projection (ROADMAP-v4 P32.1)", () => {
  it("is 2:1: one tile step east moves half a tile right and a quarter-width down", () => {
    expect(toScreen({ x: 1, y: 0 })).toEqual({ sx: TILE.w / 2, sy: TILE.h / 2 });
    expect(toScreen({ x: 0, y: 1 })).toEqual({ sx: -TILE.w / 2, sy: TILE.h / 2 });
    expect(TILE.w / TILE.h).toBe(2);
    expect(toScreen({ x: 3, y: 3, z: 2 }).sy).toBe(toScreen({ x: 3, y: 3 }).sy - 2 * Z_PX);
  });

  it("round trip world -> screen -> world within 1e-6 over a grid of points and heights", () => {
    let worst = 0;
    for (let x = -40; x <= 40; x += 0.37) {
      for (let y = -40; y <= 40; y += 0.41) {
        for (const z of [0, 0.5, 3.25]) {
          const w = toWorld(toScreen({ x, y, z }), z);
          worst = Math.max(worst, Math.abs(w.x - x), Math.abs(w.y - y));
        }
      }
    }
    expect(worst).toBeLessThan(1e-6);
  });

  it("picks the right tile under a screen point", () => {
    const centre = toScreen({ x: 5.5, y: 2.5 });
    expect(tileOf(toWorld(centre))).toEqual({ tx: 5, ty: 2 });
  });

  it("depth: nearer the viewer (further down the screen) draws later; height and x break ties", () => {
    const items = [
      { id: "near", x: 6, y: 6 },
      { id: "far", x: 0, y: 0 },
      { id: "tall", x: 3, y: 3, z: 2 },
      { id: "low", x: 3, y: 3 },
    ];
    expect(sortByDepth(items).map((i) => i.id)).toEqual(["far", "low", "tall", "near"]);
    expect(depthKey({ x: 2, y: 1 })).not.toBe(depthKey({ x: 1, y: 2 })); // stable, not a tie
  });
});
