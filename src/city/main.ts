// Agent T City runtime (ROADMAP-v4 P32, P34, P35): wires the engine together on the city route's
// stage. The city's plan and buildings are baked once per zoom step and mode (bake.ts) and copied to
// the screen only when the view changes; signs draw over them (signs.ts). In Mat the night engine
// (night.ts) lays the darkness on top, cut by a lantern, streetlamps and sign glows; rain falls on the
// High tier (rain.ts). Until Agent T walks the city (P36) the lantern stands at the view's centre and
// points at the mouse, and the camera pans with the arrow keys (Shift: faster), zooms with + and -.
// Diagnostics: `?burn=<ms>` busy-waits that long every frame (P32.4 check); `?quality=high|medium|low`
// sets the tier as the HUD's Quality control will (P35.4 check); the dev server shows a frames-per-
// second counter. The stage's data-* attributes report bake times, the tier and the rain count.
import { building, heightOf } from "./archetypes";
import { createStaticLayer, ZOOMS, type View } from "./bake";
import { decideTier, readCapabilities } from "./engine/capabilities";
import { createInput } from "./engine/input";
import { TILE } from "./engine/iso";
import { planLayers, type LayerPlan } from "./engine/layers";
import { createLoop } from "./engine/loop";
import { createQuality, TIERS, type Tier } from "./engine/quality";
import { createNight, hullOf, type Lantern, type NightView, type Occluder } from "./night";
import { palette, type Mode } from "./palette";
import { assignLots, LAMPS, PLAZA, type CityData, type Rect } from "./plan";
import { createRain, glassWalls } from "./rain";
import { cityScene } from "./render";
import { createSigns } from "./signs";

export type CityHandle = { stop(): void; readonly plan: LayerPlan | null; readonly tier: Tier | "lite" };

/** Camera pan speed in CSS pixels per second; Shift doubles it. */
const PAN = 520;
/** Where the lantern points with no mouse to follow: up the screen (north). */
const DEFAULT_HEADING = (-3 * Math.PI) / 4;
const HX = TILE.w / 2;
const HY = TILE.h / 2;

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
  const occluders: Occluder[] = [
    ...layout.plots.map((p) => ({ rect: p.rect, h: heightOf(building(p.archetype, p.rect, p.lot)) })),
    ...layout.landmarks.map((l) => ({ rect: l.rect, h: heightOf(building(l.archetype, l.rect, l.id)) })),
    ...(layout.vault ? [{ rect: layout.vault.rect, h: heightOf(building("vault-monolith", layout.vault.rect, "vault")) }] : []),
  ].map(({ rect, h }: { rect: Rect; h: number }) => {
    // The building's own footprint (lots keep a 0.5 tile sidewalk).
    const x0 = rect.x + 0.5;
    const y0 = rect.y + 0.5;
    const x1 = rect.x + rect.w - 0.5;
    const y1 = rect.y + rect.d - 0.5;
    return { x0, y0, x1, y1, hull: hullOf(x0, y0, x1, y1, h) };
  });
  const night = createNight(darkness, lightMask, LAMPS, occluders, pal);
  const rain = createRain(glassWalls(layout));
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");

  // The camera starts over the Atlas plaza, at the middle zoom step.
  const cx = PLAZA.x + PLAZA.w / 2;
  const cy = PLAZA.y + PLAZA.d / 2;
  const cam: View = { x: (cx - cy) * HX, y: (cx + cy) * HY, zoom: ZOOMS[1], w: 0, h: 0 };
  const nv: NightView = { ox: 0, oy: 0, zoom: cam.zoom, k: 0.5 };
  const lantern: Lantern = { x: cx, y: cy, heading: DEFAULT_HEADING };
  let dirty = true;
  let lightDirty = true;
  let firstComposite = true;

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
    cam.w = w;
    cam.h = h;
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

  /** Keeps the view's centre over the city. */
  const clamp = (): void => {
    const b = scene.bounds;
    cam.x = Math.min(b.x1, Math.max(b.x0, cam.x));
    cam.y = Math.min(b.y1, Math.max(b.y0, cam.y));
  };

  const loop = createLoop((dt, now) => {
    quality.sample(dt);
    if (burn) for (const until = performance.now() + burn; performance.now() < until; );
    const cmds = input.state.commands;
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
    const held = input.state.held;
    const vx = (held.has("right") ? 1 : 0) - (held.has("left") ? 1 : 0);
    const vy = (held.has("down") ? 1 : 0) - (held.has("up") ? 1 : 0);
    if (vx || vy) {
      const step = (PAN * (held.has("fast") ? 2 : 1) * dt) / 1000 / cam.zoom;
      cam.x += vx * step;
      cam.y += vy * step;
      clamp();
      dirty = lightDirty = true;
    }
    // The lantern: on the ground under the view's centre, aimed at the mouse when it is over the city.
    const a = cam.x / HX;
    const b = cam.y / HY;
    const lx = (a + b) / 2;
    const ly = (b - a) / 2;
    let heading = lantern.heading;
    const p = input.state.pointer;
    if (p.over && p.kind === "mouse") {
      const pa = (cam.x + (p.x - cam.w / 2) / cam.zoom) / HX;
      const pb = (cam.y + (p.y - cam.h / 2) / cam.zoom) / HY;
      const px = (pa + pb) / 2;
      const py = (pb - pa) / 2;
      if (Math.abs(px - lx) + Math.abs(py - ly) > 0.3) heading = Math.atan2(py - ly, px - lx);
    }
    if (lx !== lantern.x || ly !== lantern.y || heading !== lantern.heading) {
      lantern.x = lx;
      lantern.y = ly;
      lantern.heading = heading;
      lightDirty = true;
    }
    const stirred = signs.update(now, pal.mode === "mat" && !reduced.matches);
    if (rain.count) rain.step(dt, cam.w, cam.h);
    nv.ox = cam.x * cam.zoom - cam.w / 2;
    nv.oy = cam.y * cam.zoom - cam.h / 2;
    nv.zoom = cam.zoom;
    if ((dirty || stirred) && plan) {
      const missing = layer.composite(ctx, cam, firstComposite ? Infinity : 2);
      signs.draw(ctx, nv.ox, nv.oy, cam.zoom, plan.dpr, pal);
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
