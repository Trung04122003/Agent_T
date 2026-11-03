// Rain (ROADMAP-v4 35.4, UX-v4 section 13): High tier only, Mat only, at most 120 particles, none on
// Medium, Low or with reduced motion. Most are slanted streaks falling through the view; a few run down
// the glass tower's walls (signature moment 8). Positions live in preallocated typed arrays: the
// frame loop moves and draws them without allocating. Drawn on the darkness layer, so rain shows in
// the dark as well as in the light.
import { building } from "./archetypes";
import { TILE, Z_PX } from "./engine/iso";
import type { Tier } from "./engine/quality";
import type { CityLayout } from "./plan";

export const RAIN = { cap: { high: 120, medium: 0, low: 0 } as Record<Tier, number>, onGlass: 18, speed: 900, slant: 0.18, length: 16 } as const;

/** A glass wall as a parallelogram in zoom-1 screen px: origin, width vector, height vector. */
export type GlassWall = [number, number, number, number, number, number];

export type Rain = {
  /** Particles alive now (0 when off). */
  readonly count: number;
  setTier(tier: Tier, allowed: boolean): void;
  /** Moves the drops by dt ms over a view of w x h CSS px. */
  step(dt: number, w: number, h: number): void;
  /** Draws onto a canvas whose pixels are CSS px times k; glass walls need the camera (ox, oy, zoom). */
  draw(ctx: CanvasRenderingContext2D, k: number, ox: number, oy: number, zoom: number, color: string, glassColor: string): void;
};

export function createRain(glass: readonly GlassWall[]): Rain {
  const max = RAIN.cap.high;
  const x = new Float32Array(max);
  const y = new Float32Array(max);
  const v = new Float32Array(max);
  let n = 0;
  let seed = 777;
  const rand = (): number => {
    seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
    return (seed >>> 0) / 4294967296;
  };
  let width = 0;
  let height = 0;
  const glassDrops = glass.length ? RAIN.onGlass : 0;

  const spawn = (i: number, anywhere: boolean): void => {
    if (i < glassDrops) {
      // On glass: x picks the wall and the place along it, y the height (0 top, 1 bottom).
      x[i] = rand() * glass.length;
      y[i] = anywhere ? rand() : 0;
      v[i] = 0.12 + rand() * 0.1;
      return;
    }
    x[i] = rand() * (width + 80) - 40;
    y[i] = anywhere ? rand() * height : -RAIN.length - rand() * 40;
    v[i] = RAIN.speed * (0.8 + rand() * 0.4);
  };

  return {
    get count() {
      return n;
    },
    setTier(tier, allowed) {
      const want = allowed ? RAIN.cap[tier] : 0;
      if (want > n) for (let i = n; i < want; i++) spawn(i, true);
      n = want;
    },
    step(dt, w, h) {
      width = w;
      height = h;
      const s = dt / 1000;
      for (let i = 0; i < n; i++) {
        if (i < glassDrops) {
          y[i] = y[i]! + v[i]! * s;
          if (y[i]! > 1) spawn(i, false);
          continue;
        }
        y[i] = y[i]! + v[i]! * s;
        x[i] = x[i]! - v[i]! * s * RAIN.slant;
        if (y[i]! > h + RAIN.length || x[i]! < -40) spawn(i, false);
      }
    },
    draw(ctx, k, ox, oy, zoom, color, glassColor) {
      if (!n) return;
      // Whole pixels only: fractional arguments to canvas calls are boxed (an allocation per call).
      const dx = Math.round(RAIN.length * RAIN.slant * k) | 0;
      const dy = Math.round(RAIN.length * k) | 0;
      const gy = Math.round(22 * zoom * k) | 0;
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(1, k);
      ctx.beginPath();
      for (let i = glassDrops; i < n; i++) {
        const px = (x[i]! * k) | 0;
        const py = (y[i]! * k) | 0;
        ctx.moveTo(px, py);
        ctx.lineTo(px + dx, py - dy);
      }
      ctx.stroke();
      // Drops running down the glass catch the light: brighter, thicker, slower.
      ctx.strokeStyle = glassColor;
      ctx.lineWidth = Math.max(1, 1.5 * k);
      ctx.beginPath();
      for (let i = 0; i < Math.min(n, glassDrops); i++) {
        const wall = glass[Math.floor(x[i]!) % glass.length]!;
        const along = x[i]! % 1;
        const up = 1 - y[i]!;
        const sx = wall[0] + wall[2] * along + wall[4] * up;
        const sy = wall[1] + wall[3] * along + wall[5] * up;
        const px = ((sx * zoom - ox) * k) | 0;
        const py = ((sy * zoom - oy) * k) | 0;
        ctx.moveTo(px, py);
        ctx.lineTo(px, py - gy);
      }
      ctx.stroke();
    },
  };
}

/** The glass tower's two visible glass walls per glass box, as parallelograms (zoom-1 screen px). */
export function glassWalls(layout: CityLayout): GlassWall[] {
  const sx = (x: number, y: number) => (x - y) * (TILE.w / 2);
  const sy = (x: number, y: number, z: number) => (x + y) * (TILE.h / 2) - z * Z_PX;
  const out: GlassWall[] = [];
  for (const p of layout.plots) {
    for (const s of building(p.archetype, p.rect, p.lot)) {
      if (s.type !== "box" || s.tone !== "glass") continue;
      const X = s.x + s.w;
      const Y = s.y + s.d;
      // +y wall from (x, Y) to (X, Y); +x wall from (X, y) to (X, Y); both from z up h.
      out.push([sx(s.x, Y), sy(s.x, Y, s.z), sx(X, Y) - sx(s.x, Y), sy(X, Y, s.z) - sy(s.x, Y, s.z), 0, -s.h * Z_PX]);
      out.push([sx(X, s.y), sy(X, s.y, s.z), sx(X, Y) - sx(X, s.y), sy(X, Y, s.z) - sy(X, s.y, s.z), 0, -s.h * Z_PX]);
    }
  }
  return out;
}
