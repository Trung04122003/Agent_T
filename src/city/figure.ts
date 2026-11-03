// Agent T, version 1 (ROADMAP-v4 36.1, UX-v4 section 6): a figure built from polygons, no image.
// Placeholder styling (the final look is P43), but the owner's kit is already readable: the long
// coat with five hem shards that lag behind the walk, the high left collar, the faceless visor with
// its brass slit turned toward where he faces, the flat-brimmed hat with a brass band, chelsea boots,
// the lantern in the left hand and the briefcase in the right. 8 facings, a 6-frame walk cycle made
// by transforms (bob, stride, lantern swing, hem lag). No face, no weapon, no emblem, no uniform.
//
// Local units are zoom-1 screen px with the feet at (0, 0) and up negative; the caller sets the
// transform. Directions: 0 east (screen right), clockwise in 45 degree steps, 2 south (toward the
// viewer), 6 north (away). Drawing uses numbers only (no allocation per frame).

/** `scale`: about 47 px tall at the middle zoom step (readable at 48 px, UX-v4 section 6). */
export const FIGURE = { height: 52, scale: 1.5, frames: 6 } as const;

export type AgentColors = { coat: string; rim: string; brass: string; visor: string; glow: string; shadow: string };

const TAU = Math.PI * 2;

/** One pose: where the parts go for a facing and a walk frame (or standing, frame -1). */
function pose(dir: number, frame: number) {
  const th = (dir * Math.PI) / 4;
  const side = Math.cos(th); // + toward screen right
  const front = Math.sin(th); // + toward the viewer
  const walking = frame >= 0;
  const p = walking ? (frame / FIGURE.frames) * TAU : 0;
  // His left hand: the facing turned a quarter to his left (the viewer's right when he faces us).
  const lh = th - Math.PI / 2;
  return {
    side,
    front,
    halfW: 6 + 3 * Math.abs(front),
    bob: walking ? -Math.abs(Math.sin(p)) * 1.4 : 0,
    stride: walking ? Math.sin(p) * 2.6 : 0,
    swing: walking ? Math.sin(p) * 0.35 : 0,
    lag: walking ? -side * (1.2 + Math.abs(Math.sin(p)) * 1.2) : 0,
    lx: Math.cos(lh) * 9.5,
    ly: Math.sin(lh) * 3,
    lBehind: Math.sin(lh) < -0.1,
  };
}
type Pose = ReturnType<typeof pose>;

function lantern(ctx: CanvasRenderingContext2D, q: Pose, c: AgentColors, lit: boolean): void {
  const hx = q.lx;
  const hy = -19 + q.ly + q.bob;
  const ox = Math.sin(q.swing) * 4;
  const oy = Math.cos(q.swing) * 4;
  ctx.strokeStyle = c.rim;
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(hx, hy);
  ctx.lineTo(hx + ox, hy + oy);
  ctx.stroke();
  ctx.fillStyle = c.brass;
  ctx.fillRect(hx + ox - 1.8, hy + oy, 3.6, 5.2);
  ctx.fillStyle = lit ? c.glow : c.coat;
  ctx.fillRect(hx + ox - 1, hy + oy + 1.2, 2, 2.6);
}

function briefcase(ctx: CanvasRenderingContext2D, q: Pose, c: AgentColors): void {
  const hx = -q.lx;
  const hy = -15 - q.ly + q.bob - Math.sin(q.swing) * 0.6;
  ctx.fillStyle = c.coat;
  ctx.fillRect(hx - 4, hy, 8, 5.5);
  ctx.strokeStyle = c.brass;
  ctx.lineWidth = 0.7;
  ctx.strokeRect(hx - 4, hy, 8, 5.5);
  ctx.fillStyle = c.brass;
  ctx.fillRect(hx - 0.8, hy - 0.2, 1.6, 1.2); // the one latch
}

