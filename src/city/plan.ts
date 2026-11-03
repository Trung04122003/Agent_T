// Agent T City plan (ROADMAP-v4 34.1, UX-v4 section 2): a fixed, authored layout, not a random one,
// so the city is the same on every visit. World tiles: x runs east-south (down right on screen), y
// west-south (down left); tile (x, y) covers [x, x+1] x [y, y+1]. Top of the screen is "north".
// The plan holds places, never entries: lots say what they suit (an archetype, a landmark, the
// Vault) and assignLots() puts the content map's entries on them in ledger order.
import type { CityPlot, Landmark } from "./content-map";
import { archetypesFor, type Archetype } from "./archetypes";

export const GRID = 44;

export type Rect = { x: number; y: number; w: number; d: number };
export type Tile = { x: number; y: number };

/** A lot for an entry: `suits` is the archetype it was drawn for; generic lots take any. */
export type PlotLot = { id: string; rect: Rect; door: Tile; suits: Archetype | null };
export type LandmarkLot = { id: Landmark; rect: Rect; door: Tile };
/**
 * A narrow alley (UX-v4 section 6b), one tile wide: `tiles` run from the mouth inward; the last
 * one is the dark pocket with the doorway recess and the dead lamp. `mouth` is the street tile
 * it opens onto.
 */
export type Alley = { id: string; mouth: Tile; tiles: Tile[] };

const span = (a: number, b: number): number[] => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const rect = (x0: number, x1: number, y0: number, y1: number): Rect => ({ x: x0, y: y0, w: x1 - x0 + 1, d: y1 - y0 + 1 });

/** Streets: a ring road and two avenues crossing at the Atlas plaza; a canal with three bridges. */
export const STREETS: readonly Rect[] = [
  rect(4, 39, 4, 5),
  rect(4, 39, 38, 39),
  rect(4, 5, 4, 39),
  rect(38, 39, 4, 39),
  rect(4, 39, 21, 22),
  rect(21, 22, 4, 39),
];
export const PLAZA = rect(17, 26, 17, 26);
export const CANAL = { y: [31, 32] as const };

export const PLOT_LOTS: readonly PlotLot[] = [
  // Drawn for an archetype (UX-v4 section 2's sketch: Academy and Signal Room north, Foundry
  // north-east, Market Hall and Observatory west, Glass Tower and Liaison House south-east).
  { id: "academy", rect: rect(6, 11, 6, 10), door: { x: 5, y: 8 }, suits: "campus-hall" },
  { id: "signal-room", rect: rect(6, 9, 13, 16), door: { x: 5, y: 14 }, suits: "antenna-tower" },
  { id: "foundry", rect: rect(31, 36, 6, 10), door: { x: 33, y: 5 }, suits: "server-hall" },
  { id: "market-hall", rect: rect(6, 11, 23, 28), door: { x: 5, y: 25 }, suits: "market-hall" },
  { id: "observatory", rect: rect(6, 10, 33, 37), door: { x: 5, y: 35 }, suits: "observatory" },
  { id: "glass-tower", rect: rect(33, 37, 24, 28), door: { x: 38, y: 26 }, suits: "glass-tower" },
  { id: "liaison-house", rect: rect(23, 28, 33, 37), door: { x: 22, y: 35 }, suits: "pavilion-mast" },
  // Generic lots, nearest the plaza first: a second entry of an archetype goes here.
  { id: "lot-a", rect: rect(27, 31, 23, 26), door: { x: 26, y: 24 }, suits: null },
  { id: "lot-b", rect: rect(14, 20, 27, 30), door: { x: 21, y: 28 }, suits: null },
  { id: "lot-c", rect: rect(28, 32, 14, 20), door: { x: 30, y: 21 }, suits: null },
  { id: "lot-d", rect: rect(23, 28, 27, 30), door: { x: 22, y: 28 }, suits: null },
  { id: "lot-e", rect: rect(24, 28, 6, 10), door: { x: 26, y: 5 }, suits: null },
  { id: "lot-f", rect: rect(33, 37, 13, 18), door: { x: 38, y: 15 }, suits: null },
  { id: "lot-g", rect: rect(15, 20, 33, 37), door: { x: 21, y: 35 }, suits: null },
];

/** Landmarks stand for dossier parts (content map); one appears only if its part exists. */
export const LANDMARK_LOTS: readonly LandmarkLot[] = [
  { id: "archive-tower", rect: rect(13, 16, 6, 9), door: { x: 15, y: 5 } },
  { id: "lab", rect: rect(15, 19, 12, 16), door: { x: 18, y: 17 } },
  { id: "debrief-room", rect: rect(9, 13, 17, 20), door: { x: 11, y: 21 } },
  { id: "risk-registry", rect: rect(23, 25, 13, 16), door: { x: 24, y: 17 } },
  { id: "dead-drop", rect: rect(15, 16, 23, 24), door: { x: 17, y: 23 } },
];

/** The sealed monolith for the classified entry, at the south edge. */
export const VAULT_LOT = { rect: rect(32, 36, 34, 37), door: { x: 34, y: 38 } } as const;

