import { describe, expect, it } from "vitest";
import { createLoop, LOOP, type LoopDeps } from "./loop";

// A fake browser: a clock, a frame queue (one vsync every 16.7 ms) and timers, all driven by hand.
function fakeBrowser() {
  let t = 0;
  let id = 0;
  const frames = new Map<number, (t: number) => void>();
  const timers = new Map<number, { at: number; cb: () => void }>();
  const listeners = new Set<() => void>();
  const stats = { rafCalls: 0 };
  const doc = {
    hidden: false,
    addEventListener: (_: string, cb: () => void) => void listeners.add(cb),
    removeEventListener: (_: string, cb: () => void) => void listeners.delete(cb),
  };
  const deps: LoopDeps = {
    now: () => t,
    raf: (cb) => (stats.rafCalls++, frames.set(++id, cb), id),
    caf: (h) => void frames.delete(h),
    setTimer: (cb, ms) => (timers.set(++id, { at: t + ms, cb }), id),
    clearTimer: (h) => void timers.delete(h),
    doc,
  };
  /** Advance the clock by `ms`, firing timers and one vsync every ~16.7 ms. */
  const advance = (ms: number): void => {
    const end = t + ms;
    while (t < end) {
      t = Math.min(end, t + 1000 / 60);
      for (const [h, tm] of [...timers]) if (tm.at <= t) (timers.delete(h), tm.cb());
      const due = [...frames];
      frames.clear();
      for (const [, cb] of due) cb(t);
    }
  };
  const setHidden = (hidden: boolean): void => {
    doc.hidden = hidden;
    for (const cb of listeners) cb();
  };
  return { deps, advance, setHidden, stats, pending: () => frames.size + timers.size, listeners };
}

describe("city frame loop (ROADMAP-v4 P32.2)", () => {
  it("runs at the display rate, one frame in flight at a time", () => {
    const b = fakeBrowser();
    const dts: number[] = [];
    const loop = createLoop((dt) => dts.push(dt), b.deps);
    loop.start();
    b.advance(1000);
    expect(dts.length).toBeGreaterThanOrEqual(59);
    expect(dts.length).toBeLessThanOrEqual(61);
    expect(b.pending()).toBe(1); // never two loops
    loop.start(); // a second start does not add a second chain
    expect(b.pending()).toBe(1);
  });

  it("clamps the step after a stall", () => {
    const b = fakeBrowser();
    const dts: number[] = [];
    const loop = createLoop((dt) => dts.push(dt), b.deps);
    loop.start();
    b.advance(50);
    // A stalled frame: its timestamp arrives 2 s late.
    const raf = b.deps.raf;
    let stall = true;
    b.deps.raf = (cb) => raf((t) => cb(stall ? ((stall = false), t + 2000) : t));
    b.advance(100);
    expect(Math.max(...dts)).toBe(LOOP.maxDt);
  });

  it("schedules nothing while the tab is hidden, and comes back without a big step", () => {
    const b = fakeBrowser();
    const dts: number[] = [];
    const loop = createLoop((dt) => dts.push(dt), b.deps);
    loop.start();
    b.advance(200);
    b.setHidden(true);
    const before = b.stats.rafCalls;
    const count = dts.length;
    b.advance(5000);
    expect(b.stats.rafCalls).toBe(before); // no rAF activity at all
    expect(dts.length).toBe(count);
    expect(b.pending()).toBe(0);
    b.setHidden(false);
    b.advance(100);
    expect(dts.length).toBeGreaterThan(count);
    expect(Math.max(...dts.slice(count))).toBeLessThanOrEqual(LOOP.maxDt);
  });

  it("idles at about 20 fps after 20 s without input; input brings full speed back", () => {
    const b = fakeBrowser();
    let frames = 0;
    const loop = createLoop(() => frames++, b.deps);
    loop.start();
    b.advance(LOOP.idleAfter + 100);
    expect(loop.idle).toBe(true);
    frames = 0;
    b.advance(1000);
    expect(frames).toBeGreaterThanOrEqual(15);
    expect(frames).toBeLessThanOrEqual(21);
    loop.poke();
    expect(loop.idle).toBe(false);
    frames = 0;
    b.advance(1000);
    expect(frames).toBeGreaterThanOrEqual(58);
  });

  it("stop leaves nothing scheduled and no listener behind", () => {
    const b = fakeBrowser();
    const loop = createLoop(() => {}, b.deps);
    loop.start();
    b.advance(100);
    loop.stop();
    expect(b.pending()).toBe(0);
    expect(b.listeners.size).toBe(0);
    expect(loop.running).toBe(false);
  });
});
