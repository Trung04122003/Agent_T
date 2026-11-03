// 2:1 isometric projection for Agent T City (ROADMAP-v4 P32.1, UX-v4 section 3). One module for the
// whole city: world tiles (x east-south, y west-south, z up) to screen pixels and back, plus depth
// keys for painter's-order drawing. The Atlas keeps its own map geometry; only the city uses this.

/** A tile's diamond on screen: twice as wide as tall (2:1). Z_PX: screen pixels per world unit up. */
export const TILE = { w: 64, h: 32 } as const;
export const Z_PX = 32;

export type World = { x: number; y: number; z?: number };
export type Screen = { sx: number; sy: number };

/** World -> screen (before the camera). Height lifts a point straight up the screen. */
export function toScreen({ x, y, z = 0 }: World): Screen {
  return { sx: (x - y) * (TILE.w / 2), sy: (x + y) * (TILE.h / 2) - z * Z_PX };
}

/**
 * Screen -> world on the plane at height z (picking: which ground point is under the pointer).
 * The exact inverse of toScreen for that z.
 */
export function toWorld({ sx, sy }: Screen, z = 0): Required<World> {
  const a = sx / (TILE.w / 2); // x - y
  const b = (sy + z * Z_PX) / (TILE.h / 2); // x + y
  return { x: (a + b) / 2, y: (b - a) / 2, z };
}

/** The tile holding a world point. */
export const tileOf = ({ x, y }: World): { tx: number; ty: number } => ({ tx: Math.floor(x), ty: Math.floor(y) });

/**
 * Painter's order: farther first. On a 2:1 grid, what lies further down the screen (greater x + y)
 * is nearer the viewer; ties break by height, then by x for a stable order.
 */
export function depthKey({ x, y, z = 0 }: World): number {
  return (x + y) * 1024 + z * 4 + x / 1024;
}

/** Sorts in place, farthest first; returns the same array. */
export function sortByDepth<T extends World>(items: T[]): T[] {
  return items.sort((a, b) => depthKey(a) - depthKey(b));
}
