// Agent T City runtime (ROADMAP-v4 P32, P34, P35, P36): wires the engine together on the city route's
// stage. The city's plan and buildings are baked once per zoom step and mode (bake.ts) and copied to
// the screen only when the view changes; signs (signs.ts) and Agent T (figure.ts, agent.ts) draw over
// them, and the buildings standing in front of him are drawn again over him. In Mat the night engine
// (night.ts) lays the darkness on top, cut by his lantern (clipped to what it can see, visibility.ts),
// streetlamps and sign glows; rain falls on the High tier (rain.ts). The camera follows him (camera.ts);
// + and - change the zoom step. He enters from the alley nearest the plaza (agent.ts).
// Diagnostics: `?burn=<ms>` busy-waits that long every frame (P32.4 check); `?quality=high|medium|low`
// sets the tier as the HUD's Quality control will (P35.4 check); the dev server shows a frames-per-
// second counter. The stage's data-* attributes report bake times, the tier, the rain count, the
// entrance, whether he walks and the door he has reached.
import { createAgent } from "./agent";
import { building, heightOf } from "./archetypes";
import { createStaticLayer, ZOOMS, type View } from "./bake";
import { follow } from "./camera";
import { decideTier, readCapabilities } from "./engine/capabilities";
import { createInput } from "./engine/input";
import { TILE } from "./engine/iso";
import { planLayers, type LayerPlan } from "./engine/layers";
import { createLoop } from "./engine/loop";
import { createQuality, TIERS, type Tier } from "./engine/quality";
import { drawFigure, drawShadow, FIGURE } from "./figure";
import { createNight, hullOf, type Lantern, type NightView, type Occluder } from "./night";
import { palette, type Mode } from "./palette";
import { ALLEYS, assignLots, LAMPS, PLAZA, type CityData, type Rect } from "./plan";
import { createRain, glassWalls } from "./rain";
import { cityScene } from "./render";
import { createSigns } from "./signs";
import { insidePolygon } from "./visibility";
import { walkWorld } from "./walk";

export type CityHandle = { stop(): void; readonly plan: LayerPlan | null; readonly tier: Tier | "lite" };

const HX = TILE.w / 2;
const HY = TILE.h / 2;
/** His shadow falls away from the city's one light (render.ts LIGHT): to the screen's right. */
const SHADOW_DIR = { x: 0.999, y: -0.05 } as const;