/** The coat, collar, head and hat as one silhouette path (also the shadow's shape). */
function body(ctx: CanvasRenderingContext2D, q: Pose): void {
  const w = q.halfW;
  const b = q.bob;
  ctx.beginPath();
  // Coat: shoulders, down the side, five hem shards (lagging), up the other side.
  ctx.moveTo(-w * 0.95, -36 + b);
  ctx.lineTo(-w * 1.05, -22 + b);
  const hemL = -w * 1.15;
  const hemR = w * 1.15;
  for (let i = 0; i <= 5; i++) {
    const x = hemL + ((hemR - hemL) * i) / 5 + q.lag * (0.4 + (i % 2) * 0.6);
    ctx.lineTo(x, (i % 2 ? -3 : -7) + b * 0.5);
    if (i < 5) ctx.lineTo(hemL + ((hemR - hemL) * (i + 0.5)) / 5 + q.lag, -2.5 + b * 0.5);
  }
  ctx.lineTo(w * 1.05, -22 + b);
  ctx.lineTo(w * 0.95, -36 + b);
  // Collar: high and stiff on his left like a file tab, low on his right.
  const left = q.lx >= 0 ? 1 : -1;
  ctx.lineTo(w * 0.55 * left, -43 + b);
  ctx.lineTo(w * 0.2 * left, -37 + b);
  ctx.closePath();
  // Head and hat.
  ctx.moveTo(4.2, -41 + b);
  ctx.ellipse(0, -41 + b, 4.2, 5, 0, 0, TAU);
  ctx.moveTo(8.5, -45.5 + b);
  ctx.ellipse(0, -45.5 + b, 8.5, 2.6, 0, 0, TAU);
  ctx.rect(-4.5, -51 + b, 9, 5.5);
}

/** Draws Agent T with his feet at the current origin. `frame`: 0-5 walking, -1 standing. */
export function drawFigure(ctx: CanvasRenderingContext2D, dir: number, frame: number, c: AgentColors, lanternLit: boolean): void {
  const q = pose(dir, frame);
  if (q.lBehind) lantern(ctx, q, c, lanternLit);
  else briefcase(ctx, q, c);
  // Chelsea boots: two, striding along the facing.
  ctx.fillStyle = c.coat;
  const fx = q.side * q.stride;
  const fy = q.front * q.stride * 0.5;
  ctx.fillRect(-3.6 + fx, -4 + fy, 3, 4);
  ctx.fillRect(0.6 - fx, -4 - fy, 3, 4);
  ctx.fillStyle = c.rim;
  ctx.fillRect(-2.4 + fx, -3.2 + fy, 0.7, 1.6); // the elastic gussets
  ctx.fillRect(1.8 - fx, -3.2 - fy, 0.7, 1.6);
  body(ctx, q);
  ctx.fillStyle = c.coat;
  ctx.fill();
  ctx.strokeStyle = c.rim;
  ctx.lineWidth = 0.9;
  ctx.stroke();
  // Hat band and brim notch (left side).
  ctx.strokeStyle = c.brass;
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(-4.5, -46.6 + q.bob);
  ctx.lineTo(4.5, -46.6 + q.bob);
  ctx.stroke();
  // The visor slit, shifted toward where he faces; hidden when he faces away.
  if (q.front > -0.4) {
    const cx = q.side * 2.2;
    const half = 1 + 1.6 * Math.max(0, q.front) + 0.6 * Math.abs(q.side);
    ctx.strokeStyle = c.visor;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(cx - half, -41.5 + q.bob);
    ctx.lineTo(cx + half, -41.5 + q.bob);
    ctx.stroke();
  }
  if (q.lBehind) briefcase(ctx, q, c);
  else lantern(ctx, q, c, lanternLit);
}

/**
 * His long shadow (UX-v4 section 3, ROADMAP 36.5): the silhouette skewed onto the ground away from
 * the city's one light. `dx, dy`: where a point one unit up lands on the ground (screen px per px of
 * height), so the caller decides its length (long in Mat, short in Giai mat).
 */
export function drawShadow(ctx: CanvasRenderingContext2D, dir: number, frame: number, c: AgentColors, dx: number, dy: number): void {
  const q = pose(dir, frame);
  ctx.transform(1, 0, -dx, -dy, 0, 0);
  body(ctx, q);
  ctx.fillStyle = c.shadow;
  ctx.fill();
}

/** Facing (0-7) from a screen-space direction. */
export function facingOf(sx: number, sy: number): number {
  return (Math.round(Math.atan2(sy, sx) / (Math.PI / 4)) + 8) % 8;
}
