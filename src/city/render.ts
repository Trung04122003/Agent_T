// Draws Agent T City's static scene (ROADMAP-v4 34.3): ground, streets, canal and bridges, alleys,
// then every building in painter's order. Faces are shaded from one fixed light; vertical walls get
// window grids, tops a rim of edge light. Everything here is drawn once per zoom bucket into baked
// chunks (bake.ts), never per frame. Coordinates are screen pixels at zoom 1 (iso.ts).
import { building, type Solid, type Tone } from "./archetypes";
import { toScreen, type World } from "./engine/iso";
import { mix, type Palette } from "./palette";
import { ALLEYS, CANAL, GRID, isBridge, LAMPS, PLAZA, walkable, type CityLayout, type Rect, type Tile } from "./plan";

/** Direction toward the light (unnormalised): high, from the screen's upper left. */
const LIGHT = norm([-0.45, 0.55, 0.85]);
/** Toward the viewer: moving along it does not move a point on screen (iso.ts). */
const VIEW = [1, 1, 1] as const;

type Vec = readonly [number, number, number];
function norm([x, y, z]: Vec): Vec {
  const l = Math.hypot(x, y, z);
  return [x / l, y / l, z / l];
}
const dot = (a: Vec, b: Vec): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

export type Box = { x0: number; y0: number; x1: number; y1: number };
/** One thing to draw, with its screen box (zoom 1) so a chunk draws only what it overlaps. */
export type Item = { box: Box; draw: (ctx: CanvasRenderingContext2D, p: Palette, lw: number) => void };
export type Scene = { items: Item[]; bounds: Box };

type Face = { pts: World[]; n: Vec };

/** Convex solids as faces; only the ones turned to the viewer are kept. */
function faces(s: Solid): Face[] {
  const out: Face[] = [];
  const add = (pts: World[], n: Vec) => {
    if (dot(n, VIEW) > 1e-9) out.push({ pts, n: norm(n) });
  };
  switch (s.type) {
    case "box": {
      const { x, y, z, w, d, h } = s;
      const X = x + w;
      const Y = y + d;
      const Z = z + h;
      add([{ x, y, z: Z }, { x: X, y, z: Z }, { x: X, y: Y, z: Z }, { x, y: Y, z: Z }], [0, 0, 1]);
      add([{ x: X, y, z }, { x: X, y: Y, z }, { x: X, y: Y, z: Z }, { x: X, y, z: Z }], [1, 0, 0]);
      add([{ x, y: Y, z }, { x: X, y: Y, z }, { x: X, y: Y, z: Z }, { x, y: Y, z: Z }], [0, 1, 0]);
      break;
    }
    case "gable": {
      const { x, y, z, w, d, h } = s;
      const Z = z + h;
      if (s.ridge === "y") {
        const m = x + w / 2;
        add([{ x, y, z }, { x: m, y, z: Z }, { x: m, y: y + d, z: Z }, { x, y: y + d, z }], [-h, 0, w / 2]);
        add([{ x: m, y, z: Z }, { x: x + w, y, z }, { x: x + w, y: y + d, z }, { x: m, y: y + d, z: Z }], [h, 0, w / 2]);
        add([{ x, y: y + d, z }, { x: x + w, y: y + d, z }, { x: m, y: y + d, z: Z }], [0, 1, 0]);
      } else {
        const m = y + d / 2;
        add([{ x, y, z }, { x: x + w, y, z }, { x: x + w, y: m, z: Z }, { x, y: m, z: Z }], [0, -h, d / 2]);
        add([{ x, y: m, z: Z }, { x: x + w, y: m, z: Z }, { x: x + w, y: y + d, z }, { x, y: y + d, z }], [0, h, d / 2]);
        add([{ x: x + w, y, z }, { x: x + w, y: y + d, z }, { x: x + w, y: m, z: Z }], [1, 0, 0]);
      }
      break;
    }
    case "frustum": {
      const { cx, cy, z, r0, r1, h, sides } = s;
      const at = (i: number, r: number, zz: number): World => {
        const a = (i / sides) * Math.PI * 2 + Math.PI / sides;
        return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, z: zz };
      };
      for (let i = 0; i < sides; i++) {
        const a = ((i + 0.5) / sides) * Math.PI * 2 + Math.PI / sides;
        add([at(i, r0, z), at(i + 1, r0, z), at(i + 1, r1, z + h), at(i, r1, z + h)], [Math.cos(a) * h, Math.sin(a) * h, r0 - r1]);
      }
      if (r1 > 0.06) add(Array.from({ length: sides }, (_, i) => at(i, r1, z + h)), [0, 0, 1]);
      break;
    }
    case "mast":
      break;
  }
  return out;
}

