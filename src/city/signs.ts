// District signs (ROADMAP-v4 35.3, UX-v4 section 4 "sealed: sign shows redaction bars"): one per entry
// building, a dark panel on its lit wall framed by a brass tube, holding three redaction bars. The
// bars "stir" the way the dossier's do (src/scripts/stir.ts: its STIR timing, handed in by the route
// at build time, so the city's code never shares a module with dossier pages): now and then one
// sign seethes for 200 ms, its bars redrawn every 50 ms, then settles back. Mat only; never with
// reduced motion. Nothing on a sign is text, real or invented. Drawn on the dynamic layer only when
// something changed; the hot path allocates nothing.
import { building, type Solid } from "./archetypes";
import { TILE, Z_PX } from "./engine/iso";
import type { Palette } from "./palette";
import type { CityLayout } from "./plan";

const HX = TILE.w / 2;
const HY = TILE.h / 2;
const BARS = 3;
/** Quiet time between two stirs, ms (one sign at a time). */
const PAUSE = { min: 2500, span: 4000 } as const;

export type Signs = {
  readonly count: number;
  /** Sign centres in zoom-1 screen px (x, y pairs), for the night engine's glows. */
  readonly centres: Float64Array;
  /** Advances the stir; true when the bars changed and the layer needs redrawing. */
  update(now: number, enabled: boolean): boolean;
  draw(ctx: CanvasRenderingContext2D, ox: number, oy: number, zoom: number, dpr: number, p: Palette): void;
  /** A declassified district's sign: its bars slid off (P37). Index as in the layout's plots. */
  setClear(index: number, clear: boolean): void;
};

/** The wall a sign hangs on: the entry building's ground box, its face toward the light (+y). */
function wallOf(solids: readonly Solid[]): (Solid & { type: "box" }) | null {
  for (const s of solids) if (s.type === "box" && s.z === 0 && s.h >= 0.5) return s;
  return null;
}

/** The dossier's stir timing (src/scripts/stir.ts STIR): how long a stir lasts, how often it redraws. */
export type StirTiming = { ms: number; step: number };

/**
 * `names`: each plot's district codename (copy-review.md), written on its sign once the bars are off:
 * a place name, never a fact about the entry.
 */
