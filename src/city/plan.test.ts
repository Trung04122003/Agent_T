import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { dropHeld } from "../lib/ledger";
import { claims as claimsSchema } from "../lib/schema";
import { building, heightOf, type Solid } from "./archetypes";
import { cityContentMap, type CityContentMap, type CityPlot } from "./content-map";
import {
  ALLEYS,
  assignLots,
  GRID,
  inRect,
  isCanal,
  LANDMARK_LOTS,
  PLAZA,
  PLOT_LOTS,
  reachable,
  rectTiles,
  tileKey,
  touchesRect,
  VAULT_LOT,
  walkable,
  type Rect,
} from "./plan";

// ROADMAP-v4 34.1, 34.2, 34.5. Real entries come in the way the build gets them (see content-map.test.ts).
const raw = JSON.parse(readFileSync("content/claims.json", "utf8")) as unknown[];
const risks = (JSON.parse(readFileSync("content/risks.json", "utf8")) as unknown[]).length;
const map = cityContentMap(claimsSchema.parse(dropHeld(raw as { id: string; visibility?: string }[])), risks);

const lots: { id: string; rect: Rect; door: { x: number; y: number } }[] = [...PLOT_LOTS, ...LANDMARK_LOTS, { id: "vault", ...VAULT_LOT }];
const street = reachable(PLAZA);

describe("city plan invariants (34.1)", () => {
  it("lots lie on land inside the grid and never overlap each other, a street or the canal", () => {
    const taken = new Map<string, string>();
    for (const l of lots) {
      for (const t of rectTiles(l.rect)) {
        expect(t.x >= 0 && t.y >= 0 && t.x < GRID && t.y < GRID, `${l.id} in grid`).toBe(true);
        expect(walkable(t.x, t.y) || isCanal(t.x, t.y), `${l.id} at ${tileKey(t.x, t.y)} on street or canal`).toBe(false);
        expect(taken.get(tileKey(t.x, t.y)), `${l.id} overlaps`).toBeUndefined();
        taken.set(tileKey(t.x, t.y), l.id);
      }
    }
  });

  it("the street network is one connected graph, bridges included", () => {
    let total = 0;
    for (let x = 0; x < GRID; x++) for (let y = 0; y < GRID; y++) if (walkable(x, y)) total++;
    expect(street.size).toBe(total);
    // South of the canal is reached over the bridges.
    expect(street.has(tileKey(34, 38))).toBe(true);
  });

  it("every lot's door is a street tile touching the lot, so every plot is reachable", () => {
    for (const l of lots) {
      expect(street.has(tileKey(l.door.x, l.door.y)), `${l.id} door on the street`).toBe(true);
      expect(touchesRect(l.door, l.rect), `${l.id} door touches its lot`).toBe(true);
    }
  });

  it("every content-map entry has exactly one plot on its own lot, and the Vault exists", () => {
    const layout = assignLots(map);
    expect(layout.plots.map((p) => p.id)).toEqual(map.plots.map((p) => p.id));
    expect(new Set(layout.plots.map((p) => p.lot)).size).toBe(layout.plots.length);
    expect(layout.vault?.id).toBe(map.vault?.id);
    expect(layout.landmarks.map((l) => l.id)).toEqual(map.landmarks.map((l) => l.id));
  });

  it("holds up to every lot the plan has, and says so when it runs out", () => {
    const fake = (n: number): CityContentMap => ({
      plots: Array.from({ length: n }, (_, i): CityPlot => ({ id: `fx-${i}`, plot: `plot-fx-${i}`, kind: "role", domains: ["business"], tier: "T1", place: null })),
      vault: null,
      landmarks: [],
    });
    expect(assignLots(fake(PLOT_LOTS.length)).plots).toHaveLength(PLOT_LOTS.length);
    expect(() => assignLots(fake(PLOT_LOTS.length + 1))).toThrow(/no lot left for fx-14/);
  });
});