export const ALLEYS: readonly Alley[] = [
  // Opens onto the plaza itself: the one visible from it.
  { id: "alley-plaza", mouth: { x: 26, y: 17 }, tiles: span(12, 16).reverse().map((y) => ({ x: 26, y })) },
  { id: "alley-north", mouth: { x: 12, y: 5 }, tiles: span(6, 10).map((y) => ({ x: 12, y })) },
  { id: "alley-west", mouth: { x: 12, y: 22 }, tiles: span(23, 26).map((y) => ({ x: 12, y })) },
  { id: "alley-south", mouth: { x: 30, y: 38 }, tiles: span(34, 37).reverse().map((y) => ({ x: 30, y })) },
];

/**
 * Streetlamps (UX-v4 section 4: they leave pools of light): every 6 tiles along each street, on the
 * street just inside its edge, none on the plaza (it gets one at each corner instead).
 */
export const LAMPS: readonly { x: number; y: number }[] = (() => {
  const out: { x: number; y: number }[] = [];
  for (const r of STREETS) {
    const along = r.w > r.d;
    const len = along ? r.w : r.d;
    for (let i = 3; i < len; i += 6) {
      const p = along ? { x: r.x + i + 0.5, y: r.y + r.d - 0.15 } : { x: r.x + r.w - 0.15, y: r.y + i + 0.5 };
      if (!inRect(PLAZA, Math.floor(p.x), Math.floor(p.y)) && !out.some((q) => Math.abs(q.x - p.x) + Math.abs(q.y - p.y) < 2)) out.push(p);
    }
  }
  for (const [x, y] of [[0.3, 0.3], [PLAZA.w - 0.3, 0.3], [PLAZA.w - 0.3, PLAZA.d - 0.3], [0.3, PLAZA.d - 0.3]] as const) out.push({ x: PLAZA.x + x, y: PLAZA.y + y });
  return out;
})();

const key = (x: number, y: number): string => `${x},${y}`;

/** Tiles you can walk: the ring road, the avenues, the plaza and the bridges. */
export function walkable(x: number, y: number): boolean {
  return inRect(PLAZA, x, y) || STREETS.some((r) => inRect(r, x, y));
}
export const isCanal = (x: number, y: number): boolean => (CANAL.y as readonly number[]).includes(y) && x >= 0 && x < GRID;
/** A bridge is where a street crosses the canal. */
export const isBridge = (x: number, y: number): boolean => isCanal(x, y) && walkable(x, y);
export function inRect(r: Rect, x: number, y: number): boolean {
  return x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.d;
}

export function rectTiles(r: Rect): Tile[] {
  return span(r.x, r.x + r.w - 1).flatMap((x) => span(r.y, r.y + r.d - 1).map((y) => ({ x, y })));
}
export const adjacent = (a: Tile, b: Tile): boolean => Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1;
export const touchesRect = (t: Tile, r: Rect): boolean => !inRect(r, t.x, t.y) && rectTiles(r).some((u) => adjacent(t, u));

/** Every walkable tile reachable from `start` (4-neighbour flood fill). */
export function reachable(start: Tile): Set<string> {
  const seen = new Set([key(start.x, start.y)]);
  const queue = [start];
  while (queue.length) {
    const t = queue.pop()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const n = { x: t.x + dx, y: t.y + dy };
      if (walkable(n.x, n.y) && !seen.has(key(n.x, n.y))) {
        seen.add(key(n.x, n.y));
        queue.push(n);
      }
    }
  }
  return seen;
}
export const tileKey = key;

export type Placed = { id: string; lot: string; rect: Rect; door: Tile; archetype: Archetype };
export type CityLayout = {
  plots: Placed[];
  vault: { id: string; rect: Rect; door: Tile } | null;
  landmarks: (LandmarkLot & { archetype: Archetype })[];
};

/**
 * Puts each entry of the content map on one lot, in ledger order: the first free lot drawn for one
 * of its archetypes, else the first free generic lot, else any free lot (both keeping its first
 * archetype). Only `kind`
 * and `domains` choose; never the tier, metrics or lens weights. Throws when the plan runs out.
 */
/** What the city needs of the content map: no tier, no place, no text (sent to the page as is). */
export type CityData = {
  plots: Pick<CityPlot, "id" | "kind" | "domains">[];
  vault: { id: string } | null;
  landmarks: { id: Landmark }[];
};

export function assignLots(map: CityData): CityLayout {
  const free = new Set(PLOT_LOTS.map((l) => l.id));
  const plots = map.plots.map((p): Placed => {
    const wanted = archetypesFor(p.kind, p.domains);
    const drawn = wanted.map((a) => PLOT_LOTS.find((l) => l.suits === a && free.has(l.id))).find(Boolean);
    const lot = drawn ?? PLOT_LOTS.find((l) => l.suits === null && free.has(l.id)) ?? PLOT_LOTS.find((l) => free.has(l.id));
    if (!lot) throw new Error(`city plan: no lot left for ${p.id}`);
    free.delete(lot.id);
    return { id: p.id, lot: lot.id, rect: lot.rect, door: lot.door, archetype: drawn ? lot.suits! : wanted[0]! };
  });
  const landmarks = map.landmarks.map(({ id }) => ({ ...LANDMARK_LOTS.find((l) => l.id === id)!, archetype: id as Archetype }));
  return { plots, vault: map.vault ? { id: map.vault.id, ...VAULT_LOT } : null, landmarks };
}
