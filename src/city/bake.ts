// The baked static layer (ROADMAP-v4 32.3, 34.3): the scene drawn once per zoom bucket and mode into
// 512 px chunks, kept in an LRU cache sized by the layer plan; each frame only copies the chunks in
// view onto the stage's canvas, and only when the view changed. A frame bakes at most `budget`
// missing chunks (the first frame bakes all it needs), so panning never stalls on a burst of bakes.
import { ChunkCache, LAYERS } from "./engine/layers";
import type { Palette } from "./palette";
import { drawScene, type Scene } from "./render";

/** The three zoom steps (UX-v4 section 3): far shows the whole city, close a block. */
export const ZOOMS = [0.32, 0.6, 1] as const;

/** Camera centre in zoom-1 screen pixels, the zoom step, the view in CSS pixels. */
export type View = { x: number; y: number; zoom: number; w: number; h: number };
export type BakeStats = { baked: number; ms: number; maxMs: number };
type Chunk = { canvas: HTMLCanvasElement; ms: number };

export type StaticLayer = {
  /** Copies the chunks in view onto `ctx` (device pixels); returns how many are still missing. */
  composite(ctx: CanvasRenderingContext2D, view: View, budget: number): number;
  setPalette(p: Palette): void;
  resize(dpr: number, chunks: number): void;
  readonly stats: BakeStats;
  dispose(): void;
};

export function createStaticLayer(scene: Scene, p0: Palette, dpr0: number, chunks0: number): StaticLayer {
  const S = LAYERS.chunk;
  let pal = p0;
  let dpr = dpr0;
  const stats: BakeStats = { baked: 0, ms: 0, maxMs: 0 };
  const bake = (key: string): Chunk => {
    const t0 = performance.now();
    const [, z, cx, cy] = key.split(":").map(Number) as [number, number, number, number];
    const zoom = ZOOMS[z]!;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = Math.ceil(S * dpr);
    const ctx = canvas.getContext("2d")!;
    ctx.setTransform(zoom * dpr, 0, 0, zoom * dpr, -cx * S * dpr, -cy * S * dpr);
    ctx.lineJoin = "round";
    drawScene(ctx, scene, pal, { x0: (cx * S) / zoom, y0: (cy * S) / zoom, x1: ((cx + 1) * S) / zoom, y1: ((cy + 1) * S) / zoom }, 1 / zoom);
    const ms = performance.now() - t0;
    stats.baked++;
    stats.ms += ms;
    stats.maxMs = Math.max(stats.maxMs, ms);
    return { canvas, ms };
  };
  // Dropping a chunk frees its backing store at once instead of waiting for the collector.
  const free = (c: Chunk): void => {
    c.canvas.width = c.canvas.height = 0;
  };
  let cache = new ChunkCache<Chunk>(chunks0, bake, free);
  const zoomIndex = (zoom: number): number => Math.max(0, ZOOMS.indexOf(zoom as (typeof ZOOMS)[number]));

  return {
    composite(ctx, v, budget) {
      const zi = zoomIndex(v.zoom);
      const ox = v.x * v.zoom - v.w / 2;
      const oy = v.y * v.zoom - v.h / 2;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      let missing = 0;
      for (let cy = Math.floor(oy / S); cy * S < oy + v.h; cy++) {
        for (let cx = Math.floor(ox / S); cx * S < ox + v.w; cx++) {
          const key = `${pal.mode}:${zi}:${cx}:${cy}`;
          if (!cache.has(key)) {
            if (budget <= 0) {
              missing++;
              continue;
            }
            budget--;
          }
          ctx.drawImage(cache.get(key).canvas, Math.round((cx * S - ox) * dpr), Math.round((cy * S - oy) * dpr));
        }
      }
      return missing;
    },
    setPalette(p) {
      if (p.mode === pal.mode) return;
      pal = p;
      cache.clear();
    },
    resize(d, chunks) {
      dpr = d;
      cache.clear();
      cache = new ChunkCache<Chunk>(chunks, bake, free);
    },
    get stats() {
      return stats;
    },
    dispose() {
      cache.clear();
    },
  };
}
