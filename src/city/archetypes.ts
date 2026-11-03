// Building archetypes of Agent T City (ROADMAP-v4 34.2, UX-v4 section 2) and the deterministic
// generator that turns one into solids on its lot. An archetype is picked from the entry's `kind`
// and domains only, never from its tier, metrics or lens weights, so height says nothing about
// importance. Abstract shapes: no flags, emblems, logos or text anywhere.
import type { Rect } from "./plan";

export type Archetype =
  | "campus-hall"
  | "antenna-tower"
  | "server-hall"
  | "market-hall"
  | "glass-tower"
  | "pavilion-mast"
  | "observatory"
  | "vault-monolith"
  | "archive-tower"
  | "lab"
  | "debrief-room"
  | "risk-registry"
  | "dead-drop";

/** What a solid is made of, for shading: the walls, brass trim, glass, or the sealed dark. */
export type Tone = "body" | "trim" | "glass" | "dark";
/** Boxes, n-gon frustums (cylinders, cones, domes in layers), ridge roofs and thin masts. */
export type Solid =
  | { type: "box"; x: number; y: number; z: number; w: number; d: number; h: number; tone: Tone; windows?: boolean }
  | { type: "frustum"; cx: number; cy: number; z: number; r0: number; r1: number; h: number; sides: number; tone: Tone; turn?: number }
  | { type: "gable"; x: number; y: number; z: number; w: number; d: number; h: number; ridge: "x" | "y"; tone: Tone }
  | { type: "mast"; x: number; y: number; z: number; h: number; lit?: boolean };

/** Archetypes for an entry, preferred first (UX-v4 section 2). The first domain leads. */
export function archetypesFor(kind: "role" | "education" | "project", domains: readonly string[]): Archetype[] {
  if (kind === "education") return ["campus-hall"];
  if (kind === "project") return ["observatory"];
  switch (domains[0]) {
    case "tech":
      return ["antenna-tower", "server-hall"];
    case "finance":
      return ["glass-tower"];
    case "relations":
      return ["pavilion-mast"];
    default:
      return ["market-hall"];
  }
}

