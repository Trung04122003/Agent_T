// The night engine (ROADMAP-v4 P35, UX-v4 section 4): the Mat look's darkness, cut by light.
// Two half-resolution canvases (layers.ts): an offscreen light mask (the lantern's cone, clipped to
// its visibility polygon (visibility.ts), so buildings occlude it; streetlamp pools; sign glows) and the visible darkness (the night colour, a few haze
// bands and a static grain, minus the mask; rain on top on the High tier). Every light is a sprite
// baked once at start (pre-made gradients, stamped with drawImage): no blur, no canvas filter, no
// gradient built per frame. The mask is rebuilt only when the view or the lantern moves; the hot
// path allocates nothing (numbers and preallocated arrays only).
import { Z_PX, TILE } from "./engine/iso";
import { mix, TOKENS, type Palette } from "./palette";
import { footprintSegments, insidePolygon, visibilityCache } from "./visibility";

/** The lantern's reach: cone length and half angle (world units, radians), its own small circle. */
export const LANTERN = { reach: 10, half: 0.6, ambient: 2.2 } as const;
const LAMP_POOL = 2.5;
const SIGN_GLOW = 26; // CSS px at zoom 1
/** How strongly lit ground takes the light's colour. */
const TINT = 0.2;
const HX = TILE.w / 2;
const HY = TILE.h / 2;

/** A building that casts the lantern's shadow: its footprint, and its screen silhouette (zoom 1). */
export type Occluder = { x0: number; y0: number; x1: number; y1: number; hull: Float64Array };
/** `power`: 0 shut, 1 fully open (Agent T opens it as he steps out of the alley). */
export type Lantern = { x: number; y: number; heading: number; power: number };
/** Where the canvases look: the camera's top-left in zoom-1 px, the zoom, CSS px to mask px. */
export type NightView = { ox: number; oy: number; zoom: number; k: number };

function sprite(size: number, paint: (ctx: CanvasRenderingContext2D) => void): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  paint(c.getContext("2d")!);
  return c;
}
const rgba = (hex: string, a: number): string => `rgba(${parseInt(hex.slice(1, 3), 16)},${parseInt(hex.slice(3, 5), 16)},${parseInt(hex.slice(5, 7), 16)},${a})`;
/** Light colours (Mat): warm brass lamps and signs, the lantern's cold white (UX-v4 section 6, item 13). */
const WARM = mix(TOKENS.mat.accent, TOKENS.mat.ink, 0.35);
const COLD = TOKENS.mat.ink;

