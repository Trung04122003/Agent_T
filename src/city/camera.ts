// Camera follow (ROADMAP-v4 36.4, UX-v4 section 3): the view's centre eases toward Agent T and stays
// over the city. Exponential easing never overshoots, so pressing against the city's edge holds the
// camera still instead of rocking it; reduced motion snaps (no easing at all).

/** Time constant of the easing, ms: about 63% of the way in this long. */
export const FOLLOW_MS = 160;

export type Bounds = { x0: number; y0: number; x1: number; y1: number };

/** Moves `cam` toward (tx, ty) over dt ms, clamped to `bounds`. Returns true if it moved. */
export function follow(cam: { x: number; y: number }, tx: number, ty: number, dt: number, reduced: boolean, b: Bounds): boolean {
  const cx = Math.min(b.x1, Math.max(b.x0, tx));
  const cy = Math.min(b.y1, Math.max(b.y0, ty));
  const k = reduced ? 1 : 1 - Math.exp(-dt / FOLLOW_MS);
  let x = cam.x + (cx - cam.x) * k;
  let y = cam.y + (cy - cam.y) * k;
  // Within a hundredth of a pixel it has arrived: settle exactly, so a still camera is still.
  if (Math.abs(cx - x) < 0.01) x = cx;
  if (Math.abs(cy - y) < 0.01) y = cy;
  const moved = x !== cam.x || y !== cam.y;
  cam.x = x;
  cam.y = y;
  return moved;
}
