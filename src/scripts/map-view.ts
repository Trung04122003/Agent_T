// Map interaction: zoom (buttons, mouse wheel), pan (drag while zoomed), and the link between the legend and
// the points. Zoom works on the SVG viewBox, so the drawing stays sharp; --k lets the CSS keep
// marks and labels at their screen size. Steps are instant: no animation to budget or reduce.
export const ZOOM = { step: 1.5, max: 4, place: 2.25, wheel: 0.002 } as const;

export function initMapView(): void {
  const map = document.querySelector<HTMLElement>("[data-map]");
  const svg = map?.querySelector<SVGSVGElement>("[data-map-svg]");
  const controls = map?.querySelector<HTMLElement>("[data-map-zoom]");
  if (!map || !svg || !controls) return;
  controls.hidden = false;

  const { width: W, height: H } = svg.viewBox.baseVal;
  const view = { k: 1, cx: W / 2, cy: H / 2 };
  const button = (name: string) => controls.querySelector<HTMLButtonElement>(`[data-zoom="${name}"]`)!;
  const points = [...map.querySelectorAll<SVGGElement>("[data-place]")];
  const items = [...map.querySelectorAll<HTMLButtonElement>("[data-place-btn]")];

  const render = (): void => {
    view.k = Math.min(ZOOM.max, Math.max(1, view.k));
    const w = W / view.k;
    const h = H / view.k;
    view.cx = Math.min(W - w / 2, Math.max(w / 2, view.cx));
    view.cy = Math.min(H - h / 2, Math.max(h / 2, view.cy));
    svg.setAttribute("viewBox", `${view.cx - w / 2} ${view.cy - h / 2} ${w} ${h}`);
    svg.style.setProperty("--k", String(view.k));
    map.classList.toggle("is-zoomed", view.k > 1);
    button("in").disabled = view.k >= ZOOM.max;
    button("out").disabled = view.k <= 1;
    button("reset").disabled = view.k <= 1;
  };

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

  controls.addEventListener("click", (e) => {
    const name = (e.target as Element).closest<HTMLButtonElement>("[data-zoom]")?.dataset["zoom"];
    if (name === "in") view.k *= ZOOM.step;
    if (name === "out") view.k /= ZOOM.step;
    if (name === "reset") {
      Object.assign(view, { k: 1, cx: W / 2, cy: H / 2 });
      picked = null;
      highlight();
    }
    render();
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
      if (picked && point) {
        const m = point.transform.baseVal.consolidate()?.matrix;
        if (m) Object.assign(view, { k: Math.max(view.k, ZOOM.place), cx: m.e, cy: m.f });
      }
      highlight();
      render();
    });
  }
  for (const p of points) {
    p.addEventListener("pointerenter", () => hover(p.dataset["place"]!));
    p.addEventListener("pointerleave", () => hover(null));
  }

  // Wheel (and trackpad pinch): zoom around the pointer. At a limit (full view and scrolling down,
  // or 4x and scrolling up) the event is left alone, so the page keeps scrolling past the map.
  svg.addEventListener(
    "wheel",
    (e) => {
      const lines = e.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16 : 1;
      const next = Math.min(ZOOM.max, Math.max(1, view.k * Math.exp(-e.deltaY * lines * ZOOM.wheel)));
      if (next === view.k) return;
      e.preventDefault();
      const rect = svg.getBoundingClientRect();
      const fx = (e.clientX - rect.left) / rect.width;
      const fy = (e.clientY - rect.top) / rect.height;
      // The map point under the pointer stays under the pointer.
      const px = view.cx + (fx - 0.5) * (W / view.k);
      const py = view.cy + (fy - 0.5) * (H / view.k);
      view.k = next;
      view.cx = px - (fx - 0.5) * (W / next);
      view.cy = py - (fy - 0.5) * (H / next);
      render();
    },
    { passive: false },
  );

  // Pan: drag while zoomed (at full view the page keeps its normal scroll and touch behaviour).
  let drag: { x: number; y: number; cx: number; cy: number } | null = null;
  svg.addEventListener("pointerdown", (e) => {
    if (view.k <= 1) return;
    drag = { x: e.clientX, y: e.clientY, cx: view.cx, cy: view.cy };
    svg.setPointerCapture(e.pointerId);
    map.classList.add("is-dragging");
  });
  svg.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const scale = W / view.k / svg.getBoundingClientRect().width;
    view.cx = drag.cx - (e.clientX - drag.x) * scale;
    view.cy = drag.cy - (e.clientY - drag.y) * scale;
    render();
  });
  const end = (): void => {
    drag = null;
    map.classList.remove("is-dragging");
  };
  svg.addEventListener("pointerup", end);
  svg.addEventListener("pointercancel", end);

  render();
  initProvinces(map);
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
  const readout = map.querySelector<HTMLElement>("[data-map-readout]");
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
