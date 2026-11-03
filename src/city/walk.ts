// Where Agent T can walk (ROADMAP-v4 36.2, UX-v4 section 3): anywhere on the ground except inside a
// building's footprint, in the canal (bridges excepted) or off the grid. Pointer moves follow the road
// graph (streets, plaza, bridges, alleys) with A*; keyboard moves slide along walls (each axis on its
// own). He can never get stuck: a position inside a footprint snaps to the nearest free tile.
// Pure functions on numbers and typed arrays, so they are unit-tested without a canvas.
import { ALLEYS, ATLAS_TABLE, GRID, isBridge, isCanal, walkable, type CityLayout, type Tile } from "./plan";

/** A building footprint, world units (the lot without its sidewalk). */
export type Footprint = { id: string; x0: number; y0: number; x1: number; y1: number; door: Tile };
export type WalkWorld = {
  footprints: Footprint[];
  /** 1 for tiles on the road graph (GRID x GRID, row major by y). */
  roads: Uint8Array;
};

/** Agent T's radius on the ground, in tiles. */
export const BODY = 0.22;
const SIDEWALK = 0.5;

export function walkWorld(layout: CityLayout): WalkWorld {
  const fp = (id: string, r: { x: number; y: number; w: number; d: number }, door: Tile): Footprint => ({
    id,
    x0: r.x + SIDEWALK,
    y0: r.y + SIDEWALK,
    x1: r.x + r.w - SIDEWALK,
    y1: r.y + r.d - SIDEWALK,
    door,
  });
  const footprints = [
    ...layout.plots.map((p) => fp(p.id, p.rect, p.door)),
    ...layout.landmarks.map((l) => fp(l.id, l.rect, l.door)),
    ...(layout.vault ? [fp(layout.vault.id, layout.vault.rect, layout.vault.door)] : []),
  ];
  const roads = new Uint8Array(GRID * GRID);
  for (let y = 0; y < GRID; y++) for (let x = 0; x < GRID; x++) if (walkable(x, y)) roads[y * GRID + x] = 1;
  for (const a of ALLEYS) for (const t of a.tiles) roads[t.y * GRID + t.x] = 1;
  // The Atlas table stands on the plaza: tiles it covers leave the road graph.
  // A tile goes if any part of it is within reach (its point nearest the table's centre), so a walk
  // between two tile centres never cuts a corner of the table.
  const near = (v: number, c: number) => Math.min(v + 1, Math.max(v, c));
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) if (onTable(near(x, ATLAS_TABLE.x), near(y, ATLAS_TABLE.y), BODY)) roads[y * GRID + x] = 0;
  }
  return { footprints, roads };
}

const water = (x: number, y: number): boolean => {
  const tx = Math.floor(x);
  const ty = Math.floor(y);
  return isCanal(tx, ty) && !isBridge(tx, ty);
};

/** Within reach of the Atlas table (a square turned 45 degrees: |dx| + |dy| <= r)? */
const onTable = (x: number, y: number, r: number): boolean => Math.abs(x - ATLAS_TABLE.x) + Math.abs(y - ATLAS_TABLE.y) < ATLAS_TABLE.r + r * Math.SQRT2;

/** Is a disc of radius r at (x, y) clear of footprints, the Atlas table, water and the grid's edge? */
export function free(w: WalkWorld, x: number, y: number, r = BODY): boolean {
  if (x - r < 0 || y - r < 0 || x + r > GRID || y + r > GRID) return false;
  if (water(x - r, y - r) || water(x + r, y - r) || water(x - r, y + r) || water(x + r, y + r)) return false;
  if (onTable(x, y, r)) return false;
  for (let i = 0; i < w.footprints.length; i++) {
    const f = w.footprints[i]!;
    if (x + r > f.x0 && x - r < f.x1 && y + r > f.y0 && y - r < f.y1) return false;
  }
  return true;
}

/** Moves `p` by (dx, dy), one axis at a time, so a wall stops one axis and the other slides. */
export function slide(w: WalkWorld, p: { x: number; y: number }, dx: number, dy: number): void {
  if (dx && free(w, p.x + dx, p.y)) p.x += dx;
  if (dy && free(w, p.x, p.y + dy)) p.y += dy;
}

/** Breadth-first from a tile to the first one that passes `ok` (null if none on the grid). */
function nearest(tx: number, ty: number, ok: (x: number, y: number) => boolean): Tile | null {
  const sx = Math.min(GRID - 1, Math.max(0, Math.floor(tx)));
  const sy = Math.min(GRID - 1, Math.max(0, Math.floor(ty)));
  const seen = new Uint8Array(GRID * GRID);
  const queue = [sx, sy];
  seen[sy * GRID + sx] = 1;
  for (let i = 0; i < queue.length; i += 2) {
    const x = queue[i]!;
    const y = queue[i + 1]!;
    if (ok(x, y)) return { x, y };
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= GRID || ny >= GRID || seen[ny * GRID + nx]) continue;
      seen[ny * GRID + nx] = 1;
      queue.push(nx, ny);
    }
  }
  return null;
}

/** The never-stuck fallback: the centre of the nearest tile Agent T can stand on. */
export function nearestFree(w: WalkWorld, x: number, y: number): { x: number; y: number } {
  const t = nearest(x, y, (tx, ty) => free(w, tx + 0.5, ty + 0.5));
  return t ? { x: t.x + 0.5, y: t.y + 0.5 } : { x: GRID / 2, y: GRID / 2 };
}
export const nearestRoad = (w: WalkWorld, x: number, y: number): Tile | null => nearest(x, y, (tx, ty) => w.roads[ty * GRID + tx] === 1);

/** A* over the road graph (4 neighbours, Manhattan distance). Tiles from start to goal, both included. */
export function findPath(w: WalkWorld, from: Tile, to: Tile): Tile[] | null {
  const N = GRID * GRID;
  const at = (t: Tile) => t.y * GRID + t.x;
  if (!w.roads[at(from)] || !w.roads[at(to)]) return null;
  const g = new Float64Array(N).fill(Infinity);
  const came = new Int32Array(N).fill(-1);
  const closed = new Uint8Array(N);
  const open: number[] = [at(from)];
  const h = (i: number) => Math.abs((i % GRID) - to.x) + Math.abs(Math.floor(i / GRID) - to.y);
  g[at(from)] = 0;
  while (open.length) {
    // The open set stays small on a 44 x 44 grid: a linear scan for the best node is enough.
    let best = 0;
    for (let i = 1; i < open.length; i++) if (g[open[i]!]! + h(open[i]!) < g[open[best]!]! + h(open[best]!)) best = i;
    const cur = open.splice(best, 1)[0]!;
    if (cur === at(to)) {
      const path: Tile[] = [];
      for (let c = cur; c !== -1; c = came[c]!) path.push({ x: c % GRID, y: Math.floor(c / GRID) });
      return path.reverse();
    }
    closed[cur] = 1;
    const cx = cur % GRID;
    const cy = Math.floor(cur / GRID);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= GRID || ny >= GRID) continue;
      const n = ny * GRID + nx;
      if (!w.roads[n] || closed[n]) continue;
      const cost = g[cur]! + 1;
      if (cost < g[n]!) {
        if (g[n] === Infinity) open.push(n);
        g[n] = cost;
        came[n] = cur;
      }
    }
  }
  return null;
}

/** The building whose footprint holds a ground point, if any. */
export function footprintAt(w: WalkWorld, x: number, y: number): Footprint | null {
  for (const f of w.footprints) if (x >= f.x0 && x <= f.x1 && y >= f.y0 && y <= f.y1) return f;
  return null;
}
