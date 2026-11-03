import { describe, expect, it } from "vitest";
import { createQuality, QUALITY, type Tier } from "./quality";

const feed = (q: ReturnType<typeof createQuality>, ms: number, n: number): void => {
  for (let i = 0; i < n; i++) q.sample(ms);
};

describe("quality tiers (ROADMAP-v4 P32.4)", () => {
  it("holds its tier while frames are within the limit", () => {
    const q = createQuality("medium");
    feed(q, 16.7, 2000);
    expect(q.tier).toBe("medium");
  });

  it("steps down one tier once the rolling average stays over the limit, then waits before judging again", () => {
    const changes: [Tier, string][] = [];
    const q = createQuality("high", (t, why) => changes.push([t, why]));
    feed(q, 25, QUALITY.settle + QUALITY.window);
    expect(q.tier).toBe("medium");
    expect(changes).toEqual([["medium", "auto"]]);
    // Right after the change, slow frames do not drop it again until the new tier has settled and been measured.
    feed(q, 25, QUALITY.settle + QUALITY.window - 1);
    expect(q.tier).toBe("medium");
    q.sample(25);
    expect(q.tier).toBe("low");
  });

  it("ignores a short spike: the average, not one frame, decides", () => {
    const q = createQuality("medium");
    feed(q, 16.7, QUALITY.settle + QUALITY.window);
    feed(q, 200, 3); // one hitch (a bake, a GC)
    feed(q, 16.7, 200);
    expect(q.tier).toBe("medium");
  });

  it("never upgrades by itself, and Low is the floor", () => {
    const q = createQuality("medium");
    feed(q, 30, QUALITY.settle + QUALITY.window);
    expect(q.tier).toBe("low");
    feed(q, 5, 5000);
    expect(q.tier).toBe("low");
    feed(q, 100, 5000);
    expect(q.tier).toBe("low");
  });

  it("the reader's choice stands: manual sets any tier and turns the automatic step-down off", () => {
    const changes: [Tier, string][] = [];
    const q = createQuality("low", (t, why) => changes.push([t, why]));
    q.set("high");
    expect(q.tier).toBe("high");
    expect(q.manual).toBe(true);
    feed(q, 40, 5000);
    expect(q.tier).toBe("high");
    expect(changes).toEqual([["high", "manual"]]);
  });
});
