// What the lantern can see (ROADMAP-v4 36.3): a 2D visibility polygon on the ground, by casting rays
// from the lantern against the edges of every building footprint in reach (one ray to each corner and
// just either side of it, plus an even fan for the round edge of the reach). The polygon does not
// depend on where the lantern points, so it is cached per position cell (a quarter tile): turning
// costs nothing, walking recomputes it a few times per tile. The cone is the cone sprite clipped to it.

/** Footprint edges as segments: x1, y1, x2, y2 per edge (world units). */
export function footprintSegments(boxes: readonly { x0: number; y0: number; x1: number; y1: number }[]): Float64Array {
  const out = new Float64Array(boxes.length * 16);
  boxes.forEach((b, i) => {
    out.set([b.x0, b.y0, b.x1, b.y0, b.x1, b.y0, b.x1, b.y1, b.x1, b.y1, b.x0, b.y1, b.x0, b.y1, b.x0, b.y0], i * 16);
  });
  return out;
}

const FAN = 48;
const EPS = 1e-4;

/** Distance along the ray (dx, dy) from (ox, oy) to the nearest segment, capped at `reach`. */
function cast(ox: number, oy: number, dx: number, dy: number, reach: number, segs: Float64Array): number {
  let t = reach;
  for (let i = 0; i < segs.length; i += 4) {
    const ax = segs[i]!;
    const ay = segs[i + 1]!;
    const ex = segs[i + 2]! - ax;
    const ey = segs[i + 3]! - ay;
    const den = dx * ey - dy * ex;
    if (Math.abs(den) < 1e-12) continue;
    const u = ((ax - ox) * ey - (ay - oy) * ex) / den; // along the ray
    const v = ((ax - ox) * dy - (ay - oy) * dx) / den; // along the segment
    if (u > 0 && u < t && v >= 0 && v <= 1) t = u;
  }
  return t;
}

/** The visibility polygon around (ox, oy) within `reach`, as x, y pairs sorted by angle. */
export function visibility(ox: number, oy: number, reach: number, segs: Float64Array): Float64Array {
  // Only segments that can matter: within reach of the origin (by bounding box).
  const near: number[] = [];
  for (let i = 0; i < segs.length; i += 4) {
    const x0 = Math.min(segs[i]!, segs[i + 2]!);
    const x1 = Math.max(segs[i]!, segs[i + 2]!);
    const y0 = Math.min(segs[i + 1]!, segs[i + 3]!);
    const y1 = Math.max(segs[i + 1]!, segs[i + 3]!);
    if (x1 < ox - reach || x0 > ox + reach || y1 < oy - reach || y0 > oy + reach) continue;
    near.push(segs[i]!, segs[i + 1]!, segs[i + 2]!, segs[i + 3]!);
  }
  const local = Float64Array.from(near);
  const angles: number[] = [];
  for (let i = 0; i < FAN; i++) angles.push((i / FAN) * Math.PI * 2 - Math.PI);
  for (let i = 0; i < local.length; i += 2) {
    const a = Math.atan2(local[i + 1]! - oy, local[i]! - ox);
    angles.push(a - EPS, a, a + EPS);
  }
  angles.sort((a, b) => a - b);
  const out = new Float64Array(angles.length * 2);
  angles.forEach((a, k) => {
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    const t = cast(ox, oy, dx, dy, reach, local);
    out[k * 2] = ox + dx * t;
    out[k * 2 + 1] = oy + dy * t;
  });
  return out;
}

/** Point in polygon (even-odd), polygon as x, y pairs. */
export function insidePolygon(poly: Float64Array, x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 2; i < poly.length; j = i, i += 2) {
    const xi = poly[i]!;
    const yi = poly[i + 1]!;
    const xj = poly[j]!;
    const yj = poly[j + 1]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Visibility polygons cached per quarter-tile cell (least recently used dropped first). */
export function visibilityCache(segs: Float64Array, reach: number, size = 64): { get(x: number, y: number): Float64Array; readonly misses: number } {
  const cells = new Map<number, Float64Array>();
  let misses = 0;
  return {
    get(x, y) {
      const cx = Math.floor(x * 4);
      const cy = Math.floor(y * 4);
      const key = cx * 4096 + cy;
      let poly = cells.get(key);
      if (poly) {
        cells.delete(key);
      } else {
        misses++;
        poly = visibility((cx + 0.5) / 4, (cy + 0.5) / 4, reach, segs);
        if (cells.size >= size) cells.delete(cells.keys().next().value!);
      }
      cells.set(key, poly);
      return poly;
    },
    get misses() {
      return misses;
    },
  };
}
