// Agent T's movement and his entrance (ROADMAP-v4 36.2, 36.6, UX-v4 sections 3 and 6b).
// Keyboard: walk in screen directions (up is north on screen), Shift faster, sliding along walls.
// Pointer: click the ground to walk there over the road graph (A*), click a building to walk to its
// door. He can never get stuck (walk.ts). The entrance: he waits hidden in the alley nearest the plaza
// with his lantern shut; on the first press (or after about 1.2 s) he steps silently out to its
// mouth, opening the lantern; another press skips to the end. With reduced motion he starts at the
// mouth, lantern open. Numbers only on the per-frame path; a click builds its path once.
import { TILE } from "./engine/iso";
import { facingOf } from "./figure";
import type { Alley } from "./plan";
import { findPath, footprintAt, free, nearestFree, nearestRoad, slide, type Footprint, type WalkWorld } from "./walk";
import { GRID } from "./plan";

export const AGENT = {
  /** Tiles per second; Shift multiplies. */
  speed: 3.2,
  fast: 1.7,
  /** Tiles per walk cycle (6 frames). */
  stride: 0.95,
  /** Close enough to a waypoint, tiles. */
  arrive: 0.08,
  /** No progress for this long while following a path: snap free and stop. */
  stuckMs: 800,
  /** The entrance: wait, then step out at this speed. */
  waitMs: 1200,
  stepSpeed: 1.6,
} as const;

export type Entrance = "hidden" | "stepping" | "done";
const HX = TILE.w / 2;
const HY = TILE.h / 2;

export type Agent = {
  readonly x: number;
  readonly y: number;
  /** 0-7 (figure.ts); world heading in radians (for the lantern). */
  readonly dir: number;
  readonly heading: number;
  /** Walk frame 0-5, or -1 standing. */
  readonly frame: number;
  readonly moving: boolean;
  readonly entrance: Entrance;
  /** The lantern, 0 shut to 1 open. */
  readonly power: number;
  /** The building whose door he has just reached, until he moves again. */
  readonly atDoor: string | null;
  /** Walks to a ground point, or to a building's door; false if no way there. */
  goTo(x: number, y: number): boolean;
  /**
   * One frame. `vx, vy`: the keyboard's direction on screen (-1..1 each, up negative); `pressed`: a
   * new key press or tap this frame. Returns true when anything visible changed.
   */
  update(dt: number, vx: number, vy: number, fast: boolean, pressed: boolean): boolean;
};

