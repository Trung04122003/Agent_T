// Agent T City runtime (ROADMAP-v4 P32, P34, P35, P36): wires the engine together on the city route's
// stage. The city's plan and buildings are baked once per zoom step and mode (bake.ts) and copied to
// the screen only when the view changes; signs (signs.ts) and Agent T (figure.ts, agent.ts) draw over
// them, and the buildings standing in front of him are drawn again over him. In Mat the night engine
// (night.ts) lays the darkness on top, cut by his lantern (clipped to what it can see, visibility.ts),
// streetlamps and sign glows; rain falls on the High tier (rain.ts). The camera follows him (camera.ts);
// + and - change the zoom step. He enters from the alley nearest the plaza (agent.ts). Districts,
// the HUD and the briefings are DOM (hud.ts); their states only light the city.
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
import { LAYERS, planLayers, type LayerPlan } from "./engine/layers";
import { createLoop } from "./engine/loop";
import { createQuality, TIERS, type Tier } from "./engine/quality";
import { drawFigure, drawShadow, FIGURE } from "./figure";
import { createNight, hullOf, type Lantern, type NightView, type Occluder } from "./night";
import { palette, type Mode, type Palette } from "./palette";
import { ALLEYS, assignLots, ATLAS_TABLE, LAMPS, PLAZA, type CityData, type Rect } from "./plan";
import { createRain, glassWalls } from "./rain";
import { cityScene, silhouette } from "./render";
import { createSigns } from "./signs";
import { activeLens, createHud, createStates, nextObjective, RANK, type CityText } from "./hud";
import { switchMode } from "../scripts/declassify";
import type { Atlas } from "./atlas";
import { createAtlasView, type AtlasView } from "./atlas-view";
import { insidePolygon } from "./visibility";
import { walkWorld } from "./walk";

/** Bakes the Atlas's relief for every zoom step in idle time, one step per idle callback. */
function prebakeAtlas(view: AtlasView, dpr: () => number, pal: () => Palette): void {
  const idle = (fn: () => void) => ("requestIdleCallback" in window ? requestIdleCallback(() => fn(), { timeout: 2000 }) : setTimeout(fn, 200));
  let i = 0;
  const next = (): void => {
    if (i >= ZOOMS.length) return;
    view.prebake(ZOOMS[i++]!, dpr(), pal());
    idle(next);
  };
  idle(next);
}

export type CityHandle = { stop(): void; readonly plan: LayerPlan | null; readonly tier: Tier | "lite" };

const HX = TILE.w / 2;
const HY = TILE.h / 2;
/** His shadow falls away from the city's one light (render.ts LIGHT): to the screen's right. */
const SHADOW_DIR = { x: 0.999, y: -0.05 } as const;

/** Close enough to a door for its prompt, in tiles; near enough to a district to have scouted it. */
const AT_DOOR = 1.3;
const SCOUT = 6;