describe("archetypes (34.2)", () => {
  const layout = assignLots(map);

  it("picks an archetype per entry from kind and domain", () => {
    expect(Object.fromEntries(layout.plots.map((p) => [p.id, `${p.archetype} @ ${p.lot}`]))).toMatchInlineSnapshot(`
      {
        "edu-duy-tan": "campus-hall @ academy",
        "project-air-quality": "observatory @ observatory",
        "role-bbe-ldc": "market-hall @ market-hall",
        "role-bluesea": "market-hall @ lot-a",
        "role-dz-ta": "antenna-tower @ signal-room",
        "role-jci": "pavilion-mast @ embassy-row",
        "role-prudential": "glass-tower @ glass-tower",
      }
    `);
  });

  it("skyline height never follows the tier: any shuffle of tiers gives the same city", () => {
    const tiers = ["T1", "T2", "T3"] as const;
    const heights = (m: CityContentMap) =>
      assignLots(m).plots.map((p) => heightOf(building(p.archetype, p.rect, p.lot)));
    const base = heights(map);
    for (let shift = 1; shift <= 3; shift++) {
      const shuffled = { ...map, plots: map.plots.map((p, i) => ({ ...p, tier: tiers[(i + shift) % 3]! })) };
      expect(heights(shuffled)).toEqual(base);
    }
  });

  it("buildings are deterministic and stay inside their lots", () => {
    const all = [
      ...layout.plots.map((p) => ({ id: p.lot, a: p.archetype, rect: p.rect })),
      ...layout.landmarks.map((l) => ({ id: l.id, a: l.archetype, rect: l.rect })),
      { id: "vault", a: "vault-monolith" as const, rect: VAULT_LOT.rect },
    ];
    for (const b of all) {
      const solids = building(b.a, b.rect, b.id);
      expect(building(b.a, b.rect, b.id)).toEqual(solids);
      for (const s of solids) expect(footprintInside(s, b.rect), `${b.id} ${s.type}`).toBe(true);
    }
  });
});

describe("alleys (34.5)", () => {
  const footprints = lots.map((l) => l.rect);

  it("at least three, each one tile wide, on free land, opening onto the street", () => {
    expect(ALLEYS.length).toBeGreaterThanOrEqual(3);
    for (const a of ALLEYS) {
      expect(street.has(tileKey(a.mouth.x, a.mouth.y)), `${a.id} mouth on the street`).toBe(true);
      const path = [a.mouth, ...a.tiles];
      for (let i = 1; i < path.length; i++) {
        const t = path[i]!;
        expect(Math.abs(t.x - path[i - 1]!.x) + Math.abs(t.y - path[i - 1]!.y), `${a.id} continuous`).toBe(1);
        expect(walkable(t.x, t.y) || isCanal(t.x, t.y), `${a.id} on land`).toBe(false);
        expect(footprints.some((r) => inRect(r, t.x, t.y)), `${a.id} free of buildings`).toBe(false);
      }
      expect(a.tiles.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("at least one opens onto the plaza, in view of it", () => {
    expect(ALLEYS.some((a) => inRect(PLAZA, a.mouth.x, a.mouth.y))).toBe(true);
  });
});

function footprintInside(s: Solid, r: Rect): boolean {
  const e = 1e-9;
  const within = (x0: number, y0: number, x1: number, y1: number) => x0 >= r.x - e && y0 >= r.y - e && x1 <= r.x + r.w + e && y1 <= r.y + r.d + e;
  switch (s.type) {
    case "box":
    case "gable":
      return within(s.x, s.y, s.x + s.w, s.y + s.d);
    case "frustum": {
      const m = Math.max(s.r0, s.r1);
      return within(s.cx - m, s.cy - m, s.cx + m, s.cy + m);
    }
    case "mast":
      return within(s.x, s.y, s.x, s.y);
  }
}