/** How lit a face is: never fully black, so the shapes stay readable in the dark. */
const shade = (n: Vec): number => 0.18 + 0.82 * Math.max(0, dot(n, LIGHT));

function path(ctx: CanvasRenderingContext2D, pts: readonly World[]): void {
  ctx.beginPath();
  pts.forEach((p, i) => {
    const s = toScreen(p);
    if (i) ctx.lineTo(s.sx, s.sy);
    else ctx.moveTo(s.sx, s.sy);
  });
  ctx.closePath();
}

/** Window grid on a vertical wall: along it from `a` to `b`, from z0 up h. Glass gets mullions. */
function windows(ctx: CanvasRenderingContext2D, p: Palette, lw: number, a: World, b: World, z0: number, h: number, tone: Tone): void {
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const along = (t: number, z: number): World => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z });
  if (tone === "glass") {
    ctx.strokeStyle = p.edge;
    ctx.lineWidth = lw;
    ctx.beginPath();
    const cols = Math.floor(len / 0.35);
    for (let i = 1; i < cols; i++) {
      const s0 = toScreen(along(i / cols, z0 + 0.1));
      const s1 = toScreen(along(i / cols, z0 + h - 0.1));
      ctx.moveTo(s0.sx, s0.sy);
      ctx.lineTo(s1.sx, s1.sy);
    }
    ctx.stroke();
    return;
  }
  const floors = Math.floor((h - 0.2) / 0.55);
  const cols = Math.floor((len - 0.3) / 0.5);
  if (floors < 1 || cols < 1) return;
  ctx.fillStyle = p.window;
  ctx.beginPath();
  const fw = 0.18 / len;
  for (let f = 0; f < floors; f++) {
    const zb = z0 + 0.25 + f * 0.55;
    for (let c = 0; c < cols; c++) {
      const t = (0.15 + (c + 0.5) * ((len - 0.3) / cols)) / len;
      const q = [along(t - fw / 2, zb), along(t + fw / 2, zb), along(t + fw / 2, zb + 0.28), along(t - fw / 2, zb + 0.28)].map(toScreen);
      ctx.moveTo(q[0]!.sx, q[0]!.sy);
      for (const s of q.slice(1)) ctx.lineTo(s.sx, s.sy);
      ctx.closePath();
    }
  }
  ctx.fill();
}

function drawSolid(ctx: CanvasRenderingContext2D, s: Solid, p: Palette, lw: number): void {
  if (s.type === "mast") {
    const a = toScreen({ x: s.x, y: s.y, z: s.z });
    const b = toScreen({ x: s.x, y: s.y, z: s.z + s.h });
    ctx.strokeStyle = p.trim.dark;
    ctx.lineWidth = 1.5 * lw;
    ctx.beginPath();
    ctx.moveTo(a.sx, a.sy);
    ctx.lineTo(b.sx, b.sy);
    ctx.stroke();
    if (s.lit) {
      // A streetlamp's head: a short arm and a lit shade (its pool of light is the night engine's).
      ctx.fillStyle = p.glow;
      ctx.fillRect(b.sx - 3 * lw, b.sy - 1.5 * lw, 6 * lw, 3 * lw);
      return;
    }
    ctx.fillStyle = p.lamp; // a dead light on top
    ctx.fillRect(b.sx - 1.5 * lw, b.sy - 1.5 * lw, 3 * lw, 3 * lw);
    return;
  }
  const ramp = p[s.tone];
  for (const f of faces(s)) {
    path(ctx, f.pts);
    ctx.fillStyle = mix(ramp.dark, ramp.light, shade(f.n));
    ctx.fill();
    // A wall's first two points are its bottom edge (faces() lists them so).
    if (s.type === "box" && s.windows && f.n[2] === 0 && s.h >= 0.8) windows(ctx, p, lw, f.pts[0]!, f.pts[1]!, s.z, s.h, s.tone);
    if (f.n[2] > 0.99) {
      // Rim light along the top edges.
      ctx.strokeStyle = p.edge;
      ctx.lineWidth = lw;
      ctx.stroke();
    }
  }
  if (s.type === "box") {
    // The near vertical edge catches the light too.
    const a = toScreen({ x: s.x + s.w, y: s.y + s.d, z: s.z });
    const b = toScreen({ x: s.x + s.w, y: s.y + s.d, z: s.z + s.h });
    ctx.strokeStyle = p.edge;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(a.sx, a.sy);
    ctx.lineTo(b.sx, b.sy);
    ctx.stroke();
  }
}