/** Small deterministic generator (mulberry32) seeded from the lot's id: same lot, same building. */
function rng(seed: string): () => number {
  let a = 2166136261;
  for (const ch of seed) a = Math.imul(a ^ ch.charCodeAt(0), 16777619);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Sidewalk left around every building, in tiles. */
const MARGIN = 0.5;

/** The solids of one building, inside its lot. Depends on the archetype, the lot and its id only. */
export function building(archetype: Archetype, lot: Rect, seed: string): Solid[] {
  const r = rng(seed);
  const x = lot.x + MARGIN;
  const y = lot.y + MARGIN;
  const w = lot.w - 2 * MARGIN;
  const d = lot.d - 2 * MARGIN;
  const cx = x + w / 2;
  const cy = y + d / 2;
  const box = (bx: number, by: number, z: number, bw: number, bd: number, h: number, tone: Tone = "body", windows = tone !== "trim"): Solid => ({
    type: "box", x: bx, y: by, z, w: bw, d: bd, h, tone, windows,
  });
  const inset = (z: number, k: number, h: number, tone: Tone = "body", windows?: boolean): Solid => box(x + k, y + k, z, w - 2 * k, d - 2 * k, h, tone, windows);
  /** Roof clutter on a flat top: one to three small units, placed by the lot's own generator. */
  const clutter = (top: Solid & { type: "box" }): Solid[] => {
    const n = 1 + Math.floor(r() * 3);
    return Array.from({ length: n }, () => {
      const s = 0.3 + r() * 0.3;
      return box(top.x + 0.2 + r() * Math.max(0, top.w - s - 0.4), top.y + 0.2 + r() * Math.max(0, top.d - s - 0.4), top.z + top.h, s, s, 0.15 + r() * 0.2, "body", false);
    });
  };
  switch (archetype) {
    case "campus-hall": {
      // Stepped hall: three terraces and a small lantern on top.
      const top = inset(2.4, 1.4, 0.9) as Solid & { type: "box" };
      return [inset(0, 0, 1.2), inset(1.2, 0.7, 1.2), top, { type: "frustum", cx, cy, z: 3.3, r0: 0.45, r1: 0.25, h: 0.7, sides: 8, tone: "trim" }];
    }
    case "antenna-tower": {
      const base = inset(0, 0, 1.2) as Solid & { type: "box" };
      return [
        base,
        ...clutter(base),
        box(cx - 0.7, cy - 0.7, 1.2, 1.4, 1.4, 5.2),
        { type: "frustum", cx, cy, z: 6.4, r0: 0.55, r1: 0.25, h: 0.6, sides: 6, tone: "trim" },
        { type: "mast", x: cx, y: cy, z: 7, h: 3.2 },
        { type: "mast", x: cx + 0.45, y: cy - 0.45, z: 6.4, h: 1.4 },
      ];
    }
    case "server-hall": {
      const hall = inset(0, 0, 1.6, "body", false) as Solid & { type: "box" };
      // Louvre rows along the roof, a stack, and plant.
      const rows = Math.max(2, Math.floor(d / 1.1));
      const louvres = Array.from({ length: rows }, (_, i) => box(x + 0.4, y + 0.35 + (i * (d - 0.7)) / rows, 1.6, w - 0.8, 0.35, 0.18, "trim"));
      return [hall, ...louvres, { type: "frustum", cx: x + w - 0.6, cy: y + 0.6, z: 1.6, r0: 0.3, r1: 0.26, h: 1.8, sides: 8, tone: "body" }];
    }
    case "market-hall": {
      // Long hall under a sawtooth of ridge roofs.
      const hall = inset(0, 0, 1.3);
      const n = Math.max(2, Math.round(w / 1.3));
      const roofs = Array.from({ length: n }, (_, i): Solid => ({ type: "gable", x: x + (i * w) / n, y, z: 1.3, w: w / n, d, h: 0.7, ridge: "y", tone: "body" }));
      return [hall, ...roofs];
    }
    case "glass-tower": {
      // Setback tower in glass with a brass crown (no logo, no sign yet).
      const k = Math.min(w, d) * 0.12;
      return [
        inset(0, 0, 0.6, "body", false),
        inset(0.6, k, 4.4, "glass"),
        inset(5, k + 0.45, 2.4, "glass"),
        inset(7.4, k + 0.8, 0.5, "trim"),
        { type: "mast", x: cx, y: cy, z: 7.9, h: 1.6 },
      ];
    }
    case "pavilion-mast": {
      // Low pavilion under a thin canopy, and a plain mast beside it (no flag, no emblem).
      const k = 0.5;
      return [
        inset(0, k, 1.1),
        box(x + k - 0.25, y + k - 0.25, 1.1, w - 2 * k + 0.5, d - 2 * k + 0.5, 0.15, "trim"),
        { type: "mast", x: x + 0.15, y: y + 0.15, z: 0, h: 4.2 },
      ];
    }
    case "observatory": {
      // Drum and dome, with a sensor mast: the project's instrument.
      const rad = Math.min(w, d) * 0.32;
      const base = inset(0, 0, 0.9) as Solid & { type: "box" };
      return [
        base,
        { type: "frustum", cx, cy, z: 0.9, r0: rad, r1: rad, h: 1.4, sides: 14, tone: "body" },
        { type: "frustum", cx, cy, z: 2.3, r0: rad, r1: rad * 0.82, h: 0.35, sides: 14, tone: "trim" },
        { type: "frustum", cx, cy, z: 2.65, r0: rad * 0.82, r1: rad * 0.5, h: 0.4, sides: 14, tone: "trim" },
        { type: "frustum", cx, cy, z: 3.05, r0: rad * 0.5, r1: 0.05, h: 0.3, sides: 14, tone: "trim" },
        { type: "mast", x: x + 0.3, y: y + d - 0.3, z: 0.9, h: 2.4 },
      ];
    }
    case "vault-monolith":
      // Sealed: a dark slab on a plinth. No windows, no door, no text.
      return [inset(0, 0, 0.3, "body", false), inset(0.3, 0.6, 4.6, "dark", false)];
    case "archive-tower": {
      const tw = Math.min(w, d) * 0.7;
      return [
        box(cx - tw / 2, cy - tw / 2, 0, tw, tw, 5.6),
        box(cx - tw / 2 + 0.3, cy - tw / 2 + 0.3, 5.6, tw - 0.6, tw - 0.6, 0.9),
        { type: "frustum", cx, cy, z: 6.5, r0: (tw - 0.6) / 2, r1: 0.05, h: 1.2, sides: 4, tone: "trim" },
      ];
    }
    case "lab": {
      const hall = inset(0, 0, 1.5) as Solid & { type: "box" };
      return [
        hall,
        { type: "frustum", cx: x + 0.9, cy: y + d - 0.9, z: 1.5, r0: 0.55, r1: 0.55, h: 1, sides: 10, tone: "trim" },
        { type: "frustum", cx: x + 2.1, cy: y + d - 0.9, z: 1.5, r0: 0.45, r1: 0.45, h: 0.8, sides: 10, tone: "trim" },
        { type: "mast", x: x + w - 0.4, y: y + 0.4, z: 1.5, h: 1.8 },
      ];
    }
    case "debrief-room":
      return [inset(0, 0.2, 1.1), { type: "gable", x: x + 0.2, y: y + 0.2, z: 1.1, w: w - 0.4, d: d - 0.4, h: 0.9, ridge: "x", tone: "body" }];
    case "risk-registry": {
      const top = inset(2.2, 0.5, 0.8) as Solid & { type: "box" };
      return [inset(0, 0, 2.2), top, ...clutter(top)];
    }
    case "dead-drop":
      // A small kiosk, half booth and half mailbox; the only place that touches the real inbox.
      return [box(cx - 0.4, cy - 0.4, 0, 0.8, 0.8, 1.1, "trim"), box(cx - 0.5, cy - 0.5, 1.1, 1, 1, 0.12, "body", false)];
  }
}

/** Highest point of a building, in world units. */
export function heightOf(solids: readonly Solid[]): number {
  return Math.max(...solids.map((s) => s.z + s.h));
}