export function createSigns(layout: CityLayout, stir: StirTiming, names: readonly string[] = []): Signs {
  const walls = layout.plots.map((p) => wallOf(building(p.archetype, p.rect, p.lot))).filter((w): w is Solid & { type: "box" } => w !== null);
  const n = walls.length;
  // Per sign: origin (bottom left), the panel's width vector and height vector, all zoom-1 screen px.
  const geo = new Float64Array(n * 6);
  const centres = new Float64Array(n * 2);
  walls.forEach((b, i) => {
    const u0 = b.x + 0.3;
    const u1 = b.x + Math.min(1.7, b.w - 0.3);
    const z0 = b.z + Math.min(0.25, b.h * 0.25);
    const z1 = Math.min(b.z + b.h - 0.08, z0 + 0.55);
    const y = b.y + b.d;
    const sx = (x: number) => (x - y) * HX;
    const sy = (x: number, z: number) => (x + y) * HY - z * Z_PX;
    geo[i * 6] = sx(u0);
    geo[i * 6 + 1] = sy(u0, z0);
    geo[i * 6 + 2] = sx(u1) - sx(u0);
    geo[i * 6 + 3] = sy(u1, z0) - sy(u0, z0);
    geo[i * 6 + 4] = 0;
    geo[i * 6 + 5] = -(z1 - z0) * Z_PX;
    centres[i * 2] = geo[i * 6]! + geo[i * 6 + 2]! / 2 + geo[i * 6 + 4]! / 2;
    centres[i * 2 + 1] = geo[i * 6 + 1]! + geo[i * 6 + 3]! / 2 + geo[i * 6 + 5]! / 2;
  });
  // Bar lengths (share of the panel): a settled pattern per sign, and the live ones.
  const rest = new Float64Array(n * BARS);
  for (let i = 0; i < rest.length; i++) rest[i] = [0.86, 0.62, 0.74][i % BARS]! - (Math.floor(i / BARS) % 3) * 0.06;
  const live = Float64Array.from(rest);
  const clear = new Uint8Array(n);
  let seed = 12345;
  const rand = (): number => {
    seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
    return (seed >>> 0) / 4294967296;
  };
  let active = -1;
  let ends = 0;
  let step = 0;
  let next = 1500;

  return {
    count: n,
    centres,
    update(now, enabled) {
      if (!n) return false;
      if (!enabled) {
        if (active < 0) return false;
        for (let b = 0; b < BARS; b++) live[active * BARS + b] = rest[active * BARS + b]!;
        active = -1;
        next = now + PAUSE.min;
        return true;
      }
      if (active >= 0 && now >= ends) {
        for (let b = 0; b < BARS; b++) live[active * BARS + b] = rest[active * BARS + b]!;
        active = -1;
        next = now + PAUSE.min + rand() * PAUSE.span;
        return true;
      }
      if (active < 0 && now >= next) {
        active = Math.floor(rand() * n);
        ends = now + stir.ms;
        step = 0;
      }
      if (active >= 0 && now >= step) {
        for (let b = 0; b < BARS; b++) live[active * BARS + b] = 0.3 + rand() * 0.66;
        step = now + stir.step;
        return true;
      }
      return false;
    },
    setClear(index, c) {
      if (index >= 0 && index < n) clear[index] = c ? 1 : 0;
    },
    draw(ctx, ox, oy, zoom, dpr, p) {
      const s = zoom * dpr;
      ctx.setTransform(s, 0, 0, s, -ox * dpr, -oy * dpr);
      ctx.lineWidth = 1.6 / zoom;
      ctx.lineJoin = "round";
      for (let i = 0; i < n; i++) {
        const x = geo[i * 6]!;
        const y = geo[i * 6 + 1]!;
        const ux = geo[i * 6 + 2]!;
        const uy = geo[i * 6 + 3]!;
        const zx = geo[i * 6 + 4]!;
        const zy = geo[i * 6 + 5]!;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + ux, y + uy);
        ctx.lineTo(x + ux + zx, y + uy + zy);
        ctx.lineTo(x + zx, y + zy);
        ctx.closePath();
        ctx.fillStyle = p.night;
        ctx.fill();
        ctx.strokeStyle = p.glow;
        ctx.stroke();
        if (clear[i]) {
          // Clear signage: the codename along the panel, fitted to it.
          const name = names[i];
          if (!name) continue;
          const L = Math.hypot(ux, uy);
          const h = -zy;
          ctx.save();
          ctx.transform(ux / L, uy / L, 0, 1, x, y + zy * 0.5);
          ctx.font = `600 ${Math.round(h * 0.5)}px "IBM Plex Mono", ui-monospace, monospace`;
          const w = ctx.measureText(name).width;
          const fit = Math.min(1, (L * 0.86) / w);
          ctx.scale(fit, 1);
          ctx.fillStyle = p.glow;
          ctx.textBaseline = "middle";
          ctx.fillText(name, (L * 0.07) / fit, 0);
          ctx.restore();
          continue;
        }
        ctx.fillStyle = p.redact;
        ctx.beginPath();
        for (let b = 0; b < BARS; b++) {
          const f0 = 0.2 + b * 0.25;
          const f1 = f0 + 0.15;
          const len = live[i * BARS + b]! * 0.84;
          const ax = x + ux * 0.08;
          const ay = y + uy * 0.08;
          ctx.moveTo(ax + zx * f0, ay + zy * f0);
          ctx.lineTo(ax + ux * len + zx * f0, ay + uy * len + zy * f0);
          ctx.lineTo(ax + ux * len + zx * f1, ay + uy * len + zy * f1);
          ctx.lineTo(ax + zx * f1, ay + zy * f1);
          ctx.closePath();
        }
        ctx.fill();
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    },
  };
}
