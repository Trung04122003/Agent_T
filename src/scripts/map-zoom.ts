// Zoom and pan for a map drawing (the flat map, and the terraced 3D view since 2026-11-01): buttons,
// mouse wheel, drag while zoomed. Zoom works on the SVG viewBox, so the drawing stays sharp; --k
// lets the CSS keep marks and labels at their screen size. Steps are instant: no animation to budget
// or reduce.
export const ZOOM = { step: 1.5, max: 4, place: 2.25, wheel: 0.002 } as const;

export type Zoom = {
  /** Zoom in on a point of the drawing (user units), at least to `k`. */
  focus: (x: number, y: number, k?: number) => void;
};

/** `onReset` runs when the reset button is pressed (the flat map also releases its picked place). */
export function zoomable(svg: SVGSVGElement, controls: HTMLElement, onReset?: () => void): Zoom {
  controls.hidden = false;
  const { x: X, y: Y, width: W, height: H } = svg.viewBox.baseVal;
  const view = { k: 1, cx: X + W / 2, cy: Y + H / 2 };
  const button = (name: string) => controls.querySelector<HTMLButtonElement>(`[data-zoom="${name}"]`)!;

  const render = (): void => {
    view.k = Math.min(ZOOM.max, Math.max(1, view.k));
    const w = W / view.k;
    const h = H / view.k;
    view.cx = Math.min(X + W - w / 2, Math.max(X + w / 2, view.cx));
    view.cy = Math.min(Y + H - h / 2, Math.max(Y + h / 2, view.cy));
    svg.setAttribute("viewBox", `${view.cx - w / 2} ${view.cy - h / 2} ${w} ${h}`);
    svg.style.setProperty("--k", String(view.k));
    svg.classList.toggle("is-zoomed", view.k > 1);
    button("in").disabled = view.k >= ZOOM.max;
    button("out").disabled = view.k <= 1;
    button("reset").disabled = view.k <= 1;
  };

  controls.addEventListener("click", (e) => {
    const name = (e.target as Element).closest<HTMLButtonElement>("[data-zoom]")?.dataset["zoom"];
    if (name === "in") view.k *= ZOOM.step;
    if (name === "out") view.k /= ZOOM.step;
    if (name === "reset") {
      Object.assign(view, { k: 1, cx: X + W / 2, cy: Y + H / 2 });
      onReset?.();
    }
    render();
  });

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
    svg.classList.add("is-dragging");
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
    svg.classList.remove("is-dragging");
  };
  svg.addEventListener("pointerup", end);
  svg.addEventListener("pointercancel", end);

  render();
  return {
    focus: (x, y, k = ZOOM.place) => {
      Object.assign(view, { k: Math.max(view.k, k), cx: x, cy: y });
      render();
    },
  };
}
