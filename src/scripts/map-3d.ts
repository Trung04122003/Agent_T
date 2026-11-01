// Terraced 3D view of the map (owner request 2026-11-01, after the Cao Bang rice-terrace idea): the
// brightness steps of the 2D map become heights. Built in the browser from the 2D drawing (no extra
// HTML, no library): the ground is tilted by an affine transform, every shape is lifted by its step,
// and the risers are thin copies stacked from low to high, so later (higher) layers cover lower ones.
// Same handling as the flat map (zoom, pan, legend picks), and the province under the pointer rises a
// step higher, then settles back when the pointer leaves (the owner's terrace "ripple").
import { zoomable } from "./map-zoom";

const SVG = "http://www.w3.org/2000/svg";
/** Ground tilt: x' = x + SKEW * y, y' = SQUASH * y (seen from above the south, a little west). */
export const TILT = { skew: -0.25, squash: 0.7 } as const;
/** Height of each step in map units; risers are drawn every `riser` units. */
export const HEIGHT = { world: 4, base: 12, near: 26, home: 44, riser: 2 } as const;
/** The ripple: how much higher the province under the pointer rises, and how long (ms) it takes. */
export const RISE = { by: 22, up: 180, down: 160 } as const;
type Step = "base" | "near" | "home";

export const ground = (x: number, y: number, h = 0): [number, number] => [x + TILT.skew * y, TILT.squash * y - h];

/**
 * viewBox around a box of the 2D map (Viet Nam and its islands), tilted, with room for the highest
 * step (and the ripple above it) and a margin of sea.
 */
export function frameBox(b: { x: number; y: number; width: number; height: number }, pad = 24): [number, number, number, number] {
  const corners = [
    [b.x, b.y],
    [b.x + b.width, b.y],
    [b.x, b.y + b.height],
    [b.x + b.width, b.y + b.height],
  ].map(([x, y]) => ground(x!, y!));
  const xs = corners.map((c) => c[0]);
  const ys = corners.map((c) => c[1]);
  const x0 = Math.min(...xs) - pad;
  const y0 = Math.min(...ys) - HEIGHT.home - RISE.by - pad;
  return [x0, y0, Math.max(...xs) + pad - x0, Math.max(...ys) + pad - y0].map((n) => Math.round(n)) as [number, number, number, number];
}

/** Ease-out (cubic): fast start, soft landing. */
export const ease = (t: number): number => 1 - (1 - t) ** 3;