/** A round glow: opaque in the middle, nothing at the rim. Its colour tints what it lights. */
function glowSprite(size: number, hex: string): HTMLCanvasElement {
  return sprite(size, (ctx) => {
    const r = size / 2;
    const g = ctx.createRadialGradient(r, r, 0, r, r, r);
    g.addColorStop(0, rgba(hex, 1));
    g.addColorStop(0.3, rgba(hex, 0.75));
    g.addColorStop(0.65, rgba(hex, 0.25));
    g.addColorStop(1, rgba(hex, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  });
}
/**
 * The lantern's cone, apex at the left middle, pointing right, fading with distance; three nested
 * wedges soften its sides (no blur).
 */
function coneSprite(size: number, hex: string): HTMLCanvasElement {
  return sprite(size, (ctx) => {
    const g = ctx.createRadialGradient(0, size / 2, 0, 0, size / 2, size);
    g.addColorStop(0, rgba(hex, 1));
    g.addColorStop(0.55, rgba(hex, 0.9));
    g.addColorStop(1, rgba(hex, 0));
    ctx.fillStyle = g;
    for (const [spread, a] of [[1, 0.45], [0.8, 0.5], [0.6, 0.6]] as const) {
      ctx.globalAlpha = a;
      ctx.beginPath();
      ctx.moveTo(0, size / 2);
      ctx.lineTo(size, size / 2 - (size / 2) * spread);
      ctx.lineTo(size, size / 2 + (size / 2) * spread);
      ctx.closePath();
      ctx.fill();
    }
  });
}
/** Static film grain: made once from a fixed seed, tiled as a pattern (no per-frame noise). */
function grainSprite(size: number, ink: string): HTMLCanvasElement {
  return sprite(size, (ctx) => {
    let a = 1013904223;
    ctx.fillStyle = ink;
    for (let i = 0; i < size * size * 0.18; i++) {
      a = (Math.imul(a, 1664525) + 1013904223) | 0;
      const x = (a >>> 8) % size;
      a = (Math.imul(a, 1664525) + 1013904223) | 0;
      const y = (a >>> 8) % size;
      ctx.globalAlpha = ((a >>> 4) & 15) / 15;
      ctx.fillRect(x, y, 1, 1);
    }
  });
}

export type Night = {
  /** Rebuilds the light mask (view or lantern moved). */
  light(view: NightView, lantern: Lantern | null, signs: Float64Array, signCount: number): void;
  /** Paints the darkness from the mask; `overlay` draws on top (rain). */
  paint(view: NightView, overlay: ((ctx: CanvasRenderingContext2D) => void) | null): void;
  setPalette(p: Palette): void;
  clear(): void;
};

export function createNight(dark: HTMLCanvasElement, mask: HTMLCanvasElement, lamps: readonly { x: number; y: number }[], occluders: readonly Occluder[], p0: Palette): Night {
  const dctx = dark.getContext("2d")!;
  const mctx = mask.getContext("2d")!;
  const glow = glowSprite(128, WARM);
  const cold = glowSprite(128, COLD);
  const cone = coneSprite(256, COLD);
  let pal = p0;
  const grain = dctx.createPattern(grainSprite(128, "#ffffff"), "repeat")!;
  // What the lantern can see, per quarter-tile cell (visibility.ts).
  const seen = visibilityCache(footprintSegments(occluders), LANTERN.reach + 1);
  /** Is a ground point inside the current visibility polygon? (Corners of a footprint, nudged out.) */
  const sees = (poly: Float64Array, o: Occluder): boolean =>
    insidePolygon(poly, o.x0 - 0.05, o.y0 - 0.05) || insidePolygon(poly, o.x1 + 0.05, o.y0 - 0.05) || insidePolygon(poly, o.x1 + 0.05, o.y1 + 0.05) || insidePolygon(poly, o.x0 - 0.05, o.y1 + 0.05);

  /** World point on the ground -> mask px. */
  let vx = 0;
  let vy = 0;
  let vz = 1;
  let vk = 1;
  // Whole mask pixels: fractional arguments to canvas calls are boxed (an allocation per call).
  const mx = (wx: number, wy: number): number => ((((wx - wy) * HX) * vz - vx) * vk) | 0;
  const my = (wx: number, wy: number): number => ((((wx + wy) * HY) * vz - vy) * vk) | 0;

  /** The cone sprite laid on the ground from (lx, ly) along `heading`, iso-projected. */
  const stampCone = (lx: number, ly: number, heading: number): void => {
    const dx = Math.cos(heading);
    const dy = Math.sin(heading);
    const w = LANTERN.reach * Math.tan(LANTERN.half);
    const su = LANTERN.reach / 256; // world units per sprite px, along the cone
    const sv = (2 * w) / 256; // and across it
    const s = vz * vk;
    // Linear part: sprite x -> world (dx, dy) * su; sprite y -> world (-dy, dx) * sv; then iso.
    const a = (dx - dy) * HX * su * s;
    const b = (dx + dy) * HY * su * s;
    const c = (-dy - dx) * HX * sv * s;
    const d = (-dy + dx) * HY * sv * s;
    const ox = lx + dy * w; // sprite (0, 0): the apex moved half a width to the cone's right
    const oy = ly - dx * w;
    mctx.setTransform(a, b, c, d, mx(ox, oy), my(ox, oy));
    mctx.drawImage(cone, 0, 0);
    mctx.setTransform(1, 0, 0, 1, 0, 0);
  };
  /**
   * A glow on the ground, radius in world units. The iso map takes a ground circle to an ellipse
   * with screen-aligned axes (sqrt 2 times the half tile on each), so a stretched square will do:
   * whole pixels, no transform.
   */
  const stampPool = (wx: number, wy: number, r: number, img: HTMLCanvasElement): void => {
    const rx = (Math.SQRT2 * HX * r * vz * vk) | 0;
    const ry = (Math.SQRT2 * HY * r * vz * vk) | 0;
    mctx.drawImage(img, mx(wx, wy) - rx, my(wx, wy) - ry, 2 * rx, 2 * ry);
  };

  return {
    light(view, lantern, signs, signCount) {
      vx = view.ox;
      vy = view.oy;
      vz = view.zoom;
      vk = view.k;
      const W = mask.width;
      const H = mask.height;
      mctx.globalCompositeOperation = "source-over";
      mctx.clearRect(0, 0, W, H);
      if (pal.nightAlpha === 0) return;
      if (lantern && lantern.power > 0) {
        const { x: lx, y: ly, heading } = lantern;
        const far = LANTERN.reach + 2;
        // The cone, clipped to what the lantern can see: footprints in reach cast its shadows.
        const poly = seen.get(lx, ly);
        mctx.save();
        mctx.beginPath();
        for (let j = 0; j < poly.length; j += 2) {
          if (j) mctx.lineTo(mx(poly[j]!, poly[j + 1]!), my(poly[j]!, poly[j + 1]!));
          else mctx.moveTo(mx(poly[j]!, poly[j + 1]!), my(poly[j]!, poly[j + 1]!));
        }
        mctx.closePath();
        mctx.clip();
        mctx.globalAlpha = lantern.power;
        stampCone(lx, ly, heading);
        mctx.restore();
        // The buildings themselves stand in the light: their faces toward the lantern stay lit.
        mctx.globalCompositeOperation = "source-over";
        for (let i = 0; i < occluders.length; i++) {
          const o = occluders[i]!;
          if (o.x1 < lx - far || o.x0 > lx + far || o.y1 < ly - far || o.y0 > ly + far) continue;
          if (!sees(poly, o)) continue; // wholly behind another building
          const h = o.hull;
          mctx.save();
          mctx.beginPath();
          for (let j = 0; j < h.length; j += 2) {
            const px = ((h[j]! * vz - vx) * vk) | 0;
            const py = ((h[j + 1]! * vz - vy) * vk) | 0;
            if (j) mctx.lineTo(px, py);
            else mctx.moveTo(px, py);
          }
          mctx.closePath();
          mctx.clip();
          mctx.globalAlpha = 0.75 * lantern.power;
          stampCone(lx, ly, heading);
          mctx.restore();
        }
        stampPool(lx, ly, LANTERN.ambient, cold);
      } else if (lantern) {
        // Lantern shut (Agent T still in the alley): only a faint circle at his feet.
        mctx.globalAlpha = 0.25;
        stampPool(lantern.x, lantern.y, LANTERN.ambient * 0.6, cold);
        mctx.globalAlpha = 1;
      }
      for (let i = 0; i < lamps.length; i++) {
        const l = lamps[i]!;
        const px = mx(l.x, l.y);
        const py = my(l.x, l.y);
        if (px < -200 || py < -200 || px > W + 200 || py > H + 200) continue;
        stampPool(l.x, l.y, LAMP_POOL, glow);
      }
      // Signs glow from their brass tubes (positions in zoom-1 screen px).
      const r = (SIGN_GLOW * vz * vk) | 0;
      for (let i = 0; i < signCount; i++) {
        const px = ((signs[i * 2]! * vz - vx) * vk) | 0;
        const py = ((signs[i * 2 + 1]! * vz - vy) * vk) | 0;
        if (px < -r || py < -r || px > W + r || py > H + r) continue;
        mctx.drawImage(glow, px - r, py - r, 2 * r, 2 * r);
      }
    },
    paint(view, overlay) {
      const W = dark.width;
      const H = dark.height;
      dctx.setTransform(1, 0, 0, 1, 0, 0);
      dctx.globalCompositeOperation = "source-over";
      dctx.globalAlpha = 1;
      dctx.clearRect(0, 0, W, H);
      if (pal.nightAlpha === 0) return;
      dctx.globalAlpha = pal.nightAlpha;
      dctx.fillStyle = pal.night;
      dctx.fillRect(0, 0, W, H);
      dctx.globalAlpha = 1;
      // Haze: three thin bands, fixed to the city (they move with it, never on their own).
      dctx.fillStyle = pal.haze;
      const bh = (70 * view.zoom * view.k) | 0;
      for (let i = 0; i < 3; i++) {
        const y = (((260 + i * 430) * view.zoom - view.oy) * view.k) | 0;
        if (y + bh > 0 && y < H) dctx.fillRect(0, y, W, bh);
      }
      // Grain, fixed to the city as well, very faint.
      const gx = (((-view.ox * view.k) % 128) - 128) | 0;
      const gy = (((-view.oy * view.k) % 128) - 128) | 0;
      dctx.globalAlpha = 0.05;
      dctx.setTransform(1, 0, 0, 1, gx, gy);
      dctx.fillStyle = grain;
      dctx.fillRect(0, 0, W + 256, H + 256);
      dctx.setTransform(1, 0, 0, 1, 0, 0);
      dctx.globalAlpha = 1;
      // Cut out whatever is lit, then tint it with the light's own colour.
      dctx.globalCompositeOperation = "destination-out";
      dctx.drawImage(mask, 0, 0);
      dctx.globalCompositeOperation = "source-over";
      dctx.globalAlpha = TINT;
      dctx.drawImage(mask, 0, 0);
      dctx.globalAlpha = 1;
      if (overlay) overlay(dctx);
    },
    setPalette(p) {
      pal = p;
    },
    clear() {
      dctx.clearRect(0, 0, dark.width, dark.height);
      mctx.clearRect(0, 0, mask.width, mask.height);
    },
  };
}

/** Screen silhouette (zoom 1) of a box standing on a footprint: the convex hull of its 8 corners. */
export function hullOf(x0: number, y0: number, x1: number, y1: number, h: number): Float64Array {
  const pts: [number, number][] = [];
  for (const z of [0, h]) {
    for (const [x, y] of [[x0, y0], [x1, y0], [x1, y1], [x0, y1]] as const) pts.push([(x - y) * HX, (x + y) * HY - z * Z_PX]);
  }
  pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: [number, number], a: [number, number], b: [number, number]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: [number, number][] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower.at(-2)!, lower.at(-1)!, p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: [number, number][] = [];
  for (const p of [...pts].reverse()) {
    while (upper.length >= 2 && cross(upper.at(-2)!, upper.at(-1)!, p) <= 0) upper.pop();
    upper.push(p);
  }
  const hull = [...lower.slice(0, -1), ...upper.slice(0, -1)];
  return Float64Array.from(hull.flat());
}
