// The city's one and only frame loop (ROADMAP-v4 P32.2, rule 4): a single requestAnimationFrame
// chain, the step clamped, nothing scheduled while the tab is hidden, and about 20 fps once nobody
// has touched anything for 20 s (the next input brings full speed back at once).

export const LOOP = {
  /** Longest step handed to the world (ms): a long stall never becomes a jump. */
  maxDt: 100,
  /** No input for this long (ms) and the city idles. */
  idleAfter: 20_000,
  /** Idle pace: one frame per this many ms (~20 fps). */
  idleEvery: 50,
} as const;

/** What the loop needs from the browser; tests hand in fakes. */
export type LoopDeps = {
  now: () => number;
  raf: (cb: (t: number) => void) => number;
  caf: (handle: number) => void;
  setTimer: (cb: () => void, ms: number) => number;
  clearTimer: (handle: number) => void;
  doc: { readonly hidden: boolean; addEventListener(type: "visibilitychange", cb: () => void): void; removeEventListener(type: "visibilitychange", cb: () => void): void };
};

export type Loop = {
  start(): void;
  stop(): void;
  /** Call on every input: wakes the loop from idle pace. */
  poke(): void;
  readonly running: boolean;
  readonly idle: boolean;
};

export function browserLoopDeps(): LoopDeps {
  return {
    now: () => performance.now(),
    raf: (cb) => requestAnimationFrame(cb),
    caf: (h) => cancelAnimationFrame(h),
    setTimer: (cb, ms) => window.setTimeout(cb, ms),
    clearTimer: (h) => window.clearTimeout(h),
    doc: document,
  };
}

/** `frame(dt, now)`: dt in ms, already clamped. */
export function createLoop(frame: (dt: number, now: number) => void, deps: LoopDeps = browserLoopDeps()): Loop {
  let running = false;
  let frameHandle = 0;
  let timerHandle = 0;
  let last = 0;
  let lastInput = 0;

  const isIdle = (): boolean => deps.now() - lastInput >= LOOP.idleAfter;
  const cancel = (): void => {
    if (frameHandle) deps.caf(frameHandle);
    if (timerHandle) deps.clearTimer(timerHandle);
    frameHandle = timerHandle = 0;
  };
  // At most one pending frame or idle timer at any time: one loop, never two.
  const schedule = (): void => {
    if (!running || deps.doc.hidden || frameHandle || timerHandle) return;
    if (isIdle()) {
      timerHandle = deps.setTimer(() => {
        timerHandle = 0;
        if (running && !deps.doc.hidden && !frameHandle) frameHandle = deps.raf(step);
      }, LOOP.idleEvery);
    } else frameHandle = deps.raf(step);
  };
  const step = (t: number): void => {
    frameHandle = 0;
    if (!running || deps.doc.hidden) return;
    const dt = Math.min(LOOP.maxDt, Math.max(0, t - last));
    last = t;
    frame(dt, t);
    schedule();
  };
  const onVisibility = (): void => {
    if (deps.doc.hidden) cancel();
    else {
      last = deps.now(); // back from a hidden tab: no giant step
      schedule();
    }
  };

  return {
    start() {
      if (running) return;
      running = true;
      last = lastInput = deps.now();
      deps.doc.addEventListener("visibilitychange", onVisibility);
      schedule();
    },
    stop() {
      running = false;
      cancel();
      deps.doc.removeEventListener("visibilitychange", onVisibility);
    },
    poke() {
      const wasIdle = isIdle();
      lastInput = deps.now();
      // Leave idle pace at once: drop the idle timer and ask for a frame now.
      if (wasIdle && timerHandle) {
        deps.clearTimer(timerHandle);
        timerHandle = 0;
        schedule();
      }
    },
    get running() {
      return running;
    },
    get idle() {
      return isIdle();
    },
  };
}