export function createAgent(w: WalkWorld, alley: Alley, reduced: boolean): Agent {
  // He waits two tiles in, deep enough to be in the dark, near enough to step out in about a second.
  const pocket = alley.tiles[Math.min(1, alley.tiles.length - 1)]!;
  const mouth = { x: alley.mouth.x + 0.5, y: alley.mouth.y + 0.5 };
  const start = reduced ? mouth : { x: pocket.x + 0.5, y: pocket.y + 0.5 };
  const pos = { x: start.x, y: start.y };
  // Facing out of the alley, toward its mouth.
  const ox = mouth.x - (pocket.x + 0.5);
  const oy = mouth.y - (pocket.y + 0.5);
  let heading = Math.atan2(oy, ox);
  let dir = facingOf((ox - oy) * HX, (ox + oy) * HY);
  let phase = 0;
  let moving = false;
  let entrance: Entrance = reduced ? "done" : "hidden";
  let power = reduced ? 1 : 0;
  let waited = 0;
  let atDoor: string | null = null;
  // The path being followed: waypoints as x, y pairs, the index of the next one.
  let path: Float64Array | null = null;
  let next = 0;
  let target: Footprint | null = null;
  let stuck = 0;

  /** Walks (dx, dy) world tiles; keeps facing, walk phase and heading in step. */
  const step = (dx: number, dy: number): number => {
    const bx = pos.x;
    const by = pos.y;
    slide(w, pos, dx, dy);
    const mx = pos.x - bx;
    const my = pos.y - by;
    const d = Math.hypot(mx, my);
    if (d > 1e-6) {
      heading = Math.atan2(my, mx);
      dir = facingOf((mx - my) * HX, (mx + my) * HY);
      phase = (phase + d / AGENT.stride) % 1;
    }
    return d;
  };

  return {
    get x() {
      return pos.x;
    },
    get y() {
      return pos.y;
    },
    get dir() {
      return dir;
    },
    get heading() {
      return heading;
    },
    get frame() {
      return moving ? Math.floor(phase * 6) % 6 : -1;
    },
    get moving() {
      return moving;
    },
    get entrance() {
      return entrance;
    },
    get power() {
      return power;
    },
    get atDoor() {
      return atDoor;
    },
    goTo(x, y) {
      if (entrance !== "done") return false;
      const fp = footprintAt(w, x, y);
      const from = w.roads[Math.floor(pos.y) * GRID + Math.floor(pos.x)] ? { x: Math.floor(pos.x), y: Math.floor(pos.y) } : nearestRoad(w, pos.x, pos.y);
      const to = fp ? fp.door : nearestRoad(w, x, y);
      if (!from || !to) return false;
      const tiles = findPath(w, from, to);
      if (!tiles) return false;
      // Tile centres, then (on open ground) the exact point clicked.
      const end = !fp && free(w, x, y) ? 1 : 0;
      path = new Float64Array((tiles.length + end) * 2);
      tiles.forEach((t, i) => {
        path![i * 2] = t.x + 0.5;
        path![i * 2 + 1] = t.y + 0.5;
      });
      if (end) {
        path[tiles.length * 2] = x;
        path[tiles.length * 2 + 1] = y;
      }
      next = 0;
      target = fp;
      stuck = 0;
      atDoor = null;
      return true;
    },
    update(dt, vx, vy, fast, pressed) {
      const was = moving;
      const wasDoor = atDoor;
      moving = false;
      if (entrance === "hidden") {
        waited += dt;
        if (pressed || waited >= AGENT.waitMs) entrance = "stepping";
        return entrance !== "hidden";
      }
      if (entrance === "stepping") {
        const ex = mouth.x - pos.x;
        const ey = mouth.y - pos.y;
        const d = Math.hypot(ex, ey);
        const s = (AGENT.stepSpeed * dt) / 1000;
        const total = Math.hypot(ox, oy) || 1;
        if (pressed || d <= s) {
          pos.x = mouth.x;
          pos.y = mouth.y;
          entrance = "done";
          power = 1;
          return true;
        }
        pos.x += (ex / d) * s;
        pos.y += (ey / d) * s;
        phase = (phase + s / AGENT.stride) % 1;
        moving = true;
        power = Math.min(1, 1 - (d - s) / total + 0.15);
        return true;
      }
      const speed = (AGENT.speed * (fast ? AGENT.fast : 1) * dt) / 1000;
      if (vx || vy) {
        // Screen direction to the ground: up the screen is north (x and y both decreasing).
        let wx = vx / HX + vy / HY;
        let wy = vy / HY - vx / HX;
        const l = Math.hypot(wx, wy) || 1;
        wx /= l;
        wy /= l;
        path = null;
        target = null;
        atDoor = null;
        moving = step(wx * speed, wy * speed) > 0;
      } else if (path) {
        let left = speed;
        let moved = 0;
        while (left > 1e-6 && path && next * 2 < path.length) {
          const tx = path[next * 2]!;
          const ty = path[next * 2 + 1]!;
          const ex = tx - pos.x;
          const ey = ty - pos.y;
          const d = Math.hypot(ex, ey);
          if (d <= AGENT.arrive) {
            next++;
            continue;
          }
          const s = Math.min(left, d);
          const got = step((ex / d) * s, (ey / d) * s);
          moved += got;
          left -= s;
          if (got < s * 0.5) break; // blocked: the watchdog below decides
        }
        moving = moved > 0;
        stuck = moved > speed * 0.2 ? 0 : stuck + dt;
        if (path && next * 2 >= path.length) {
          // Arrived. At a door, turn to face the building.
          if (target) {
            const fx = (target.x0 + target.x1) / 2 - pos.x;
            const fy = (target.y0 + target.y1) / 2 - pos.y;
            heading = Math.atan2(fy, fx);
            dir = facingOf((fx - fy) * HX, (fx + fy) * HY);
            atDoor = target.id;
          }
          path = null;
          target = null;
        } else if (stuck > AGENT.stuckMs) {
          const out = nearestFree(w, pos.x, pos.y);
          pos.x = out.x;
          pos.y = out.y;
          path = null;
          target = null;
          stuck = 0;
        }
      }
      // Never stuck, whatever put him there.
      if (!free(w, pos.x, pos.y)) {
        const out = nearestFree(w, pos.x, pos.y);
        pos.x = out.x;
        pos.y = out.y;
      }
      return moving || was !== moving || wasDoor !== atDoor;
    },
  };
}