export function initMap3d(map: HTMLElement): void {
  const frame = map.querySelector<HTMLElement>("[data-map-3d]");
  const svg = frame?.querySelector<SVGSVGElement>("[data-map-3d-svg]");
  const flat = map.querySelector<SVGSVGElement>("[data-map-svg]");
  if (!frame || !svg || !flat || svg.dataset["built"]) return;
  svg.dataset["built"] = "1";

  // Frame Viet Nam and its islands (box computed at build: the 2D map may not be displayed).
  const [fx, fy, fw, fh] = (frame.dataset["focus"] ?? "").split(" ").map(Number);
  svg.setAttribute("viewBox", frameBox({ x: fx!, y: fy!, width: fw!, height: fh! }).join(" "));
  const affine = `matrix(1 0 ${TILT.skew} ${TILT.squash} 0 0)`;
  const world = [...flat.querySelectorAll<SVGPathElement>(".map__land path")].map((p) => p.getAttribute("d")!);
  const frontier = flat.querySelector<SVGPathElement>("[data-map-frontier]")?.getAttribute("d");
  const provinces = [...flat.querySelectorAll<SVGPathElement>("[data-map-provinces] path")];
  const borders = [...flat.querySelectorAll<SVGPathElement>(".map__border")];
  const isles = [...flat.querySelectorAll<SVGCircleElement>(".map__islands circle:not(.map__isle-pad)")].map(
    (c) => [Number(c.getAttribute("cx")), Number(c.getAttribute("cy"))] as const,
  );
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const el = <K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string> = {}) => {
    const e = document.createElementNS(SVG, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    return e;
  };
  // --lift (0 at sea level, 1 at the home step) lightens the risers as they rise, as if lit from above.
  const place = (g: SVGGElement, h: number): void => {
    g.setAttribute("transform", `translate(0 ${-h.toFixed(2)}) ${affine}`);
    g.style.setProperty("--lift", (h / HEIGHT.home).toFixed(2));
  };
  /** A layer at height h: the tilted ground, moved up by h. */
  const layer = (h: number): SVGGElement => {
    const g = el("g");
    place(g, h);
    return g;
  };
  const data = (p: SVGPathElement) => ({ "data-code": p.dataset["code"]!, "data-tb": p.dataset["tb"]!, "data-ta": p.dataset["ta"]! });
  const topOf = (p: SVGPathElement) =>
    el("path", { d: p.getAttribute("d")!, class: "map3d__top", ...data(p), "data-unit": p.dataset["unit"]!, "data-name": p.dataset["name"]!, "data-unit-name": p.dataset["unitName"]! });

  const scene = el("g");
  const rising = el("g");
  const marks = el("g", { class: "map3d__marks" });
  const [vx, vy, vw, vh] = svg.getAttribute("viewBox")!.split(" ").map(Number) as [number, number, number, number];
  const fade = el("radialGradient", { id: "map3d-fade" });
  fade.append(el("stop", { offset: "0.55", "stop-color": "white" }), el("stop", { offset: "1", "stop-color": "black" }));
  const mask = el("mask", { id: "map3d-mask", maskUnits: "userSpaceOnUse", x: String(vx), y: String(vy), width: String(vw), height: String(vh) });
  mask.append(el("rect", { x: String(vx), y: String(vy), width: String(vw), height: String(vh), fill: "url(#map3d-fade)" }));
  const defs = el("defs");
  defs.append(fade, mask);
  // Neighbours' land fades into the sea towards the edges, so no cut edge shows.
  const worldLayer = el("g", { mask: "url(#map3d-mask)" });
  for (let z = 0; z <= HEIGHT.world; z += HEIGHT.riser) {
    const g = layer(z);
    for (const d of world) g.append(el("path", { d, class: z < HEIGHT.world ? "map3d__wall map3d__wall--world" : "map3d__world" }));
    if (z === HEIGHT.world && frontier) g.append(el("path", { d: frontier, class: "map3d__frontier" }));
    worldLayer.append(g);
  }
  svg.replaceChildren(defs, worldLayer, scene, rising, marks);

  const era = () => (map.dataset["era"] === "before" ? "tb" : "ta");
  const stepOf = (p: SVGPathElement) => HEIGHT[(p.dataset[era()] ?? "base") as Step];

  const build = (): void => {
    dropRises();
    const levels: SVGGElement[] = [];
    for (let z = 0; z <= HEIGHT.home; z += HEIGHT.riser) levels.push(layer(z));
    const at = (h: number) => levels[Math.round(h / HEIGHT.riser)]!;
    for (const p of provinces) {
      const h = stepOf(p);
      for (let z = 0; z < h; z += HEIGHT.riser) at(z).append(el("path", { d: p.getAttribute("d")!, class: "map3d__wall", ...data(p) }));
      at(h).append(topOf(p));
    }
    // Province borders on the lowest step; raised steps cover theirs, as terraces would.
    const base = at(HEIGHT.base);
    for (const b of borders) base.append(el("path", { d: b.getAttribute("d")!, class: b.getAttribute("class")!.replace(/map__/g, "map3d__") }));
    scene.replaceChildren(...levels);
  };

  // Marks on top of every step: the neighbours' names (on their step), the islands (on the near
  // step), the four places and the capital (on the home step), copied from the 2D drawing with their
  // classes, so they look the same.
  const lift = (x: number, y: number, h: number) => ground(x, y, h).map((n) => Math.round(n * 10) / 10) as [number, number];
  const copy = (g: SVGGElement, h: number): [SVGGElement, [number, number]] | null => {
    const m = g.transform.baseVal.consolidate()?.matrix;
    if (!m) return null;
    const c = g.cloneNode(true) as SVGGElement;
    const at = lift(m.e, m.f, h);
    c.setAttribute("transform", `translate(${at.join(" ")})`);
    marks.append(c);
    return [c, at];
  };
  for (const g of flat.querySelectorAll<SVGGElement>(".map__country")) copy(g, HEIGHT.world);
  for (const [x, y] of isles) marks.append(el("circle", { class: "map3d__isle", transform: `translate(${lift(x, y, HEIGHT.near).join(" ")})`, r: "1.8" }));
  const copies = new Map<SVGGElement, SVGGElement>();
  const spots = new Map<string, [number, number]>();
  for (const g of flat.querySelectorAll<SVGGElement>(".map__point, .map__capital")) {
    const made = copy(g, HEIGHT.home);
    if (!made) continue;
    made[0].removeAttribute("data-place"); // the legend drives the 2D points; this one mirrors them
    copies.set(g, made[0]);
    if (g.dataset["place"]) spots.set(g.dataset["place"], made[1]);
  }
  // Mirror the highlight of the 2D points (legend hover, pick).
  new MutationObserver(() => {
    for (const [g, c] of copies) c.classList.toggle("is-active", g.classList.contains("is-active"));
  }).observe(flat, { subtree: true, attributes: true, attributeFilter: ["class"] });

  // Zoom and pan, as on the flat map; a place picked in the legend is zoomed to here too.
  const controls = frame.querySelector<HTMLElement>("[data-map-zoom]");
  if (controls) {
    const zoom = zoomable(svg, controls);
    for (const b of map.querySelectorAll<HTMLButtonElement>("[data-place-btn]")) {
      // Runs after the flat map's own handler, which has set aria-pressed by then.
      b.addEventListener("click", () => {
        const at = spots.get(b.dataset["placeBtn"]!);
        if (at && b.getAttribute("aria-pressed") === "true") zoom.focus(...at);
      });
    }
  }

  // The ripple. The province under the pointer (after the merger: its whole unit) is redrawn on top
  // as a separate stack, which rises RISE.by higher; the original stack hides meanwhile. Leaving, the
  // stack settles back and is removed. At most one rising and one settling at a time (motion budget:
  // two effects), each moving only the transforms of its layers, and only while it moves.
  type Rise = { key: string; codes: Set<string>; group: SVGGElement; layers: [SVGGElement, number][]; h: number; t: number; raf: number };
  let up: Rise | null = null;
  let down: Rise | null = null;
  const hide = (r: Rise, hidden: boolean): void => {
    for (const e of scene.querySelectorAll<SVGElement>("[data-code]")) if (r.codes.has(e.dataset["code"]!)) e.classList.toggle("is-lifted", hidden);
  };
  const pose = (r: Rise): void => {
    const top = r.h + RISE.by * ease(r.t);
    for (const [g, f] of r.layers) place(g, f * top);
  };
  const finish = (r: Rise): void => {
    cancelAnimationFrame(r.raf);
    r.group.remove();
    hide(r, false);
  };
  const animate = (r: Rise, to: 0 | 1): void => {
    cancelAnimationFrame(r.raf);
    const from = r.t;
    const ms = (to ? RISE.up : RISE.down) * Math.abs(to - from);
    const start = performance.now();
    const step = (now: number): void => {
      r.t = reduced || ms === 0 ? to : from + (to - from) * Math.min(1, (now - start) / ms);
      pose(r);
      if (r.t !== to) r.raf = requestAnimationFrame(step);
      else if (to === 0) {
        finish(r);
        if (down === r) down = null;
      }
    };
    r.raf = requestAnimationFrame(step);
  };
  const raise = (tops: SVGPathElement[], key: string): void => {
    if (up?.key === key) return;
    if (up) {
      if (down) finish(down);
      down = up;
      down.group.classList.add("is-settling");
      animate(down, 0);
    }
    up = null;
    if (!tops.length) return;
    const codes = new Set(tops.map((p) => p.dataset["code"]!));
    const h = stepOf(tops[0]!);
    const group = el("g", { class: "map3d__rise" });
    const layers: [SVGGElement, number][] = [];
    const n = (h + RISE.by) / HEIGHT.riser;
    for (let i = 0; i < n; i++) {
      const g = el("g");
      for (const p of tops) g.append(el("path", { d: p.getAttribute("d")!, class: "map3d__wall", ...data(p) }));
      layers.push([g, i / n]);
    }
    const crown = el("g");
    for (const p of tops) {
      const t = topOf(p);
      t.classList.add("is-hot");
      crown.append(t);
    }
    layers.push([crown, 1]);
    group.append(...layers.map(([g]) => g));
    up = { key, codes, group, layers, h, t: 0, raf: 0 };
    pose(up);
    rising.append(group);
    hide(up, true);
    animate(up, 1);
  };
  function dropRises(): void {
    for (const r of [up, down]) if (r) finish(r);
    up = down = null;
  }

  build();
  new MutationObserver(build).observe(map, { attributes: true, attributeFilter: ["data-era"] });

  // Hover: the same readout as the 2D map, in this frame's corner, and the ripple.
  const readout = frame.querySelector<HTMLElement>("[data-map-readout]");
  const name = readout?.querySelector<HTMLElement>("[data-readout-name]");
  const sub = readout?.querySelector<HTMLElement>("[data-readout-sub]");
  if (!readout || !name || !sub) return;
  const show = (hot: SVGElement | null): void => {
    for (const p of scene.querySelectorAll(".is-hot")) p.classList.remove("is-hot");
    readout.hidden = !hot;
    if (!hot) return raise([], "");
    const after = map.dataset["era"] === "after";
    const tops = [...scene.querySelectorAll<SVGPathElement>(".map3d__top")];
    const self = tops.find((p) => p.dataset["code"] === hot.dataset["code"])!;
    const lit = after ? tops.filter((p) => p.dataset["unit"] === self.dataset["unit"]) : [self];
    for (const p of lit) p.classList.add("is-hot");
    name.textContent = (after ? self.dataset["unitName"] : self.dataset["name"]) ?? "";
    sub.textContent = after && lit.length > 1 ? lit.map((p) => p.dataset["name"]).join(" + ") : "";
    raise(lit, after ? `u:${self.dataset["unit"]}` : `p:${self.dataset["code"]}`);
  };
  // Over the risen stack (its top or its face) the province stays up; anywhere else (sea, another
  // country) it settles.
  svg.addEventListener("pointerover", (e) => {
    const hit = (e.target as Element).closest<SVGElement>("[data-code]");
    if (hit && up?.group.contains(hit)) return;
    show(hit && scene.contains(hit) && hit.classList.contains("map3d__top") ? hit : null);
  });
  svg.addEventListener("pointerleave", () => show(null));
}
