// Terraced 3D view of the map (owner request 2026-11-01, after the Cao Bang rice-terrace idea): the
// brightness steps of the 2D map become heights. Built in the browser from the 2D drawing (no extra
// HTML, no library): the ground is tilted by an affine transform, every shape is lifted by its step,
// and the risers are thin copies stacked from low to high, so later (higher) layers cover lower ones.
// One static SVG: no animation, nothing runs while the mouse rests.
const SVG = "http://www.w3.org/2000/svg";
/** Ground tilt: x' = x + SKEW * y, y' = SQUASH * y (seen from above the south, a little west). */
export const TILT = { skew: -0.25, squash: 0.7 } as const;
/** Height of each step in map units; risers are drawn every `riser` units. */
export const HEIGHT = { world: 4, base: 12, near: 26, home: 44, riser: 2 } as const;
type Step = "base" | "near" | "home";

export const ground = (x: number, y: number, h = 0): [number, number] => [x + TILT.skew * y, TILT.squash * y - h];

/**
 * viewBox around a box of the 2D map (Viet Nam and its islands), tilted, with room for the highest
 * step above it and a margin of sea.
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
  const y0 = Math.min(...ys) - HEIGHT.home - pad;
  return [x0, y0, Math.max(...xs) + pad - x0, Math.max(...ys) + pad - y0].map((n) => Math.round(n)) as [number, number, number, number];
}

export function initMap3d(map: HTMLElement): void {
  const frame = map.querySelector<HTMLElement>("[data-map-3d]");
  const svg = frame?.querySelector<SVGSVGElement>("[data-map-3d-svg]");
  const flat = map.querySelector<SVGSVGElement>("[data-map-svg]");
  if (!frame || !svg || !flat || svg.dataset["built"]) return;
  svg.dataset["built"] = "1";

  // Frame Viet Nam and its islands (box computed at build: the 2D map may not be displayed).
  const [fx, fy, fw, fh] = (frame.dataset["focus"] ?? "").split(" ").map(Number);
  const focus = { x: fx!, y: fy!, width: fw!, height: fh! };
  svg.setAttribute("viewBox", frameBox(focus).join(" "));
  const affine = `matrix(1 0 ${TILT.skew} ${TILT.squash} 0 0)`;
  const world = [...flat.querySelectorAll<SVGPathElement>(".map__land path")].map((p) => p.getAttribute("d")!);
  const provinces = [...flat.querySelectorAll<SVGPathElement>("[data-map-provinces] path")];
  const borders = [...flat.querySelectorAll<SVGPathElement>(".map__border")];
  const isles = [...flat.querySelectorAll<SVGCircleElement>(".map__islands circle:not(.map__isle-pad)")].map(
    (c) => [Number(c.getAttribute("cx")), Number(c.getAttribute("cy"))] as const,
  );

  const el = <K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string> = {}) => {
    const e = document.createElementNS(SVG, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    return e;
  };
  /** A layer at height h: the tilted ground, moved up by h. */
  // --lift (0 at sea level, 1 at the top step) lightens the risers as they rise, as if lit from above.
  const layer = (h: number) => el("g", { transform: `translate(0 ${-h}) ${affine}`, style: `--lift:${(h / HEIGHT.home).toFixed(2)}` });

  const scene = el("g");
  const marks = el("g", { class: "map3d__marks" });
  const [vx, vy, vw, vh] = svg.getAttribute("viewBox")!.split(" ").map(Number) as [number, number, number, number];
  const fade = el("radialGradient", { id: "map3d-fade" });
  fade.append(el("stop", { offset: "0.55", "stop-color": "white" }), el("stop", { offset: "1", "stop-color": "black" }));
  const mask = el("mask", { id: "map3d-mask", maskUnits: "userSpaceOnUse", x: String(vx), y: String(vy), width: String(vw), height: String(vh) });
  mask.append(el("rect", { x: String(vx), y: String(vy), width: String(vw), height: String(vh), fill: "url(#map3d-fade)" }));
  const defs = el("defs");
  defs.append(fade, mask);
  const worldLayer = el("g", { mask: "url(#map3d-mask)" });
  svg.replaceChildren(defs, worldLayer, scene, marks);

  const build = (): void => {
    const era = map.dataset["era"] === "before" ? "tb" : "ta";
    const height = (p: SVGPathElement) => HEIGHT[(p.dataset[era] ?? "base") as Step];
    const levels: SVGGElement[] = [];
    for (let z = 0; z <= HEIGHT.home; z += HEIGHT.riser) levels.push(layer(z));
    const at = (h: number) => levels[Math.round(h / HEIGHT.riser)]!;

    if (!worldLayer.firstChild) {
      for (let z = 0; z <= HEIGHT.world; z += HEIGHT.riser) {
        const g = layer(z);
        for (const d of world) g.append(el("path", { d, class: z < HEIGHT.world ? "map3d__wall map3d__wall--world" : "map3d__world" }));
        worldLayer.append(g);
      }
    }
    for (const p of provinces) {
      const d = p.getAttribute("d")!;
      const data = { "data-tb": p.dataset["tb"]!, "data-ta": p.dataset["ta"]! };
      const h = height(p);
      for (let z = 0; z < h; z += HEIGHT.riser) at(z).append(el("path", { d, class: "map3d__wall", ...data }));
      at(h).append(
        el("path", {
          d,
          class: "map3d__top",
          ...data,
          "data-code": p.dataset["code"]!,
          "data-unit": p.dataset["unit"]!,
          "data-name": p.dataset["name"]!,
          "data-unit-name": p.dataset["unitName"]!,
        }),
      );
    }
    // Province borders on the lowest step; raised steps cover theirs, as terraces would.
    const base = at(HEIGHT.base);
    for (const b of borders) base.append(el("path", { d: b.getAttribute("d")!, class: b.getAttribute("class")!.replace(/map__/g, "map3d__") }));
    scene.replaceChildren(...levels);
  };

  // Marks on top of every step: the islands (on the near step), the four places and the capital
  // (on the home step), copied from the 2D drawing with their classes, so they look the same.
  const lift = (x: number, y: number, h: number) => ground(x, y, h).map((n) => Math.round(n * 10) / 10).join(" ");
  for (const [x, y] of isles) marks.append(el("circle", { class: "map3d__isle", transform: `translate(${lift(x, y, HEIGHT.near)})`, r: "1.8" }));
  const copies = new Map<SVGGElement, SVGGElement>();
  for (const g of flat.querySelectorAll<SVGGElement>(".map__point, .map__capital")) {
    const m = g.transform.baseVal.consolidate()?.matrix;
    if (!m) continue;
    const copy = g.cloneNode(true) as SVGGElement;
    copy.setAttribute("transform", `translate(${lift(m.e, m.f, HEIGHT.home)})`);
    copy.removeAttribute("data-place"); // the legend drives the 2D points; this one mirrors them
    marks.append(copy);
    copies.set(g, copy);
  }
  // Mirror the highlight of the 2D points (legend hover, pick).
  new MutationObserver(() => {
    for (const [g, copy] of copies) copy.classList.toggle("is-active", g.classList.contains("is-active"));
  }).observe(flat, { subtree: true, attributes: true, attributeFilter: ["class"] });

  build();
  new MutationObserver(build).observe(map, { attributes: true, attributeFilter: ["data-era"] });

  // Hover: the same readout as the 2D map, in this frame's corner.
  const readout = frame.querySelector<HTMLElement>("[data-map-readout]");
  const name = readout?.querySelector<HTMLElement>("[data-readout-name]");
  const sub = readout?.querySelector<HTMLElement>("[data-readout-sub]");
  if (!readout || !name || !sub) return;
  const show = (hot: SVGPathElement | null): void => {
    for (const p of scene.querySelectorAll(".is-hot")) p.classList.remove("is-hot");
    readout.hidden = !hot;
    if (!hot) return;
    const after = map.dataset["era"] === "after";
    const tops = [...scene.querySelectorAll<SVGPathElement>(".map3d__top")];
    const lit = after ? tops.filter((p) => p.dataset["unit"] === hot.dataset["unit"]) : [hot];
    for (const p of lit) p.classList.add("is-hot");
    name.textContent = (after ? hot.dataset["unitName"] : hot.dataset["name"]) ?? "";
    sub.textContent = after && lit.length > 1 ? lit.map((p) => p.dataset["name"]).join(" + ") : "";
  };
  scene.addEventListener("pointerover", (e) => show((e.target as Element).closest<SVGPathElement>(".map3d__top")));
  svg.addEventListener("pointerleave", () => show(null));
}
