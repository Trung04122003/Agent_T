// Layer stack of Agent T City (ROADMAP-v4 P32.3, rule 4): back to front
// 1. static: the baked ground and buildings, drawn once per zoom bucket into offscreen chunks;
// 2. dynamic: what moves (Agent T, lights, particles), redrawn each frame;
// 3. darkness: the fog of war at half resolution, stretched over the scene, cut by an offscreen light
//    mask of the same size (lantern, lamps, signs);
// 4. HUD: DOM, not canvas (accessible, and no backing store).
// planLayers picks the device pixel ratio so the backing store of every canvas together stays under
// 64 MB; the city then sizes its canvases from the plan and never on its own.

export const LAYERS = {
  maxBytes: 64 * 1024 * 1024,
  /** Side of a baked chunk, in CSS pixels. */
  chunk: 512,
  /** The darkness layer's resolution relative to the dynamic layer. */
  darkness: 0.5,
  /** Never sharper than this, whatever the screen. */
  maxDpr: 2,
  /** DPR is lowered in these steps until the plan fits. */
  dprStep: 0.25,
  /**
   * Most pixels a frame paints per tier (dynamic layer), so a full-screen stage costs what a laptop
   * window does: beyond it the canvases render smaller and are stretched (the HUD is DOM, so text
   * stays sharp). Owner request 03/11/2026 (full screen), held to the frame budget.
   */
  pixels: { high: Infinity, medium: 1_100_000, low: 750_000 },
  /** Never below this scale, however large the stage. */
  minDpr: 0.5,
} as const;

export type CanvasPlan = { name: "dynamic" | "darkness" | "light" | "chunk"; w: number; h: number; count: number; bytes: number };
export type LayerPlan = { dpr: number; canvases: CanvasPlan[]; total: number };

const BYTES_PER_PIXEL = 4;

function planAt(cssW: number, cssH: number, dpr: number): LayerPlan {
  const w = Math.ceil(cssW * dpr);
  const h = Math.ceil(cssH * dpr);
  const side = Math.ceil(LAYERS.chunk * dpr);
  // Enough chunks to cover the view plus one ring around it, so panning never waits for a bake.
  const chunks = (Math.ceil(cssW / LAYERS.chunk) + 2) * (Math.ceil(cssH / LAYERS.chunk) + 2);
  const dw = Math.ceil(w * LAYERS.darkness);
  const dh = Math.ceil(h * LAYERS.darkness);
  const canvases: CanvasPlan[] = [
    { name: "dynamic", w, h, count: 1, bytes: w * h * BYTES_PER_PIXEL },
    { name: "darkness", w: dw, h: dh, count: 1, bytes: dw * dh * BYTES_PER_PIXEL },
    // The light mask the darkness is cut with (P35): same size, offscreen.
    { name: "light", w: dw, h: dh, count: 1, bytes: dw * dh * BYTES_PER_PIXEL },
    { name: "chunk", w: side, h: side, count: chunks, bytes: side * side * BYTES_PER_PIXEL * chunks },
  ];
  return { dpr, canvases, total: canvases.reduce((n, c) => n + c.bytes, 0) };
}

/**
 * The sharpest plan under the memory budget for a viewport (CSS px) and the device's DPR, painting
 * at most `maxPixels` on the dynamic layer (a tier's budget, LAYERS.pixels).
 */
export function planLayers(cssW: number, cssH: number, deviceDpr: number, maxPixels = Infinity): LayerPlan {
  let dpr = Math.max(1, Math.min(LAYERS.maxDpr, deviceDpr));
  if (cssW * cssH * dpr * dpr > maxPixels) {
    // Steps of 0.05, so a chunk's side stays a whole number of pixels near its spacing (no seam).
    dpr = Math.max(LAYERS.minDpr, Math.floor(Math.sqrt(maxPixels / (cssW * cssH)) * 20) / 20);
  }
  let plan = planAt(cssW, cssH, dpr);
  while (plan.total > LAYERS.maxBytes && dpr > LAYERS.dprStep) {
    dpr = Math.max(LAYERS.dprStep, Math.round((dpr - LAYERS.dprStep) * 100) / 100);
    plan = planAt(cssW, cssH, dpr);
  }
  return plan;
}

/** Baked chunks, least recently used dropped first, never more than the plan allows. */
export class ChunkCache<T> {
  private readonly items = new Map<string, T>();
  private readonly max: number;
  private readonly make: (key: string) => T;
  private readonly drop: (item: T) => void;
  constructor(max: number, make: (key: string) => T, drop: (item: T) => void = () => {}) {
    this.max = max;
    this.make = make;
    this.drop = drop;
  }
  get(key: string): T {
    let item = this.items.get(key);
    if (item) this.items.delete(key);
    else {
      item = this.make(key);
      if (this.items.size >= this.max) {
        const [oldKey, old] = this.items.entries().next().value as [string, T];
        this.items.delete(oldKey);
        this.drop(old);
      }
    }
    this.items.set(key, item);
    return item;
  }
  /** Present, without counting as a use. */
  has(key: string): boolean {
    return this.items.has(key);
  }
  get size(): number {
    return this.items.size;
  }
  clear(): void {
    for (const item of this.items.values()) this.drop(item);
    this.items.clear();
  }
}
