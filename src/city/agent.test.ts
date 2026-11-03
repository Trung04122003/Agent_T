import { describe, expect, it } from "vitest";
import { AGENT, createAgent } from "./agent";
import { follow } from "./camera";
import { facingOf } from "./figure";
import { ALLEYS, assignLots, type CityData } from "./plan";
import { walkWorld } from "./walk";

// ROADMAP-v4 36.2, 36.4, 36.6.
const data: CityData = {
  plots: [
    { id: "edu", kind: "education", domains: ["tech"] },
    { id: "biz", kind: "role", domains: ["business"] },
    { id: "biz2", kind: "role", domains: ["business"] },
  ],
  vault: null,
  landmarks: [],
};
const layout = assignLots(data);
const world = walkWorld(layout);
const plazaAlley = ALLEYS.find((a) => a.id === "alley-plaza")!;
const run = (a: ReturnType<typeof createAgent>, ms: number, vx = 0, vy = 0, press = false) => {
  for (let t = 0; t < ms; t += 16) a.update(16, vx, vy, false, press && t === 0);
};

describe("the entrance (36.6)", () => {
  it("waits hidden with the lantern shut, steps out after about 1.2 s, ends at the alley's mouth", () => {
    const a = createAgent(world, plazaAlley, false);
    expect(a.entrance).toBe("hidden");
    expect(a.power).toBe(0);
    run(a, AGENT.waitMs - 50);
    expect(a.entrance).toBe("hidden");
    run(a, 100);
    expect(a.entrance).toBe("stepping");
    run(a, 3000);
    expect(a.entrance).toBe("done");
    expect([a.x, a.y]).toEqual([plazaAlley.mouth.x + 0.5, plazaAlley.mouth.y + 0.5]);
    expect(a.power).toBe(1);
  });

  it("the first press starts it at once; the next press skips to the end", () => {
    const a = createAgent(world, plazaAlley, false);
    run(a, 16, 0, 0, true);
    expect(a.entrance).toBe("stepping");
    run(a, 16, 0, 0, true);
    expect(a.entrance).toBe("done");
  });

  it("reduced motion: already standing at the mouth, lantern open", () => {
    const a = createAgent(world, plazaAlley, true);
    expect(a.entrance).toBe("done");
    expect([a.x, a.y]).toEqual([plazaAlley.mouth.x + 0.5, plazaAlley.mouth.y + 0.5]);
    expect(a.power).toBe(1);
  });
});

describe("walking to a door (36.2)", () => {
  it("a click on a building walks him over the roads to its door, facing it", () => {
    const a = createAgent(world, plazaAlley, true);
    const target = world.footprints.find((f) => f.id === "biz2")!;
    expect(a.goTo((target.x0 + target.x1) / 2, (target.y0 + target.y1) / 2)).toBe(true);
    for (let t = 0; t < 30_000 && !a.atDoor; t += 16) a.update(16, 0, 0, false, false);
    expect(a.atDoor).toBe("biz2");
    expect(Math.hypot(a.x - (target.door.x + 0.5), a.y - (target.door.y + 0.5))).toBeLessThan(0.1);
    // Facing the building: its centre lies within 45 degrees of his heading.
    const to = Math.atan2((target.y0 + target.y1) / 2 - a.y, (target.x0 + target.x1) / 2 - a.x);
    expect(Math.abs(Math.atan2(Math.sin(to - a.heading), Math.cos(to - a.heading)))).toBeLessThan(0.01);
  });

  it("the keyboard takes over at once and walks him up the screen (north)", () => {
    const a = createAgent(world, plazaAlley, true);
    const y0 = a.y;
    const x0 = a.x;
    run(a, 500, 0, -1);
    expect(a.y).toBeLessThan(y0);
    expect(a.x).toBeLessThan(x0);
    expect(a.dir).toBe(6); // facing north
  });

  it("facings: screen right is 0, down 2, left 4, up 6", () => {
    expect([facingOf(1, 0), facingOf(0, 1), facingOf(-1, 0), facingOf(0, -1), facingOf(1, 1)]).toEqual([0, 2, 4, 6, 1]);
  });
});

describe("camera follow (36.4)", () => {
  const bounds = { x0: -100, y0: -100, x1: 100, y1: 100 };

  it("eases toward the target without overshooting, then settles exactly", () => {
    const cam = { x: 0, y: 0 };
    let last = 0;
    for (let i = 0; i < 200; i++) {
      follow(cam, 50, 0, 16, false, bounds);
      expect(cam.x).toBeGreaterThanOrEqual(last);
      expect(cam.x).toBeLessThanOrEqual(50);
      last = cam.x;
    }
    expect(cam.x).toBe(50);
    expect(follow(cam, 50, 0, 16, false, bounds)).toBe(false);
  });

  it("no jitter at the city's edge: pushed past it, the camera holds still", () => {
    const cam = { x: 100, y: 0 };
    for (let i = 0; i < 50; i++) {
      expect(follow(cam, 140 + (i % 2) * 5, 0, 16, false, bounds)).toBe(false);
      expect(cam.x).toBe(100);
    }
  });

  it("reduced motion removes the easing: one frame and it is there", () => {
    const cam = { x: 0, y: 0 };
    follow(cam, 30, -20, 16, true, bounds);
    expect(cam).toEqual({ x: 30, y: -20 });
  });
});
