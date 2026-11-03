// The Atlas table (ROADMAP-v4 P40, UX-v4 section 5): the real map of Viet Nam as a relief on the
// plaza's table, from /city/atlas.json (the 2D map's own geometry, P39). One affine lift puts the map
// on the table's top: north up the screen, the map squashed by half as a table seen from the city's
// angle. Provinces stand as terraces at the 3D map's heights (HEIGHT, handed in by the route from
// src/scripts/map-3d.ts), the sea is a scan grid with a slow sweep, the four places are pins, Da Nang
// the HQ. The relief is baked into a sprite per zoom step and mode; each frame adds only the sweep and
// the provinces rising under the cursor (180 ms up, 160 ms down, the 3D map's ripple; instant with
// reduced motion). Over everything, on the top canvas, the beacon above Da Nang and Hoang Sa and
// Truong Sa: islands and labels that no fog, redaction, fade or zoom ever hides (40.3).
import type { Atlas } from "./atlas";
import { TILE, Z_PX } from "./engine/iso";
import { mix, TOKENS, type Palette } from "./palette";
import { ATLAS_TABLE } from "./plan";

/** The 3D map's constants (src/scripts/map-3d.ts HEIGHT and RISE), and the page's language. */
export type AtlasConsts = {
  height: { world: number; base: number; near: number; home: number; riser: number };
  rise: { by: number; up: number; down: number };
  lang: "vi" | "en";
};

type Step = "base" | "near" | "home";
const STEP_INDEX: Record<Step, number> = { base: 0, near: 1, home: 2 };
const HX = TILE.w / 2;
const HY = TILE.h / 2;
/** One full sweep of the scan line across the sea, ms. */
const SWEEP_MS = 6000;
/** The beacon's slow pulse, ms per beat. */
const PULSE_MS = 4000;
/** Archipelago labels: a fixed size in CSS px, whatever the zoom (never culled, never shrunk away). */
const LABEL_PX = 11;

const ease = (t: number): number => 1 - (1 - t) ** 3; // the 3D map's ease-out

export type AtlasView = {
  /** Advances the ripple; `hover`: the province code under the cursor (or in focus), or null. True while moving. */
  step(dt: number, hover: string | null, reduced: boolean): boolean;
  /** Bakes the relief for a zoom step ahead of time (idle time), so a zoom change never waits for it. */
  prebake(zoom: number, dpr: number, p: Palette): void;
  /** The province under a point of the zoom-1 screen, if any. */
  hit(sx: number, sy: number): string | null;
  /** The baked relief, on the dynamic layer (device px, camera origin ox, oy): only when the view changes. */
  draw(ctx: CanvasRenderingContext2D, ox: number, oy: number, zoom: number, dpr: number, p: Palette): void;
  /**
   * What moves on it, every frame: the sweep and the rising provinces. On the top canvas (a hologram's
   * light, over the fog), or on the dynamic layer when Agent T stands over the table on screen.
   */
  drawLive(ctx: CanvasRenderingContext2D, ox: number, oy: number, zoom: number, dpr: number, p: Palette, now: number, reduced: boolean): void;
  /** The beacon and the archipelagos, on the top canvas (above the darkness). */
  drawTop(ctx: CanvasRenderingContext2D, ox: number, oy: number, zoom: number, dpr: number, p: Palette, now: number, reduced: boolean): void;
  /** The table's screen box (zoom 1), to know when it is in view. */
  readonly box: { x0: number; y0: number; x1: number; y1: number };
  /** Where the last labels were drawn (CSS px of the stage), for tests and tools. */
  labels(): { text: string; x: number; y: number; w: number; h: number }[];
  /** The beacon's last column (CSS px): x, and its foot's y. */
  beacon(): { x: number; y: number };
  /** Da Nang's province (the HQ), for the keyboard's focus when Agent T is at the table. */
  readonly hq: string | null;
};

