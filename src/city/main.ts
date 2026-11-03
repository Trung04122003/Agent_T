// Agent T City runtime (ROADMAP-v4 P32, P34): wires the engine together on the city route's stage and
// shows the city: its plan and buildings, baked once per zoom step and mode (bake.ts), copied to the
// screen only when the view changes. Until Agent T walks it (P36), the camera pans with the arrow
// keys (Shift: faster) and zooms with + and -, held inside the city's edges.
// Diagnostics: `?burn=<ms>` busy-waits that long every frame, to show the automatic step-down on a
// real build (P32.4 check); the dev server also shows a frames-per-second counter. The stage's
// data-bake-* attributes report bake times (P34.3 measurement).
import { createStaticLayer, ZOOMS, type View } from "./bake";
import { decideTier, readCapabilities } from "./engine/capabilities";
import { createInput } from "./engine/input";
import { planLayers, type LayerPlan } from "./engine/layers";
import { createLoop } from "./engine/loop";
import { createQuality, type Tier } from "./engine/quality";
import { palette, type Mode } from "./palette";
import { assignLots, PLAZA, type CityData } from "./plan";
import { cityScene } from "./render";
import { toScreen } from "./engine/iso";

export type CityHandle = { stop(): void; readonly plan: LayerPlan | null; readonly tier: Tier | "lite" };

/** Camera pan speed in CSS pixels per second; Shift doubles it. */
const PAN = 520;

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
  const ctx = dynamic.getContext("2d", { alpha: true })!;
  let plan: LayerPlan | null = null;
  let size = { w: 0, h: 0 };

  const scene = cityScene(assignLots(data));
  const root = document.documentElement;
  const modeNow = (): Mode => (root.dataset["mode"] === "giai-mat" ? "giai-mat" : "mat");
  const layer = createStaticLayer(scene, palette(modeNow()), 1, 1);
  // The camera starts over the Atlas plaza, at the middle zoom step.
  const centre = toScreen({ x: PLAZA.x + PLAZA.w / 2, y: PLAZA.y + PLAZA.d / 2 });
  const cam: View = { x: centre.sx, y: centre.sy, zoom: ZOOMS[1], w: 0, h: 0 };
  let dirty = true;
  let firstComposite = true;

  // Sizes come from the observer's entry, not from reading the layout.
  const resize = new ResizeObserver(([entry]) => {
    if (!entry) return;
    size = { w: Math.round(entry.contentRect.width), h: Math.round(entry.contentRect.height) };
    plan = planLayers(size.w, size.h, devicePixelRatio || 1);
    for (const c of plan.canvases) {
      const el = c.name === "dynamic" ? dynamic : c.name === "darkness" ? darkness : null;
      if (!el) continue;
      el.width = c.w;
      el.height = c.h;
    }
    layer.resize(plan.dpr, plan.canvases.find((c) => c.name === "chunk")!.count);
    cam.w = size.w;
    cam.h = size.h;
    dirty = true;
    stage.dataset["dpr"] = String(plan.dpr);
    stage.dataset["backing"] = String(plan.total);
    input.measure();
    loop.poke();
  });
  // The dossier's mode switch repaints the city in the other palette.
  const modeWatch = new MutationObserver(() => {
    layer.setPalette(palette(modeNow()));
    dirty = true;
    loop.poke();
  });
  modeWatch.observe(root, { attributes: true, attributeFilter: ["data-mode"] });

  const quality = createQuality(start, (tier) => (stage.dataset["tier"] = tier));
  const burn = Math.min(100, Number(new URLSearchParams(location.search).get("burn")) || 0);
  let first = true;
  const fps = import.meta.env.DEV ? devCounter(stage) : null;

  /** Keeps the view's centre over the city. */
  const clamp = (): void => {
    const b = scene.bounds;
    cam.x = Math.min(b.x1, Math.max(b.x0, cam.x));
    cam.y = Math.min(b.y1, Math.max(b.y0, cam.y));
  };

  const loop = createLoop((dt, now) => {
    quality.sample(dt);
    if (burn) for (const until = performance.now() + burn; performance.now() < until; );
    for (const c of input.state.commands.splice(0)) {
      const z = ZOOMS.indexOf(cam.zoom as (typeof ZOOMS)[number]);
      const next = c === "zoom-in" ? z + 1 : c === "zoom-out" ? z - 1 : z;
      if (next !== z && ZOOMS[next]) {
        cam.zoom = ZOOMS[next]!;
        dirty = true;
      }
    }
    const held = input.state.held;
    const vx = (held.has("right") ? 1 : 0) - (held.has("left") ? 1 : 0);
    const vy = (held.has("down") ? 1 : 0) - (held.has("up") ? 1 : 0);
    if (vx || vy) {
      const step = (PAN * (held.has("fast") ? 2 : 1) * dt) / 1000 / cam.zoom;
      cam.x += vx * step;
      cam.y += vy * step;
      clamp();
      dirty = true;
    }
    if (dirty && plan) {
      const missing = layer.composite(ctx, cam, firstComposite ? Infinity : 2);
      firstComposite = false;
      dirty = missing > 0;
      const s = layer.stats;
      stage.dataset["bakeChunks"] = String(s.baked);
      stage.dataset["bakeMs"] = s.ms.toFixed(1);
      stage.dataset["bakeMax"] = s.maxMs.toFixed(1);
      if (first) {
        first = false;
        performance.mark("city:first-frame"); // read by the P32 measurement and tools/perf/city-frames.mjs
      }
    }
    fps?.(now);
  });
  const input = createInput(stage, window, () => loop.poke());
  resize.observe(stage);
  loop.start();

  return {
    stop() {
      loop.stop();
      input.dispose();
      resize.disconnect();
      modeWatch.disconnect();
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
