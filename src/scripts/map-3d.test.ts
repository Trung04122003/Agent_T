import { describe, expect, it } from "vitest";
import { ease, frameBox, ground, HEIGHT, RISE, TILT } from "./map-3d";

describe("terraced 3D view: ground tilt and frame (owner request 2026-11-01)", () => {
  it("tilts the ground and lifts by height, straight up on screen", () => {
    expect(ground(100, 200)).toEqual([100 + TILT.skew * 200, TILT.squash * 200]);
    const [x0, y0] = ground(100, 200);
    const [x1, y1] = ground(100, 200, HEIGHT.home);
    expect(x1).toBe(x0);
    expect(y0 - y1).toBe(HEIGHT.home);
  });

  it("steps rise from the sea to the home provinces", () => {
    expect(0).toBeLessThan(HEIGHT.world);
    expect(HEIGHT.world).toBeLessThan(HEIGHT.base);
    expect(HEIGHT.base).toBeLessThan(HEIGHT.near);
    expect(HEIGHT.near).toBeLessThan(HEIGHT.home);
    for (const h of Object.values(HEIGHT)) expect(h % HEIGHT.riser).toBe(0); // risers line up with every step
  });

  it("frames the tilted box with room for the highest step", () => {
    const [x, y, w, h] = frameBox({ x: 30, y: 90, width: 460, height: 520 }, 0);
    for (const [cx, cy] of [ground(30, 90), ground(490, 90), ground(30, 610), ground(490, 610)]) {
      expect(cx).toBeGreaterThanOrEqual(x - 0.5);
      expect(cx).toBeLessThanOrEqual(x + w + 0.5);
      expect(cy).toBeLessThanOrEqual(y + h + 0.5);
    }
    // The top of the highest step, risen, at the far (north) edge is still inside.
    expect(ground(30, 90, HEIGHT.home + RISE.by)[1]).toBeGreaterThanOrEqual(y - 0.5);
  });

  it("the ripple: a step up, eased, within the motion budget", () => {
    expect(RISE.by % HEIGHT.riser).toBe(0);
    expect(RISE.up).toBeLessThanOrEqual(600);
    expect(RISE.down).toBeLessThanOrEqual(600);
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBe(1);
    expect(ease(0.5)).toBeGreaterThan(0.5); // fast start, soft landing
  });
});