export function createAtlasView(atlas: Atlas, c: AtlasConsts): AtlasView {
  const [fx, fy, fw, fh] = atlas.focus;
  const mcx = fx + fw / 2;
  const mcy = fy + fh / 2;
  // The table's top on the zoom-1 screen: a square turned to face us is a 2:1 rectangle.
  const T = ATLAS_TABLE;
  const sxc = (T.x - T.y) * HX;
  const syc = (T.x + T.y) * HY - T.h * Z_PX;
  const W = 2 * HX * T.relief;
  const H = 2 * HY * T.relief;
  const K = Math.min((W * 0.92) / fw, (H * 0.92) / 0.5 / fh);
  /** Screen px per unit of the 3D map's heights: the relief's terraces in the same proportion. */
  const L = 0.7 * K;
  const top = c.height.home + c.rise.by;
  const box = { x0: sxc - W / 2 - 4, y0: syc - H / 2 - top * L - 4, x1: sxc + W / 2 + 4, y1: syc + H / 2 + 4 };

  const heightOf = (s: Step) => c.height[s];
  const provinces = atlas.provinces.map((p) => ({ code: p.code, path: new Path2D(p.d), step: p.tier.after as Step }));
  const byCode = new Map(provinces.map((p) => [p.code, p]));
  const world = atlas.countries.filter((x) => x.code !== "VNM").map((x) => new Path2D(x.d));
  const frontier = new Path2D(atlas.frontiers);
  const borders = new Path2D(atlas.borders.kept);
  const hqPlace = atlas.places.find((p) => p.role === "current");
  // Hit testing: a 1 px canvas, never drawn, to ask which path holds a point.
  const probe = document.createElement("canvas").getContext("2d")!;
  const hq = hqPlace ? (provinces.find((p) => probe.isPointInPath(p.path, hqPlace.x, hqPlace.y))?.code ?? null) : null;

  /** Puts the map on a context: map units to device px at height h (`bx`, `by`: the canvas origin, zoom 1). */
  const mapOn = (ctx: CanvasRenderingContext2D, bx: number, by: number, s: number, h: number) =>
    ctx.setTransform(K * s, 0, 0, K * 0.5 * s, (sxc - mcx * K - bx) * s, (syc - mcy * K * 0.5 - by - h * L) * s);

  /** The relief, baked once per zoom step, scale and mode. */
  const sprites = new Map<string, HTMLCanvasElement>();
  const bake = (zoom: number, dpr: number, p: Palette): HTMLCanvasElement => {
    const key = `${p.mode}:${zoom}:${dpr}`;
    const done = sprites.get(key);
    if (done) return done;
    const s = zoom * dpr;
    const cv = document.createElement("canvas");
    cv.width = Math.ceil((box.x1 - box.x0) * s);
    cv.height = Math.ceil((box.y1 - box.y0) * s);
    const g = cv.getContext("2d")!;
    // The table's top: the sea as a scan grid.
    g.setTransform(s, 0, 0, s, -box.x0 * s, -box.y0 * s);
    g.fillStyle = p.atlas.sea;
    g.fillRect(sxc - W / 2, syc - H / 2, W, H);
    g.strokeStyle = p.atlas.grid;
    g.lineWidth = 1 / zoom;
    g.beginPath();
    for (let x = sxc - W / 2; x <= sxc + W / 2; x += 18) {
      g.moveTo(x, syc - H / 2);
      g.lineTo(x, syc + H / 2);
    }
    for (let y = syc - H / 2; y <= syc + H / 2; y += 9) {
      g.moveTo(sxc - W / 2, y);
      g.lineTo(sxc + W / 2, y);
    }
    g.stroke();
    g.save();
    g.beginPath();
    g.rect(sxc - W / 2, syc - H / 2 - top * L, W, H + top * L);
    g.clip();
    // Neighbours' land, low, and the land borders between countries (no line at sea, P39).
    mapOn(g, box.x0, box.y0, s, c.height.world);
    g.fillStyle = p.atlas.world;
    for (const w of world) g.fill(w);
    g.strokeStyle = p.atlas.frontier;
    g.lineWidth = 1 / (K * zoom);
    g.stroke(frontier);
    // Terraces, low to high, so a higher step covers what stands behind it.
    for (let z = 0; z <= c.height.home; z += c.height.riser) {
      mapOn(g, box.x0, box.y0, s, z);
      for (const pr of provinces) {
        const h = heightOf(pr.step);
        if (z > h) continue;
        g.fillStyle = z === h ? p.atlas.top[STEP_INDEX[pr.step]]! : p.atlas.wall[STEP_INDEX[pr.step]]!;
        g.fill(pr.path);
      }
      if (z === c.height.base) {
        g.strokeStyle = p.atlas.border;
        g.lineWidth = 0.8 / (K * zoom);
        g.stroke(borders);
      }
    }
    g.restore();
    // The places: pins on the home step, Da Nang a brass diamond (the HQ).
    for (const pl of atlas.places) {
      const x = (sxc + (pl.x - mcx) * K - box.x0) * s;
      const y = (syc + (pl.y - mcy) * K * 0.5 - c.height.home * L - box.y0) * s;
      const r = Math.max(2, 2.6 * zoom) * dpr;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.fillStyle = pl === hqPlace ? p.atlas.hq : p.atlas.pin;
      g.beginPath();
      if (pl === hqPlace) {
        g.moveTo(x, y - r * 1.6);
        g.lineTo(x + r * 1.2, y);
        g.lineTo(x, y + r * 1.6);
        g.lineTo(x - r * 1.2, y);
        g.closePath();
      } else g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    }
    sprites.set(key, cv);
    return cv;
  };

  // The ripple: up to four provinces moving, each with its lift (0..1) and where it is going.
  const riseCode: (string | null)[] = [null, null, null, null];
  const riseVal = new Float64Array(4);
  const riseTo = new Float64Array(4);
  const column = beaconSprite();
  const glow = beaconGlow();
  // The last labels and beacon drawn (CSS px), read only on demand.
  const lastLabel = new Float64Array(8);
  let lastBeaconX = 0;
  let lastBeaconY = 0;
  const texts = [atlas.archipelagos.hoangSa.text[c.lang], atlas.archipelagos.truongSa.text[c.lang]];
  // Made once per scale, not per frame (a new string or TextMetrics each frame is garbage).
  let font = "";
  let fontDpr = 0;
  const widths = new Float64Array(2);
  let lastSprite: HTMLCanvasElement | null = null;
  let lastZoom = 0;
  let lastDpr = 0;
  let lastMode = "";

  return {
    box,
    hq,
    step(dt, hover, reduced) {
      // Whoever is hovered goes up; everyone else comes down.
      let slot = riseCode.indexOf(hover);
      if (hover && slot < 0) {
        slot = riseCode.findIndex((x, i) => x === null || (riseTo[i] === 0 && riseVal[i] === 0));
        if (slot >= 0) {
          riseCode[slot] = hover;
          riseVal[slot] = 0;
        }
      }
      let moving = false;
      for (let i = 0; i < 4; i++) {
        if (riseCode[i] === null) continue;
        riseTo[i] = riseCode[i] === hover ? 1 : 0;
        const v = riseVal[i]!;
        const to = riseTo[i]!;
        if (v === to) {
          if (to === 0) riseCode[i] = null;
          continue;
        }
        const next = reduced ? to : to > v ? Math.min(1, v + dt / c.rise.up) : Math.max(0, v - dt / c.rise.down);
        riseVal[i] = next;
        moving = true;
      }
      return moving;
    },
    prebake(zoom, dpr, p) {
      bake(zoom, dpr, p);
    },
    hit(sx, sy) {
      if (sx < box.x0 || sx > box.x1 || sy < box.y0 || sy > box.y1) return null;
      for (const step of ["home", "near", "base"] as const) {
        const h = heightOf(step);
        const mx = mcx + (sx - sxc) / K;
        const my = mcy + (sy + h * L - syc) / (K * 0.5);
        for (const pr of provinces) if (pr.step === step && probe.isPointInPath(pr.path, mx, my)) return pr.code;
      }
      return null;
    },
    draw(ctx, ox, oy, zoom, dpr, p) {
      if (!lastSprite || zoom !== lastZoom || dpr !== lastDpr || p.mode !== lastMode) {
        lastSprite = bake(zoom, dpr, p);
        lastZoom = zoom;
        lastDpr = dpr;
        lastMode = p.mode;
      }
      const sprite = lastSprite;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(sprite, Math.round((box.x0 * zoom - ox) * dpr), Math.round((box.y0 * zoom - oy) * dpr));
    },
    drawLive(ctx, ox, oy, zoom, dpr, p, now, reduced) {
      const s = zoom * dpr;
      const bx = ox / zoom;
      const by = oy / zoom;
      // Rising provinces: their walls up to the lifted top, then the top.
      for (let i = 0; i < 4; i++) {
        const code = riseCode[i];
        if (code == null || riseVal[i] === 0) continue;
        const pr = byCode.get(code);
        if (!pr) continue;
        const h = heightOf(pr.step);
        const up = h + c.rise.by * ease(riseVal[i]!);
        const k = STEP_INDEX[pr.step];
        for (let z = h; z < up; z += c.height.riser) {
          mapOn(ctx, bx, by, s, z);
          ctx.fillStyle = p.atlas.wall[k]!;
          ctx.fill(pr.path);
        }
        mapOn(ctx, bx, by, s, up);
        ctx.fillStyle = p.atlas.top[k]!;
        ctx.fill(pr.path);
      }
      // The scan line sweeping the table's sea, slowly (none with reduced motion).
      if (!reduced) {
        const t = (now % SWEEP_MS) / SWEEP_MS;
        const y = syc - H / 2 + t * H;
        ctx.setTransform(s, 0, 0, s, -ox * dpr, -oy * dpr);
        ctx.strokeStyle = p.atlas.sweep;
        ctx.lineWidth = 1.2 / zoom;
        ctx.beginPath();
        ctx.moveTo(sxc - W / 2, y);
        ctx.lineTo(sxc + W / 2, y);
        ctx.stroke();
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    },
    drawTop(ctx, ox, oy, zoom, dpr, p, now, reduced) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      // The beacon: a column of light from Da Nang up through the whole sky, pulsing slowly.
      if (hqPlace) {
        const x = (sxc + (hqPlace.x - mcx) * K) * zoom - ox;
        const y = (syc + (hqPlace.y - mcy) * K * 0.5 - c.height.home * L) * zoom - oy;
        const w = Math.max(8, 16 * zoom);
        ctx.globalAlpha = reduced ? 0.8 : 0.6 + 0.3 * (0.5 + 0.5 * Math.sin((now / PULSE_MS) * Math.PI * 2));
        ctx.drawImage(column, ((x - w / 2) * dpr) | 0, 0, (w * dpr) | 0, Math.max(1, (y * dpr) | 0));
        const gr = Math.max(10, 22 * zoom);
        ctx.drawImage(glow, ((x - gr) * dpr) | 0, ((y - gr * 0.5) * dpr) | 0, (2 * gr * dpr) | 0, (gr * dpr) | 0);
        ctx.globalAlpha = 1;
        lastBeaconX = x;
        lastBeaconY = y;
      }
      // Hoang Sa and Truong Sa: islands and their names, on top of everything, at any zoom.
      const keys = ["hoangSa", "truongSa"] as const;
      if (dpr !== fontDpr) {
        font = `500 ${Math.round(LABEL_PX * dpr)}px "IBM Plex Mono", ui-monospace, monospace`;
        fontDpr = dpr;
        ctx.font = font;
        widths[0] = ctx.measureText(texts[0]!).width;
        widths[1] = ctx.measureText(texts[1]!).width;
      }
      ctx.font = font;
      ctx.textBaseline = "alphabetic";
      ctx.lineJoin = "round";
      for (let k = 0; k < 2; k++) {
        const a = atlas.archipelagos[keys[k]!];
        ctx.fillStyle = p.atlas.isle;
        const r = Math.max(1.6, 2.2 * zoom) * dpr;
        ctx.beginPath();
        for (let d = 0; d < a.dots.length; d++) {
          const dot = a.dots[d]!;
          const x = ((sxc + (dot[0] - mcx) * K) * zoom - ox) * dpr;
          const y = ((syc + (dot[1] - mcy) * K * 0.5 - c.height.near * L) * zoom - oy) * dpr;
          ctx.moveTo(x + r, y);
          ctx.arc(x, y, r, 0, Math.PI * 2);
        }
        ctx.fill();
        const text = texts[k]!;
        const tw = widths[k]!;
        let lx = ((sxc + (a.label[0] - mcx) * K) * zoom - ox) * dpr;
        const ly = ((syc + (a.label[1] - mcy) * K * 0.5 - c.height.near * L) * zoom - oy) * dpr - 4 * dpr;
        if (a.anchor === "end") lx -= tw;
        ctx.strokeStyle = p.atlas.halo;
        ctx.lineWidth = 3 * dpr;
        ctx.strokeText(text, lx, ly);
        ctx.fillStyle = p.atlas.label;
        ctx.fillText(text, lx, ly);
        lastLabel[k * 4] = lx / dpr;
        lastLabel[k * 4 + 1] = ly / dpr - LABEL_PX;
        lastLabel[k * 4 + 2] = tw / dpr;
        lastLabel[k * 4 + 3] = LABEL_PX * 1.3;
      }
    },
    labels() {
      return texts.map((text, k) => ({ text, x: lastLabel[k * 4]!, y: lastLabel[k * 4 + 1]!, w: lastLabel[k * 4 + 2]!, h: lastLabel[k * 4 + 3]! }));
    },
    beacon() {
      return { x: lastBeaconX, y: lastBeaconY };
    },
  };
}