function boxOf(points: readonly World[]): Box {
  const s = points.map(toScreen);
  return {
    x0: Math.min(...s.map((q) => q.sx)) - 4,
    y0: Math.min(...s.map((q) => q.sy)) - 4,
    x1: Math.max(...s.map((q) => q.sx)) + 4,
    y1: Math.max(...s.map((q) => q.sy)) + 4,
  };
}
const corners = (r: Rect, z0 = 0, z1 = 0): World[] =>
  [z0, z1].flatMap((z) => [
    { x: r.x, y: r.y, z },
    { x: r.x + r.w, y: r.y, z },
    { x: r.x + r.w, y: r.y + r.d, z },
    { x: r.x, y: r.y + r.d, z },
  ]);

/** A building as one item: solids by height, then nearer first within the same height. */
function buildingItem(solids: Solid[], lot: Rect): Item {
  const top = Math.max(...solids.map((s) => s.z + s.h));
  const ordered = [...solids].sort((a, b) => a.z - b.z || centre(a) - centre(b));
  return { box: boxOf(corners(lot, 0, top)), draw: (ctx, p, lw) => ordered.forEach((s) => drawSolid(ctx, s, p, lw)) };
}
function centre(s: Solid): number {
  switch (s.type) {
    case "box":
    case "gable":
      return s.x + s.w / 2 + s.y + s.d / 2;
    case "frustum":
      return s.cx + s.cy;
    case "mast":
      return s.x + s.y;
  }
}

function tilePath(ctx: CanvasRenderingContext2D, tiles: Iterable<Tile>): void {
  ctx.beginPath();
  for (const { x, y } of tiles) {
    const q = [toScreen({ x, y }), toScreen({ x: x + 1, y }), toScreen({ x: x + 1, y: y + 1 }), toScreen({ x, y: y + 1 })];
    ctx.moveTo(q[0]!.sx, q[0]!.sy);
    for (const s of q.slice(1)) ctx.lineTo(s.sx, s.sy);
    ctx.closePath();
  }
}

/** The whole static scene for a layout: ground first, then buildings far to near. */
export function cityScene(layout: CityLayout): Scene {
  const all: Tile[] = [];
  for (let x = 0; x < GRID; x++) for (let y = 0; y < GRID; y++) all.push({ x, y });
  const streets = all.filter((t) => walkable(t.x, t.y) && !isBridge(t.x, t.y));
  const bridges = all.filter((t) => isBridge(t.x, t.y));
  const grid: Rect = { x: 0, y: 0, w: GRID, d: GRID };
  const canal: Rect = { x: 0, y: CANAL.y[0], w: GRID, d: CANAL.y.length };
  const ground: Item = {
    box: boxOf(corners(grid)),
    draw(ctx, p, lw) {
      path(ctx, corners(grid).slice(0, 4));
      ctx.fillStyle = p.ground;
      ctx.fill();
      tilePath(ctx, streets);
      ctx.fillStyle = p.street;
      ctx.fill();
      path(ctx, corners(PLAZA).slice(0, 4));
      ctx.fillStyle = p.plaza;
      ctx.fill();
      // Paving joints on the plaza and a dashed centre line down each avenue.
      ctx.strokeStyle = p.marking;
      ctx.lineWidth = lw;
      ctx.beginPath();
      for (let i = 1; i < PLAZA.w; i++) {
        line(ctx, { x: PLAZA.x + i, y: PLAZA.y }, { x: PLAZA.x + i, y: PLAZA.y + PLAZA.d });
        line(ctx, { x: PLAZA.x, y: PLAZA.y + i }, { x: PLAZA.x + PLAZA.w, y: PLAZA.y + i });
      }
      for (let v = 4; v < 40; v += 1.5) {
        if (v + 1 >= PLAZA.x && v <= PLAZA.x + PLAZA.w) continue;
        line(ctx, { x: v, y: 22 }, { x: v + 0.7, y: 22 });
        line(ctx, { x: 22, y: v }, { x: 22, y: v + 0.7 });
      }
      ctx.stroke();
      path(ctx, corners(canal).slice(0, 4));
      ctx.fillStyle = p.canal;
      ctx.fill();
      // The banks catch the rim light; a few long ripples on the water.
      ctx.strokeStyle = p.edge;
      ctx.beginPath();
      line(ctx, { x: 0, y: CANAL.y[0] }, { x: GRID, y: CANAL.y[0] });
      line(ctx, { x: 0, y: CANAL.y[1] + 1 }, { x: GRID, y: CANAL.y[1] + 1 });
      ctx.stroke();
      ctx.strokeStyle = p.marking;
      ctx.beginPath();
      for (const [x0, x1, y] of [[1, 9, 31.6], [12, 19, 32.3], [24, 33, 31.5], [35, 43, 32.4]] as const) line(ctx, { x: x0, y }, { x: x1, y });
      ctx.stroke();
      tilePath(ctx, bridges);
      ctx.fillStyle = p.street;
      ctx.fill();
      ctx.strokeStyle = p.edge;
      ctx.beginPath();
      for (const b of bridges) {
        line(ctx, { x: b.x, y: CANAL.y[0], z: 0.15 }, { x: b.x + 1, y: CANAL.y[0], z: 0.15 });
        line(ctx, { x: b.x, y: CANAL.y[1] + 1, z: 0.15 }, { x: b.x + 1, y: CANAL.y[1] + 1, z: 0.15 });
      }
      ctx.stroke();
      tilePath(ctx, ALLEYS.flatMap((a) => a.tiles));
      ctx.fillStyle = p.alley;
      ctx.fill();
    },
  };
  type Placed = { solids: Solid[]; lot: Rect };
  const placed: Placed[] = [
    ...layout.plots.map((pl) => ({ solids: building(pl.archetype, pl.rect, pl.lot), lot: pl.rect })),
    ...layout.landmarks.map((l) => ({ solids: building(l.archetype, l.rect, l.id), lot: l.rect })),
    ...(layout.vault ? [{ solids: building("vault-monolith", layout.vault.rect, "vault"), lot: layout.vault.rect }] : []),
    // The Atlas table's site at the plaza's heart (the table itself is P40): a low brass dais.
    { solids: [{ type: "frustum", cx: 22, cy: 22, z: 0, r0: 2.6, r1: 2.4, h: 0.18, sides: 16, tone: "trim" }], lot: { x: 19.4, y: 19.4, w: 5.2, d: 5.2 } },
    ...ALLEYS.map((a) => ({ solids: alleyProps(a.tiles), lot: rectAround(a.tiles.at(-1)!) })),
    ...LAMPS.map((l): Placed => ({ solids: [{ type: "mast", x: l.x, y: l.y, z: 0, h: 1.6, lit: true }], lot: { x: l.x - 0.1, y: l.y - 0.1, w: 0.2, d: 0.2 } })),
  ];
  const ordered = placed.sort((a, b) => a.lot.x + a.lot.w / 2 + a.lot.y + a.lot.d / 2 - (b.lot.x + b.lot.w / 2 + b.lot.y + b.lot.d / 2));
  const items = [ground, ...ordered.map((b) => buildingItem(b.solids, b.lot))];
  const bounds = items.reduce((u, i) => ({ x0: Math.min(u.x0, i.box.x0), y0: Math.min(u.y0, i.box.y0), x1: Math.max(u.x1, i.box.x1), y1: Math.max(u.y1, i.box.y1) }), {
    x0: Infinity,
    y0: Infinity,
    x1: -Infinity,
    y1: -Infinity,
  });
  return { items, bounds };
}

