import { describe, expect, it } from "vitest";
import { STIR } from "../scripts/stir";
import { LAMPS, walkable, assignLots, type CityData } from "./plan";
import { createRain, RAIN } from "./rain";
import { createSigns } from "./signs";

// ROADMAP-v4 P35: the night engine's pieces that run without a canvas.
const data: CityData = {
  plots: [
    { id: "a", kind: "education", domains: ["tech"] },
    { id: "b", kind: "role", domains: ["finance"] },
    { id: "c", kind: "role", domains: ["business"] },
  ],
  vault: null,
  landmarks: [],
};

describe("streetlamps (35.2)", () => {
  it("stand on the street, never on a lot or in the canal", () => {
    expect(LAMPS.length).toBeGreaterThan(10);
    for (const l of LAMPS) expect(walkable(Math.floor(l.x), Math.floor(l.y)), `${l.x},${l.y}`).toBe(true);
  });
});

describe("signs (35.3)", () => {
  const settle = (s: ReturnType<typeof createSigns>, from: number, to: number, on: boolean) => {
    let changes = 0;
    for (let t = from; t <= to; t += 16) if (s.update(t, on)) changes++;
    return changes;
  };

  it("one per entry building, each with a glow position", () => {
    const s = createSigns(assignLots(data), STIR);
    expect(s.count).toBe(3);
    expect(s.centres).toHaveLength(6);
    expect([...s.centres].every(Number.isFinite)).toBe(true);
  });

  it("stir like the dossier's bars: redrawn every 50 ms for 200 ms, then still", () => {
    const s = createSigns(assignLots(data), STIR);
    // Nothing before the first pause ends.
    expect(settle(s, 0, 1400, true)).toBe(0);
    // A stir: 4 redraws (0, 50, 100, 150 ms) and one settle back at 200 ms.
    expect(settle(s, 1500, 1500 + STIR.ms + 20, true)).toBe(STIR.ms / STIR.step + 1);
  });

  it("frozen with reduced motion (or in Giai mat): never stirs", () => {
    const s = createSigns(assignLots(data), STIR);
    expect(settle(s, 0, 60_000, false)).toBe(0);
  });
});

describe("rain (35.4)", () => {
  it("High tier only, capped; switching tier drops it to the new cap", () => {
    const r = createRain([[0, 0, 10, 5, 0, -40]]);
    r.setTier("high", true);
    expect(r.count).toBe(RAIN.cap.high);
    r.step(16, 800, 600);
    expect(r.count).toBeLessThanOrEqual(120);
    r.setTier("medium", true);
    expect(r.count).toBe(0);
    r.setTier("high", true);
    expect(r.count).toBe(120);
    r.setTier("low", true);
    expect(r.count).toBe(0);
  });

  it("none in Giai mat or with reduced motion, whatever the tier", () => {
    const r = createRain([]);
    r.setTier("high", false);
    expect(r.count).toBe(0);
  });
});