/** The beacon's light: brass toward white, the night's warm light (tokens only). */
const LIGHT = mix(TOKENS.mat.accent, TOKENS.mat.ink, 0.45);
const rgba = (a: number): string => `rgba(${parseInt(LIGHT.slice(1, 3), 16)},${parseInt(LIGHT.slice(3, 5), 16)},${parseInt(LIGHT.slice(5, 7), 16)},${a})`;

/** The beacon's column: bright in the middle, soft at the sides, fading toward the top (made once). */
function beaconSprite(): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = 32;
  c.height = 256;
  const g = c.getContext("2d")!;
  const across = g.createLinearGradient(0, 0, 32, 0);
  across.addColorStop(0, rgba(0));
  across.addColorStop(0.5, rgba(1));
  across.addColorStop(1, rgba(0));
  g.fillStyle = across;
  g.fillRect(0, 0, 32, 256);
  g.globalCompositeOperation = "destination-in";
  const up = g.createLinearGradient(0, 0, 0, 256);
  up.addColorStop(0, "rgba(0,0,0,0)");
  up.addColorStop(0.35, "rgba(0,0,0,0.55)");
  up.addColorStop(1, "rgba(0,0,0,1)");
  g.fillStyle = up;
  g.fillRect(0, 0, 32, 256);
  return c;
}
/** A soft halo where the beacon meets the table (made once). */
function beaconGlow(): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, rgba(0.9));
  r.addColorStop(1, rgba(0));
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 64);
  return c;
}
