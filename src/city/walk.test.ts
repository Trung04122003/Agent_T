import { describe, expect, it } from "vitest";
import { ALLEYS, assignLots, ATLAS_TABLE, GRID, PLAZA, type CityData } from "./plan";
import { insidePolygon, footprintSegments, visibility, visibilityCache } from "./visibility";
import { BODY, findPath, footprintAt, free, nearestFree, nearestRoad, slide, walkWorld } from "./walk";

// ROADMAP-v4 36.2 and 36.3, on the real plan with a small set of entries.
const data: CityData = {
  plots: [
    { id: "edu", kind: "education", domains: ["tech"] },
    { id: "fin", kind: "role", domains: ["finance"] },
    { id: "obs", kind: "project", domains: ["tech"] },
  ],
  vault: { id: "vault-id" },
  landmarks: [{ id: "dead-drop" }],
};
const layout = assignLots(data);
const world = walkWorld(layout);
const fin = world.footprints.find((f) => f.id === "fin")!;

describe("walking (36.2)", () => {
  it("collision: footprints, the canal and the grid's edge block; streets and bridges do not", () => {
    expect(free(world, PLAZA.x + 2, PLAZA.y + 2)).toBe(true);
    expect(free(world, (fin.x0 + fin.x1) / 2, (fin.y0 + fin.y1) / 2)).toBe(false);
    expect(free(world, 10.5, 31.5)).toBe(false); // canal
    expect(free(world, 21.5, 31.5)).toBe(true); // a bridge
    expect(free(world, 0.1, 10)).toBe(false); // off the edge (radius)
  });

  it("slides along a wall instead of stopping dead", () => {
    const p = { x: fin.x0 - BODY - 0.01, y: (fin.y0 + fin.y1) / 2 };
    slide(world, p, 0.3, 0.3); // into the wall on x, free on y
    expect(p.x).toBeLessThan(fin.x0);
    expect(p.y).toBeCloseTo((fin.y0 + fin.y1) / 2 + 0.3);
  });

  it("A* finds a road path to a building's door, over a bridge when it must", () => {
    const from = { x: ALLEYS[0]!.mouth.x, y: ALLEYS[0]!.mouth.y };
    const vault = world.footprints.find((f) => f.id === "vault-id")!;
    const path = findPath(world, from, vault.door)!;
    expect(path[0]).toEqual(from);
    expect(path.at(-1)).toEqual(vault.door);
    for (let i = 1; i < path.length; i++) expect(Math.abs(path[i]!.x - path[i - 1]!.x) + Math.abs(path[i]!.y - path[i - 1]!.y)).toBe(1);
    expect(path.some((t) => t.y === 31 || t.y === 32)).toBe(true); // crossed the canal
    for (const t of path) expect(world.roads[t.y * GRID + t.x]).toBe(1);
  });

  it("no path off the road graph; the nearest road tile is found from anywhere", () => {
    expect(findPath(world, { x: 0, y: 0 }, { x: 22, y: 22 })).toBeNull();
    const r = nearestRoad(world, 0, 0)!;
    expect(world.roads[r.y * GRID + r.x]).toBe(1);
  });

  it("never stuck: from inside a footprint, the fallback lands on a free tile", () => {
    const inside = { x: (fin.x0 + fin.x1) / 2, y: (fin.y0 + fin.y1) / 2 };
    expect(footprintAt(world, inside.x, inside.y)?.id).toBe("fin");
    const out = nearestFree(world, inside.x, inside.y);
    expect(free(world, out.x, out.y)).toBe(true);
    expect(Math.hypot(out.x - inside.x, out.y - inside.y)).toBeLessThan(4);
  });
});

describe("the Atlas table (P40)", () => {
  it("blocks the way through its middle, never the way round it, and both avenues still reach the plaza", () => {
    expect(free(world, ATLAS_TABLE.x, ATLAS_TABLE.y)).toBe(false);
    expect(world.roads[ATLAS_TABLE.y * GRID + ATLAS_TABLE.x]).toBe(0);
    // Corner to opposite corner of the plaza, around the table.
    const round = findPath(world, { x: PLAZA.x + PLAZA.w - 1, y: PLAZA.y }, { x: PLAZA.x, y: PLAZA.y + PLAZA.d - 1 })!;
    expect(round).not.toBeNull();
    for (const t of round) expect(free(world, t.x + 0.5, t.y + 0.5), `${t.x},${t.y}`).toBe(true);
    // Each avenue's tile at the plaza's edge is still on the road graph.
    for (const t of [{ x: 21, y: PLAZA.y }, { x: PLAZA.x, y: 21 }, { x: 21, y: PLAZA.y + PLAZA.d - 1 }, { x: PLAZA.x + PLAZA.w - 1, y: 21 }]) {
      expect(world.roads[t.y * GRID + t.x], `${t.x},${t.y}`).toBe(1);
    }
  });
});

describe("lantern visibility (36.3)", () => {
  const box = [{ x0: 5, y0: 5, x1: 7, y1: 7 }];
  const segs = footprintSegments(box);
  const poly = visibility(2, 6, 10, segs);

  it("a footprint hides what is behind it and nothing in front or beside it", () => {
    expect(insidePolygon(poly, 4, 6)).toBe(true); // in front
    expect(insidePolygon(poly, 9, 6)).toBe(false); // straight behind
    expect(insidePolygon(poly, 9, 9.5)).toBe(true); // past its corner, in the clear
    expect(insidePolygon(poly, 2, 1)).toBe(true);
    expect(insidePolygon(poly, 13, 6)).toBe(false); // beyond the reach
  });

  it("is cached per quarter-tile cell: moving inside a cell or turning costs nothing", () => {
    const cache = visibilityCache(segs, 10);
    cache.get(2.01, 6.01);
    cache.get(2.2, 6.2);
    expect(cache.misses).toBe(1);
    cache.get(2.3, 6.2);
    expect(cache.misses).toBe(2);
  });
});
