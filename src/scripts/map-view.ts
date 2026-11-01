// Map interaction: zoom and pan (map-zoom.ts), and the link between the legend and the points.
import { zoomable } from "./map-zoom";

export { ZOOM } from "./map-zoom";

export function initMapView(): void {
  const map = document.querySelector<HTMLElement>("[data-map]");
  const svg = map?.querySelector<SVGSVGElement>("[data-map-svg]");
  const controls = map?.querySelector<HTMLElement>("[data-map-frame] [data-map-zoom]");
  if (!map || !svg || !controls) return;

  const points = [...map.querySelectorAll<SVGGElement>("[data-place]")];
  const items = [...map.querySelectorAll<HTMLButtonElement>("[data-place-btn]")];

  // Highlight: the hovered place wins, otherwise the one picked in the legend.
  let hovered: string | null = null;
  let picked: string | null = null;
  const highlight = (): void => {
    const id = hovered ?? picked;
    for (const p of points) p.classList.toggle("is-active", p.dataset["place"] === id);
    for (const b of items) {
      b.classList.toggle("is-active", b.dataset["placeBtn"] === id);
      b.setAttribute("aria-pressed", String(b.dataset["placeBtn"] === picked));
    }
  };
  const hover = (id: string | null): void => {
    hovered = id;
    highlight();
  };
  const zoom = zoomable(svg, controls, () => {
    picked = null;
    highlight();
  });

  for (const b of items) {
    const id = b.dataset["placeBtn"]!;
    b.addEventListener("pointerenter", () => hover(id));
    b.addEventListener("pointerleave", () => hover(null));
    b.addEventListener("focus", () => hover(id));
    b.addEventListener("blur", () => hover(null));
    // Pick: zoom in on the place (or release it when pressed again).
    b.addEventListener("click", () => {
      picked = picked === id ? null : id;
      const point = points.find((p) => p.dataset["place"] === id);
      const m = point?.transform.baseVal.consolidate()?.matrix;
      if (picked && m) zoom.focus(m.e, m.f);
      highlight();
    });
  }
  for (const p of points) {
    p.addEventListener("pointerenter", () => hover(p.dataset["place"]!));
    p.addEventListener("pointerleave", () => hover(null));
  }

  initProvinces(map);
  initTerraced(map);
}

/**
 * Terraced 3D view (owner request 2026-11-01). Its code is fetched only once its frame is on
 * screen: from 1280 px it stands beside the flat map; narrower, the 2D/3D buttons swap the two.
 */
function initTerraced(map: HTMLElement): void {
  const frame = map.querySelector<HTMLElement>("[data-map-3d]");
  const control = map.querySelector<HTMLElement>("[data-map-view]");
  if (!frame || !control || !("IntersectionObserver" in window)) return;
  frame.hidden = false;
  control.hidden = false;
  control.addEventListener("click", (e) => {
    const view = (e.target as Element).closest<HTMLButtonElement>("[data-view-btn]")?.dataset["viewBtn"];
    if (!view) return;
    map.dataset["view"] = view;
    for (const b of control.querySelectorAll<HTMLButtonElement>("[data-view-btn]")) b.setAttribute("aria-pressed", String(b.dataset["viewBtn"] === view));
  });
  // A frame that is not displayed never intersects, so a hidden 3D view costs nothing.
  const seen = new IntersectionObserver(
    (entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      seen.disconnect();
      void import("./map-3d").then((m) => m.initMap3d(map));
    },
    { rootMargin: "200px" },
  );
  seen.observe(frame);
}

/**
 * Province layer (owner request 2026-10-29): the mode buttons switch between the 63 provinces
 * before the 2025 merger and the 34 after; the province under the pointer lights up (after the
 * merger: the whole current unit) and its name shows in the frame's corner, with the former
 * provinces it took in.
 */
function initProvinces(map: HTMLElement): void {
  const group = map.querySelector<SVGGElement>("[data-map-provinces]");
  const control = map.querySelector<HTMLElement>("[data-map-era]");
  const readout = map.querySelector<HTMLElement>("[data-map-frame] [data-map-readout]");
  if (!group || !control || !readout) return;
  control.hidden = false;
  const shapes = [...group.querySelectorAll<SVGPathElement>("path")];
  const name = readout.querySelector<HTMLElement>("[data-readout-name]")!;
  const sub = readout.querySelector<HTMLElement>("[data-readout-sub]")!;
  let hot: SVGPathElement | null = null;

  const show = (): void => {
    for (const p of shapes) p.classList.remove("is-hot");
    readout.hidden = !hot;
    if (!hot) return;
    const after = map.dataset["era"] === "after";
    const lit = after ? shapes.filter((p) => p.dataset["unit"] === hot!.dataset["unit"]) : [hot];
    for (const p of lit) p.classList.add("is-hot");
    name.textContent = (after ? hot.dataset["unitName"] : hot.dataset["name"]) ?? "";
    sub.textContent = after && lit.length > 1 ? lit.map((p) => p.dataset["name"]).join(" + ") : "";
  };

  control.addEventListener("click", (e) => {
    const era = (e.target as Element).closest<HTMLButtonElement>("[data-era-btn]")?.dataset["eraBtn"];
    if (!era) return;
    map.dataset["era"] = era;
    for (const b of control.querySelectorAll<HTMLButtonElement>("[data-era-btn]")) b.setAttribute("aria-pressed", String(b.dataset["eraBtn"] === era));
    show();
  });
  group.addEventListener("pointerover", (e) => {
    hot = (e.target as Element).closest<SVGPathElement>("path[data-code]");
    show();
  });
  group.addEventListener("pointerleave", () => {
    hot = null;
    show();
  });
}