export function bootCity(stage: HTMLElement, data: CityData, text: CityText): CityHandle {
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
  // Above the darkness (P40): the beacon, Hoang Sa and Truong Sa; nothing may hide them.
  const topLayer = make("top");
  const topCtx = topLayer.getContext("2d")!;
  const lightMask = document.createElement("canvas"); // offscreen, never in the page
  const ctx = dynamic.getContext("2d", { alpha: true })!;
  let plan: LayerPlan | null = null;

  const layout = assignLots(data);
  const scene = cityScene(layout);
  const root = document.documentElement;
  const modeNow = (): Mode => (root.dataset["mode"] === "giai-mat" ? "giai-mat" : "mat");
  let pal = palette(modeNow());
  const layer = createStaticLayer(scene, pal, 1, 1);
  const signs = createSigns(layout, text.stir, layout.plots.map((p) => text.names[p.id] ?? ""));
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

  // Districts (P37): what can be opened, their states, the objective the compass points to.
  const classified = new Set(layout.vault ? [layout.vault.id] : []);
  const targets = world.footprints
    .filter((f) => f.id in text.names)
    .map((f) => ({ id: f.id, dx: f.door.x + 0.5, dy: f.door.y + 0.5, cx: (f.x0 + f.x1) / 2, cy: (f.y0 + f.y1) / 2, r: (f.x1 - f.x0 + f.y1 - f.y0) / 3 }));
  const states = createStates(text.order, () => {
    try {
      return sessionStorage;
    } catch {
      return null;
    }
  });
  const lens = activeLens(location.search, text.lenses);
  let objective = nextObjective(text, lens, states, classified);
  const hud = createHud(stage, text, states, (id) => {
    if (id === "dead-drop") return;
    // Opened in Giai mat, the summary is what shows: the district is declassified (the Vault never is).
    const to = !classified.has(id) && modeNow() === "giai-mat" ? "declassified" : "briefed";
    if (states.raise(id, to)) stateChanged();
  });
  /** A district's state rank for the baked dawn veils (-1: not a district). */
  const plotIds = new Set(layout.plots.map((p) => p.id));
  // Each district building's silhouette, for its windows' glow at night.
  const shapes = new Map(layout.plots.map((p) => [p.id, silhouette(building(p.archetype, p.rect, p.lot)).map((h) => Float64Array.from(h.flat()))]));
  const rank = (id: string): number => (plotIds.has(id) ? RANK[states.get(id)] : -1);
  /**
   * Lights and signs follow the states, in both modes (38.3). Night: briefed districts glow,
   * declassified ones glow brighter and their bars are off. Dawn: signs read clearly once briefed;
   * the veils and gold are baked into the static layer.
   */
  const applyLit = (): void => {
    const pools: number[] = [];
    const day = modeNow() === "giai-mat";
    layout.plots.forEach((p, i) => {
      const st = states.get(p.id);
      const t = targets.find((x) => x.id === p.id);
      // Night: a briefed district's windows glow; a declassified one is fully lit, its pool wider.
      if (t && RANK[st] >= RANK.briefed) pools.push(t.cx, t.cy, t.r * (st === "declassified" ? 1.7 : 1.3), st === "declassified" ? 1 : 0.7);
      signs.setClear(i, day ? RANK[st] >= RANK.briefed : st === "declassified");
    });
    // The Atlas is a hologram: it lights the plaza around it.
    pools.push(ATLAS_TABLE.x, ATLAS_TABLE.y, ATLAS_TABLE.relief * 1.5, 1);
    night.setLit(Float64Array.from(pools));
    night.setLitBuildings(
      layout.plots
        .filter((p) => RANK[states.get(p.id)] >= RANK.scouted)
        // Scouted: a faint rim of light (UX-v4 section 4); briefed: windows on; declassified: fully lit.
        .map((p) => ({ shape: shapes.get(p.id)!, strength: [0, 0.18, 0.45, 0.85][RANK[states.get(p.id)]]! })),
    );
  };
  function stateChanged(): void {
    objective = nextObjective(text, lens, states, classified);
    hud.refresh(objective);
    applyLit();
    // Dawn bakes the veils into the static layer: rebake, a few chunks a frame. Night bakes none of
    // it (the light shows the states), and switching to dawn rebakes everything anyway.
    if (pal.mode === "giai-mat") layer.setRank(rank);
    dirty = lightDirty = true;
    loop.poke();
  }

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
  let atHand: string | null = null;
  // The Atlas (P40): its data comes with the city's own file, /city/atlas.json (P39).
  let atlas: AtlasView | null = null;
  let hoverCode: string | null = null;
  let hoverX = NaN;
  let hoverY = NaN;
  void fetch("/city/atlas.json")
    .then((r) => (r.ok ? (r.json() as Promise<Atlas>) : Promise.reject(new Error(String(r.status)))))
    .then((a) => {
      atlas = createAtlasView(a, text.atlas);
      // For tests and tools: where the archipelago labels and the beacon were last drawn.
      Object.assign(topLayer, { atlasLabels: () => atlas?.labels() ?? [], atlasBeacon: () => atlas?.beacon() ?? null });
      stage.dataset["atlas"] = "ready";
      prebakeAtlas(atlas, () => plan?.dpr ?? 1, () => pal);
      dirty = lightDirty = true;
      loop.poke();
    })
    .catch(() => (stage.dataset["atlas"] = "failed"));

  // Sizes come from the observer's entry, not from reading the layout.
  let sizeW = 0;
  let sizeH = 0;
  const resize = new ResizeObserver(([entry]) => {
    if (!entry) return;
    sizeW = Math.round(entry.contentRect.width);
    sizeH = Math.round(entry.contentRect.height);
    replan();
  });
  /** Canvases for the stage's size and the tier's pixel budget (layers.ts); again on a tier change. */
  function replan(): void {
    const w = sizeW;
    const h = sizeH;
    if (!w || !h) return;
    plan = planLayers(w, h, devicePixelRatio || 1, LAYERS.pixels[quality.tier]);
    for (const c of plan.canvases) {
      const el = c.name === "dynamic" ? dynamic : c.name === "darkness" ? darkness : c.name === "light" ? lightMask : c.name === "top" ? topLayer : null;
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
    firstComposite = true;
    input.measure();
    loop.poke();
  }

  const quality = createQuality(start, (tier) => {
    stage.dataset["tier"] = tier;
    applyTier();
    replan();
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
    // Switching to Giai mat with a briefing open shows its summary: that district is declassified.
    const open = hud.openId;
    if (open && open !== "dead-drop" && !classified.has(open) && pal.mode === "giai-mat" && states.raise(open, "declassified")) stateChanged();
    layer.setPalette(pal);
    night.setPalette(pal);
    applyTier();
    applyLit();
    firstComposite = true;
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
      it.draw(ctx, pal, 1 / shown.zoom, rank, true);
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
      // M: the dossier's own mode switch (mode.ts is the one source of truth, 38.2).
      if (c === "mode") switchMode(modeNow() === "mat" ? "giai-mat" : "mat", stage);
      // E or Enter at a door opens it; F walks to the next objective (and opens it on arrival).
      if (c === "interact" && atHand) hud.open(atHand);
      if (c === "next" && objective && agent.entrance === "done") {
        const t = targets.find((x) => x.id === objective);
        if (t) agent.goTo(t.cx, t.cy);
      }
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
    // The door at hand (prompt), districts scouted on the way, the compass.
    let best = AT_DOOR;
    let hand: string | null = null;
    for (let i = 0; i < targets.length; i++) {
      const t = targets[i]!;
      const d = Math.hypot(agent.x - t.dx, agent.y - t.dy);
      if (agent.entrance === "done" && d < best) {
        best = d;
        hand = t.id;
      }
      if (t.id !== "dead-drop" && states.get(t.id) === "sealed" && Math.hypot(agent.x - t.cx, agent.y - t.cy) < SCOUT && states.raise(t.id, "scouted")) stateChanged();
      if (t.id === objective) {
        const ex = t.dx - agent.x;
        const ey = t.dy - agent.y;
        hud.point(Math.atan2((ex + ey) * HY, (ex - ey) * HX));
      }
    }
    atHand = hand;
    hud.prompt(hand);
    // The camera follows him; reduced motion snaps it.
    let moved = follow(cam, (agent.x - agent.y) * HX, (agent.x + agent.y) * HY, dt, reduced.matches, scene.bounds);
    if (moved) dirty = lightDirty = true;
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
    // The Atlas: the province under the cursor rises (or Da Nang's, when Agent T stands at the table).
    let tableInView = false;
    let animating = false;
    if (atlas) {
      const z = cam.zoom;
      const b = atlas.box;
      tableInView = !(b.x1 < nv.ox / z || b.x0 > (nv.ox + cam.w) / z || b.y1 < nv.oy / z || b.y0 > (nv.oy + cam.h) / z);
      if (p.over && p.kind === "mouse" && (p.x !== hoverX || p.y !== hoverY || moved)) {
        hoverX = p.x;
        hoverY = p.y;
        hoverCode = atlas.hit((p.x + nv.ox) / z, (p.y + nv.oy) / z);
      } else if (!p.over) hoverCode = null;
      const atTable = Math.abs(agent.x - ATLAS_TABLE.x) + Math.abs(agent.y - ATLAS_TABLE.y) < ATLAS_TABLE.relief + 1.4;
      animating = atlas.step(dt, hoverCode ?? (atTable ? atlas.hq : null), reduced.matches);

    }
    // The table's moving parts go on the top canvas, unless Agent T stands over the table on screen
    // (then they must respect depth, on the dynamic layer, redrawn every frame while he does).
    let liveBelow = false;
    if (atlas && tableInView) {
      const ax = (agent.x - agent.y) * HX;
      const ay = (agent.x + agent.y) * HY;
      const b = atlas.box;
      liveBelow = !(ax + 14 * FIGURE.scale < b.x0 || ax - 14 * FIGURE.scale > b.x1 || ay < b.y0 || ay - FIGURE.height * FIGURE.scale > b.y1);
    }
    if ((dirty || stirred || changed || (liveBelow && (animating || !reduced.matches))) && plan) {
      const missing = layer.composite(ctx, shown, firstComposite ? Infinity : 2);
      signs.draw(ctx, nv.ox, nv.oy, cam.zoom, plan.dpr, pal);
      // Agent T and the table in depth order: whoever is nearer is drawn last.
      const behind = agent.x + agent.y < ATLAS_TABLE.x + ATLAS_TABLE.y;
      if (behind) drawAgent(plan.dpr);
      if (atlas && tableInView) {
        atlas.draw(ctx, nv.ox, nv.oy, cam.zoom, plan.dpr, pal);
        if (liveBelow) atlas.drawLive(ctx, nv.ox, nv.oy, cam.zoom, plan.dpr, pal, now, reduced.matches);
      }
      if (!behind) drawAgent(plan.dpr);
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
    // The top layer: redrawn while the beacon pulses, or when the view moved.
    if (plan && atlas && (moved || lightDirty || animating || !reduced.matches)) {
      topCtx.setTransform(1, 0, 0, 1, 0, 0);
      topCtx.clearRect(0, 0, topLayer.width, topLayer.height);
      if (tableInView && !liveBelow) atlas.drawLive(topCtx, nv.ox, nv.oy, cam.zoom, plan.dpr, pal, now, reduced.matches);
      atlas.drawTop(topCtx, nv.ox, nv.oy, cam.zoom, plan.dpr, pal, now, reduced.matches);
    }
    lightDirty = false;
    // State for tests and tools, written only when it changes.
    const walking = agent.moving ? "1" : "0";
    if (agent.entrance !== shownEntrance) stage.dataset["entrance"] = shownEntrance = agent.entrance;
    if (walking !== shownWalking) stage.dataset["walking"] = shownWalking = walking;
    const door = agent.atDoor ?? "";
    if (door !== shownDoor) {
      stage.dataset["door"] = shownDoor = door;
      // Walked to a door (a click or F): open what is behind it.
      if (door) hud.open(door);
    }
    if (agent.entrance !== "done" || agent.moving) loop.poke(); // keep full pace while he moves
    fps?.(now);
  });
  const input = createInput(stage, window, () => loop.poke());
  applyTier();
  layer.setRank(rank);
  applyLit();
  hud.refresh(objective);
  // Deep link (UX-v4 section 1): /city/#d-<id> opens that briefing directly.
  const openFromHash = (): void => {
    const deep = /^#d-(.+)$/.exec(location.hash)?.[1];
    if (deep) hud.open(decodeURIComponent(deep));
  };
  openFromHash();
  addEventListener("hashchange", openFromHash);
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
      hud.dispose();
      removeEventListener("hashchange", openFromHash);
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
