import { describe, expect, it } from "vitest";
import { ChunkCache, LAYERS, planLayers } from "./layers";

const MB = 1024 * 1024;

describe("layer plan (ROADMAP-v4 P32.3)", () => {
  it.each([
    [1366, 768],
    [1920, 1080],
    [2560, 1440],
    [3840, 2160],
    [375, 812],
  ])("%ix%i: every DPR fits the 64 MB backing store", (w, h) => {
    for (const dpr of [1, 1.25, 1.5, 2, 3]) {
      const plan = planLayers(w, h, dpr);
      expect(plan.total, `${w}x${h} @${dpr}`).toBeLessThanOrEqual(LAYERS.maxBytes);
      expect(plan.dpr).toBeLessThanOrEqual(Math.min(dpr, LAYERS.maxDpr));
    }
  });

  it("keeps full sharpness when it fits, darkness at half resolution", () => {
    const plan = planLayers(1366, 768, 1);
    expect(plan.dpr).toBe(1);
    const dyn = plan.canvases.find((c) => c.name === "dynamic")!;
    const dark = plan.canvases.find((c) => c.name === "darkness")!;
    expect([dyn.w, dyn.h]).toEqual([1366, 768]);
    expect([dark.w, dark.h]).toEqual([683, 384]);
  });

  it("lowers the DPR rather than overflow on a big, dense screen", () => {
    const plan = planLayers(3840, 2160, 2);
    expect(plan.dpr).toBeLessThan(2);
    expect(plan.total).toBeLessThanOrEqual(64 * MB);
  });
});

describe("baked chunk cache", () => {
  it("never holds more than its size, drops the least recently used", () => {
    const dropped: string[] = [];
    const cache = new ChunkCache<string>(2, (k) => `chunk ${k}`, (c) => dropped.push(c));
    cache.get("a");
    cache.get("b");
    cache.get("a"); // a used again: b is now the oldest
    cache.get("c");
    expect(cache.size).toBe(2);
    expect(dropped).toEqual(["chunk b"]);
    cache.clear();
    expect(cache.size).toBe(0);
    expect(dropped).toEqual(["chunk b", "chunk a", "chunk c"]);
  });

  it("a tier's pixel budget scales a large stage down (full screen), never below the floor", () => {
    const big = planLayers(1920, 930, 1, LAYERS.pixels.medium);
    expect(big.dpr).toBeLessThan(1);
    expect(big.canvases.find((c) => c.name === "dynamic")!.w * big.canvases.find((c) => c.name === "dynamic")!.h).toBeLessThanOrEqual(LAYERS.pixels.medium * 1.01);
    expect(planLayers(1366, 618, 1, LAYERS.pixels.medium).dpr).toBe(1); // a laptop window: untouched
    expect(planLayers(1920, 930, 1, LAYERS.pixels.high).dpr).toBe(1);
    expect(planLayers(3840, 2160, 1, LAYERS.pixels.low).dpr).toBe(LAYERS.minDpr); // a 4K screen
  });
});