function line(ctx: CanvasRenderingContext2D, a: World, b: World): void {
  const s = toScreen(a);
  const e = toScreen(b);
  ctx.moveTo(s.sx, s.sy);
  ctx.lineTo(e.sx, e.sy);
}
const rectAround = (t: Tile): Rect => ({ x: t.x, y: t.y, w: 1, d: 1 });

/** The alley's pocket: a doorway recess at its far end and a lamp that does not work. */
function alleyProps(tiles: readonly Tile[]): Solid[] {
  const end = tiles.at(-1)!;
  const prev = tiles.at(-2)!;
  const dx = end.x - prev.x;
  const dy = end.y - prev.y;
  // The recess stands against the far side of the pocket, facing back down the alley.
  const door: Solid =
    dx !== 0
      ? { type: "box", x: dx > 0 ? end.x + 0.8 : end.x, y: end.y + 0.25, z: 0, w: 0.2, d: 0.5, h: 0.95, tone: "dark", windows: false }
      : { type: "box", x: end.x + 0.25, y: dy > 0 ? end.y + 0.8 : end.y, z: 0, w: 0.5, d: 0.2, h: 0.95, tone: "dark", windows: false };
  return [door, { type: "mast", x: end.x + (dx !== 0 ? 0.5 : 0.15), y: end.y + (dy !== 0 ? 0.5 : 0.15), z: 0, h: 1.3 }];
}

/** Draws the items overlapping `view` (zoom-1 screen box). */
export function drawScene(ctx: CanvasRenderingContext2D, scene: Scene, p: Palette, view: Box, lw: number): number {
  let n = 0;
  for (const it of scene.items) {
    if (it.box.x1 < view.x0 || it.box.x0 > view.x1 || it.box.y1 < view.y0 || it.box.y0 > view.y1) continue;
    it.draw(ctx, p, lw);
    n++;
  }
  return n;
}

/** One building on its own (the dev sheet). */
export function drawBuilding(ctx: CanvasRenderingContext2D, solids: Solid[], lot: Rect, p: Palette, lw: number): void {
  buildingItem(solids, lot).draw(ctx, p, lw);
}