export function bootCity(stage: HTMLElement, data: CityData): CityHandle {
  const start = decideTier(readCapabilities(window));
  stage.dataset["tier"] = start;
  // Lite: no canvas world at all; the route shows its static plan instead (shell.ts).
  if (start === "lite") return { stop() {}, plan: null, tier: "lite" };

  const make = (name: string): HTMLCanvasElement => {
    const c = document.createElement("canvas");
    c.className = `city-layer city-layer--${name}`;
    c.setAttribute("aria-hidden", "true");
    stage.append(c);
    return c;
  };
  const dynamic = make("dynamic");
  const darkness = make("darkness");
  const lightMask = document.createElement("canvas"); // offscreen, never in the page
  const ctx = dynamic.getContext("2d", { alpha: true })!;
  let plan: LayerPlan | null = null;

  const layout = assignLots(data);
  const scene = cityScene(layout);
  const root = document.documentElement;
  const modeNow = (): Mode => (root.dataset["mode"] === "giai-mat" ? "giai-mat" : "mat");
  let pal = palette(modeNow());
  const layer = createStaticLayer(scene, pal, 1, 1);
  const signs = createSigns(layout);
  type Hit = Occluder & { id: string; depth: number };
  const occluders: Hit[] = [
    ...layout.plots.map((p) => ({ id: p.id, rect: p.rect, h: heightOf(building(p.archetype, p.rect, p.lot)) })),
    ...layout.landmarks.map((l) => ({ id: l.id, rect: l.rect, h: heightOf(building(l.archetype, l.rect, l.id)) })),
    ...(layout.vault ? [{ id: layout.vault.id, rect: layout.vault.rect, h: heightOf(building("vault-monolith", layout.vault.rect, "vault")) }] : []),
  ]
    .map(({ id, rect, h }: { id: string; rect: Rect; h: number }) => {
      // The building's own footprint (lots keep a 0.5 tile sidewalk).
      const x0 = rect.x + 0.5;
      const y0 = rect.y + 0.5;
      const x1 = rect.x + rect.w - 0.5;
      const y1 = rect.y + rect.d - 0.5;
      return { id, x0, y0, x1, y1, hull: hullOf(x0, y0, x1, y1, h), depth: (x0 + x1 + y0 + y1) / 2 };
    })
    .sort((a, b) => b.depth - a.depth); // nearest first, for picking
  const night = createNight(darkness, lightMask, LAMPS, occluders, pal);
  const rain = createRain(glassWalls(layout));
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const world = walkWorld(layout);
  // He enters from the alley whose mouth is nearest the plaza's centre (UX-v4 section 6b).
  const pcx = PLAZA.x + PLAZA.w / 2;
  const pcy = PLAZA.y + PLAZA.d / 2;
  const alley = [...ALLEYS].sort((a, b) => Math.hypot(a.mouth.x - pcx, a.mouth.y - pcy) - Math.hypot(b.mouth.x - pcx, b.mouth.y - pcy))[0]!;
  const agent = createAgent(world, alley, reduced.matches);

  // The camera starts on him, at the middle zoom step.
  const cam: View = { x: (agent.x - agent.y) * HX, y: (agent.x + agent.y) * HY, zoom: ZOOMS[1], w: 0, h: 0 };
  /** The view the frame is drawn with: the camera's origin rounded to whole device pixels. */
  const shown: View = { x: 0, y: 0, zoom: cam.zoom, w: 0, h: 0 };
  const nv: NightView = { ox: 0, oy: 0, zoom: cam.zoom, k: 0.5 };
  const lantern: Lantern = { x: agent.x, y: agent.y, heading: agent.heading, power: agent.power };
  let dirty = true;
  let lightDirty = true;
  let firstComposite = true;
  let presses = 0;

  // Sizes come from the observer's entry, not from reading the layout.
  const resize = new ResizeObserver(([entry]) => {
    if (!entry) return;
    const w = Math.round(entry.contentRect.width);
    const h = Math.round(entry.contentRect.height);
    plan = planLayers(w, h, devicePixelRatio || 1);
    for (const c of plan.canvases) {
      const el = c.name === "dynamic" ? dynamic : c.name === "darkness" ? darkness : c.name === "light" ? lightMask : null;
      if (!el) continue;
      el.width = c.w;
      el.height = c.h;
    }
    layer.resize(plan.dpr, plan.canvases.find((c) => c.name === "chunk")!.count);
    cam.w = shown.w = w;
    cam.h = shown.h = h;
    nv.k = w ? darkness.width / w : 0.5;
    dirty = lightDirty = true;
    stage.dataset["dpr"] = String(plan.dpr);
    stage.dataset["backing"] = String(plan.total);
    input.measure();
    loop.poke();
  });

  const quality = createQuality(start, (tier) => {
    stage.dataset["tier"] = tier;
    applyTier();
  });
  function applyTier(): void {
    rain.setTier(quality.tier, pal.mode === "mat" && !reduced.matches);
    stage.dataset["rain"] = String(rain.count);
    lightDirty = true;
  }
  const asked = new URLSearchParams(location.search).get("quality");
  if (asked && (TIERS as readonly string[]).includes(asked)) quality.set(asked as Tier);
  const onReduced = (): void => {
    applyTier();
    loop.poke();
  };
  reduced.addEventListener("change", onReduced);
  // The dossier's mode switch repaints the city in the other palette (and lifts the night).
  const modeWatch = new MutationObserver(() => {
    pal = palette(modeNow());
    layer.setPalette(pal);
    night.setPalette(pal);
    applyTier();
    dirty = lightDirty = true;
    loop.poke();
  });
  modeWatch.observe(root, { attributes: true, attributeFilter: ["data-mode"] });

  const burn = Math.min(100, Number(new URLSearchParams(location.search).get("burn")) || 0);
  let first = true;
  const fps = import.meta.env.DEV ? devCounter(stage) : null;
  // Rain is painted over the darkness, in its pixels (one closure, made once).
  const paintRain = (c: CanvasRenderingContext2D): void => rain.draw(c, nv.k, nv.ox, nv.oy, nv.zoom, pal.rain, pal.glow);
  let shownEntrance = "";
  let shownWalking = "";
  let shownDoor = "";

  /** Agent T, his shadow first, then the buildings that stand in front of him drawn over him. */
  const drawAgent = (dpr: number): void => {
    const sx = (agent.x - agent.y) * HX;
    const sy = (agent.x + agent.y) * HY;
    const s = shown.zoom * dpr * FIGURE.scale;
    const X = (sx * shown.zoom - nv.ox) * dpr;
    const Y = (sy * shown.zoom - nv.oy) * dpr;
    const lit = agent.power > 0.5;
    ctx.setTransform(s, 0, 0, s, X, Y);
    drawShadow(ctx, agent.dir, agent.frame, pal.agent, SHADOW_DIR.x * pal.shadowLength, SHADOW_DIR.y * pal.shadowLength);
    ctx.setTransform(s, 0, 0, s, X, Y);
    drawFigure(ctx, agent.dir, agent.frame, pal.agent, lit);
    // His screen box (zoom 1), then whatever is nearer than him and overlaps it.
    const top = FIGURE.height * FIGURE.scale + 4;
    const half = 14 * FIGURE.scale;
    const depth = agent.x + agent.y;
    const z = shown.zoom * dpr;
    for (let i = 0; i < scene.items.length; i++) {
      const it = scene.items[i]!;
      if (it.depth <= depth || it.box.x1 < sx - half || it.box.x0 > sx + half || it.box.y1 < sy - top || it.box.y0 > sy + 4) continue;
      ctx.save();
      ctx.setTransform(z, 0, 0, z, -nv.ox * dpr, -nv.oy * dpr);
      ctx.beginPath();
      ctx.rect(sx - half, sy - top, 2 * half, top + 4);
      ctx.clip();
      it.draw(ctx, pal, 1 / shown.zoom);
      ctx.restore();
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  };

  const loop = createLoop((dt, now) => {
    quality.sample(dt);
    if (burn) for (const until = performance.now() + burn; performance.now() < until; );
    const st = input.state;
    const cmds = st.commands;
    for (let i = 0; i < cmds.length; i++) {
      const c = cmds[i];
      const z = ZOOMS.indexOf(cam.zoom as (typeof ZOOMS)[number]);
      const next = c === "zoom-in" ? z + 1 : c === "zoom-out" ? z - 1 : z;
      if (next !== z && ZOOMS[next]) {
        cam.zoom = ZOOMS[next]!;
        dirty = lightDirty = true;
      }
    }
    cmds.length = 0;
    const pressed = st.presses !== presses;
    presses = st.presses;
    // Clicks and taps: on a building, walk to its door; on the ground, walk there.
    for (let i = 0; i < st.taps.length; i++) {
      const t = st.taps[i]!;
      const sx = (t.x + nv.ox) / cam.zoom;
      const sy = (t.y + nv.oy) / cam.zoom;
      let hit: Hit | null = null;
      for (let j = 0; j < occluders.length && !hit; j++) if (insidePolygon(occluders[j]!.hull, sx, sy)) hit = occluders[j]!;
      if (hit) agent.goTo((hit.x0 + hit.x1) / 2, (hit.y0 + hit.y1) / 2);
      else agent.goTo((sx / HX + sy / HY) / 2, (sy / HY - sx / HX) / 2);
    }
    st.taps.length = 0;
    const held = st.held;
    const vx = (held.has("right") ? 1 : 0) - (held.has("left") ? 1 : 0);
    const vy = (held.has("down") ? 1 : 0) - (held.has("up") ? 1 : 0);
    const changed = agent.update(dt, vx, vy, held.has("fast"), pressed);
    // The camera follows him; reduced motion snaps it.
    if (follow(cam, (agent.x - agent.y) * HX, (agent.x + agent.y) * HY, dt, reduced.matches, scene.bounds)) dirty = lightDirty = true;
    // The lantern: in his hand; where he walks, or at the mouse while he stands (desktop).
    let heading = agent.heading;
    const p = st.pointer;
    if (!agent.moving && p.over && p.kind === "mouse" && agent.entrance === "done") {
      const pa = (p.x + nv.ox) / cam.zoom / HX;
      const pb = (p.y + nv.oy) / cam.zoom / HY;
      const px = (pa + pb) / 2;
      const py = (pb - pa) / 2;
      if (Math.abs(px - agent.x) + Math.abs(py - agent.y) > 0.3) heading = Math.atan2(py - agent.y, px - agent.x);
    }
    if (agent.x !== lantern.x || agent.y !== lantern.y || heading !== lantern.heading || agent.power !== lantern.power) {
      lantern.x = agent.x;
      lantern.y = agent.y;
      lantern.heading = heading;
      lantern.power = agent.power;
      lightDirty = true;
    }
    const stirred = signs.update(now, pal.mode === "mat" && !reduced.matches);
    if (rain.count) rain.step(dt, cam.w, cam.h);
    // The drawn view: the camera's origin on whole device pixels, so the ground never shimmers.
    const dpr = plan ? plan.dpr : 1;
    nv.ox = Math.round((cam.x * cam.zoom - cam.w / 2) * dpr) / dpr;
    nv.oy = Math.round((cam.y * cam.zoom - cam.h / 2) * dpr) / dpr;
    nv.zoom = shown.zoom = cam.zoom;
    shown.x = (nv.ox + cam.w / 2) / cam.zoom;
    shown.y = (nv.oy + cam.h / 2) / cam.zoom;
    if ((dirty || stirred || changed) && plan) {
      const missing = layer.composite(ctx, shown, firstComposite ? Infinity : 2);
      signs.draw(ctx, nv.ox, nv.oy, cam.zoom, plan.dpr, pal);
      drawAgent(plan.dpr);
      firstComposite = false;
      dirty = missing > 0;
      const s = layer.stats;
      stage.dataset["bakeChunks"] = String(s.baked);
      stage.dataset["bakeMs"] = s.ms.toFixed(1);
      stage.dataset["bakeMax"] = s.maxMs.toFixed(1);
      if (first) {
        first = false;
        performance.mark("city:first-frame"); // read by tools/perf/city-frames.mjs
      }
    }
    if (plan && lightDirty) night.light(nv, pal.mode === "mat" ? lantern : null, signs.centres, signs.count);
    if (plan && (lightDirty || rain.count)) night.paint(nv, rain.count ? paintRain : null);
    lightDirty = false;
    // State for tests and tools, written only when it changes.
    const walking = agent.moving ? "1" : "0";
    if (agent.entrance !== shownEntrance) stage.dataset["entrance"] = shownEntrance = agent.entrance;
    if (walking !== shownWalking) stage.dataset["walking"] = shownWalking = walking;
    const door = agent.atDoor ?? "";
    if (door !== shownDoor) stage.dataset["door"] = shownDoor = door;
    if (agent.entrance !== "done" || agent.moving) loop.poke(); // keep full pace while he moves
    fps?.(now);
  });
  const input = createInput(stage, window, () => loop.poke());
  applyTier();
  resize.observe(stage);
  loop.start();

  return {
    stop() {
      loop.stop();
      input.dispose();
      resize.disconnect();
      modeWatch.disconnect();
      reduced.removeEventListener("change", onReduced);
      layer.dispose();
    },
    get plan() {
      return plan;
    },
    get tier() {
      return quality.tier;
    },
  };
}

/** Dev server only: frames per second in the stage's corner, updated twice a second. */
function devCounter(stage: HTMLElement): (now: number) => void {
  const el = document.createElement("output");
  el.className = "city-fps";
  stage.append(el);
  let frames = 0;
  let since = 0;
  return (now) => {
    frames++;
    if (now - since >= 500) {
      el.textContent = `${Math.round((frames * 1000) / (now - since))} fps · ${stage.dataset["tier"]}`;
      frames = 0;
      since = now;
    }
  };
}
