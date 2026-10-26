// Map interaction: zoom (buttons), pan (drag while zoomed), and the link between the legend and
// the points. Zoom works on the SVG viewBox, so the drawing stays sharp; --k lets the CSS keep
// marks and labels at their screen size. Steps are instant: no animation to budget or reduce.
export const ZOOM = { step: 1.5, max: 4, place: 2.25 } as const;

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
}
