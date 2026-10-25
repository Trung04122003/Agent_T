/**
 * Redaction bar lengths (SPEC section 5): random per build, stable within a build, and unrelated
 * to the length of whatever is hidden. Pure so it can be unit tested.
 */

/** Fixed for the lifetime of one build (or one dev server). */
export const BUILD_SEED = String(Date.now());

function hash(text: string): number {
  let h = 0x811c9dc5; // FNV-1a
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

function rng(seed: number): () => number {
  let a = seed; // mulberry32
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 2 to 4 bars, each 35-100 % wide. */
export function redactionBars(key: string, seed: string = BUILD_SEED): number[] {
  const next = rng(hash(`${seed}:${key}`));
  const count = 2 + Math.floor(next() * 3);
  return Array.from({ length: count }, () => Math.round(35 + next() * 65));
}
