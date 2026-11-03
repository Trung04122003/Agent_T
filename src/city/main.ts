// Agent T City runtime (ROADMAP-v4 P32): wires the engine together on the city route's stage. P32
// draws nothing yet (an empty, cleared scene): it proves the loop, layers, quality tiers, input and
// capability check hold their budgets before any art exists.
// Diagnostics: `?burn=<ms>` busy-waits that long every frame, to show the automatic step-down on a
// real build (P32.4 check); the dev server also shows a frames-per-second counter.
import { decideTier, readCapabilities } from "./engine/capabilities";
import { createInput } from "./engine/input";
import { planLayers, type LayerPlan } from "./engine/layers";
import { createLoop } from "./engine/loop";
import { createQuality, type Tier } from "./engine/quality";

export type CityHandle = { stop(): void; readonly plan: LayerPlan | null; readonly tier: Tier | "lite" };

export function bootCity(stage: HTMLElement): CityHandle {
  const start = decideTier(readCapabilities(window));
  stage.dataset["tier"] = start;
  // Lite: no canvas world at all (the static view is P33.4).
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
    stage.dataset["dpr"] = String(plan.dpr);
    stage.dataset["backing"] = String(plan.total);
    input.measure();
  });

  const quality = createQuality(start, (tier) => (stage.dataset["tier"] = tier));
  const burn = Math.min(100, Number(new URLSearchParams(location.search).get("burn")) || 0);
  let first = true;
  const fps = import.meta.env.DEV ? devCounter(stage) : null;

  const loop = createLoop((dt, now) => {
    quality.sample(dt);
    if (burn) for (const until = performance.now() + burn; performance.now() < until; );
    if (plan) ctx.clearRect(0, 0, dynamic.width, dynamic.height);
    fps?.(now);
    if (first) {
      first = false;
      performance.mark("city:first-frame"); // read by the P32 measurement and later city-frames
    }
  });
  const input = createInput(stage, window, () => loop.poke());
  resize.observe(stage);
  loop.start();

  return {
    stop() {
      loop.stop();
      input.dispose();
      resize.disconnect();
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
