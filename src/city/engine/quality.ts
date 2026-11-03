// Quality tiers (ROADMAP-v4 P32.4, UX-v4 section 13). The canvas world runs at High, Medium or Low;
// Lite (no canvas world) is decided once by the capability check, never reached from here.
// Automatic: a rolling average of frame times; when it stays above the tier's limit, step down one
// tier, then wait out a cooldown before judging again. Never step up by itself within a session.
// Manual: the HUD's Quality control sets any tier, and from then on the reader's choice stands.

export type Tier = "high" | "medium" | "low";
export const TIERS: readonly Tier[] = ["high", "medium", "low"];

export const QUALITY = {
  /** Frames in the rolling average (about 1.5 s at 60 fps). */
  window: 90,
  /** Frames ignored after a start or a tier change: loading and rebaking are not the steady state. */
  settle: 120,
  /**
   * Each sample is capped at this (ms) before it enters the average: a one-off stall (a bake, a
   * garbage collection) counts as slow, not as a disaster; only sustained slowness steps down.
   */
  clamp: 50,
  /** Average frame time (ms) above which the tier steps down. Low is the floor (30 fps cap). */
  limit: { high: 18, medium: 20, low: Infinity } as Record<Tier, number>,
} as const;

export type QualityController = {
  readonly tier: Tier;
  readonly manual: boolean;
  /** Feed every frame's duration (ms). Returns the tier now in force. */
  sample(ms: number): Tier;
  /** The reader's choice from the HUD. */
  set(tier: Tier): void;
};

export function createQuality(start: Tier, onChange: (tier: Tier, why: "auto" | "manual") => void = () => {}): QualityController {
  let tier = start;
  let manual = false;
  const ring = new Float64Array(QUALITY.window);
  let filled = 0;
  let at = 0;
  let sum = 0;
  let settle = QUALITY.settle;

  const reset = (): void => {
    ring.fill(0);
    filled = at = sum = 0;
    settle = QUALITY.settle;
  };

  return {
    get tier() {
      return tier;
    },
    get manual() {
      return manual;
    },
    sample(ms) {
      if (manual) return tier;
      if (settle > 0) {
        settle--;
        return tier;
      }
      const v = Math.min(ms, QUALITY.clamp);
      sum += v - ring[at]!;
      ring[at] = v;
      at = (at + 1) % QUALITY.window;
      if (filled < QUALITY.window) filled++;
      if (filled === QUALITY.window && sum / QUALITY.window > QUALITY.limit[tier]) {
        const next = TIERS[TIERS.indexOf(tier) + 1];
        if (next) {
          tier = next;
          reset();
          onChange(tier, "auto");
        }
      }
      return tier;
    },
    set(next) {
      manual = true;
      if (next !== tier) {
        tier = next;
        reset();
        onChange(tier, "manual");
      }
    },
  };
}
