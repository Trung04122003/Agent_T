// Commitment chart readout (ROADMAP 15.2-15.3) and crosshair (ROADMAP 23): the pointer, a finger
// or the arrow keys pick a month; the crosshair snaps to it, its axis readouts show the month and
// the count, and the band and the readout below follow the period. Without JS the readout shows
// the latest period and there is no crosshair.
// Performance (23.2): the plot box is measured once on entry (again after a resize), pointermove
// only records x, and one requestAnimationFrame per move applies transform and textContent; the
// drawing itself is never rebuilt.
import { crosshairAt, monthAt, monthLabel, type PlotBox } from "../lib/chart-scale";

type Seg = { a: number; b: number; label: string; count: number; names: string[] };

export function initChart(): void {
  const plot = document.querySelector<HTMLElement>("[data-chart-plot]");
  if (!plot) return;
  const segs = JSON.parse(plot.dataset["segments"] ?? "[]") as Seg[];
  const counts = JSON.parse(plot.dataset["counts"] ?? "[]") as number[];
  const months = Number(plot.dataset["months"]);
  const top = Number(plot.dataset["top"]);
  const start = plot.dataset["start"] ?? "";
  const band = plot.querySelector<HTMLElement>("[data-chart-band]")!;
  const q = <T extends Element>(sel: string) => document.querySelector<T>(sel)!;
  const when = q<HTMLElement>("[data-chart-when]");
  const count = q<HTMLElement>("[data-chart-count]");
  const names = q<HTMLElement>("[data-chart-names]");
  const bars = q<HTMLElement>("[data-chart-bars]");
  const vLine = plot.querySelector<SVGLineElement>("[data-xhair-v]")!;
  const hLine = plot.querySelector<SVGLineElement>("[data-xhair-h]")!;
  const tagX = plot.querySelector<HTMLElement>("[data-xhair-x]")!;
  const tagY = plot.querySelector<HTMLElement>("[data-xhair-y]")!;
  const tagDate = plot.querySelector<HTMLElement>("[data-xhair-date]")!;
  const tagCount = plot.querySelector<HTMLElement>("[data-xhair-count]")!;
  let index = segs.length - 1;

  const show = (i: number): void => {
    if (i === index || !segs[i]) return;
    index = i;
    const s = segs[i];
    band.style.left = `${(s.a / months) * 100}%`;
    band.style.width = `${((s.b - s.a) / months) * 100}%`;
    when.textContent = s.label;
    count.textContent = String(s.count);
    names.textContent = s.names.join(" · ");
    bars.replaceChildren(...s.names.map(() => document.createElement("i")));
  };

  // --- Crosshair ---
  let box: PlotBox | null = null;
  let tagHalf = 0;
  const measure = (): PlotBox => {
    const r = plot.getBoundingClientRect();
    tagHalf = tagX.offsetWidth / 2; // the date is fixed-width (MM/YYYY in a monospace face)
    return (box = { left: r.left, width: r.width, height: r.height });
  };
  new ResizeObserver(() => (box = null)).observe(plot);

  const place = (m: number): void => {
    const b = box ?? measure();
    const c = counts[m] ?? 0;
    const { x, y } = crosshairAt(b, months, top, m, c);
    vLine.setAttribute("transform", `translate(${m + 0.5} 0)`);
    hLine.setAttribute("transform", `translate(0 ${top - c})`);
    const tx = Math.min(Math.max(x, tagHalf), b.width - tagHalf); // never past the plot's ends
    tagX.style.transform = `translate(${tx}px, 0) translateX(-50%)`;
    tagY.style.transform = `translate(0, ${y}px) translate(calc(-100% - 4px), -50%)`;
    tagDate.textContent = monthLabel(start, m);
    tagCount.textContent = String(c);
    plot.classList.add("is-xhair");
    show(segs.findIndex((s) => s.a <= m && m < s.b));
  };
  const hide = (): void => plot.classList.remove("is-xhair");

  let x = 0;
  let frame = 0;
  const follow = (clientX: number): void => {
    x = clientX;
    if (!frame) frame = requestAnimationFrame(() => ((frame = 0), place(monthAt(box ?? measure(), months, x))));
  };

  plot.addEventListener("pointerenter", () => void measure(), { passive: true });
  plot.addEventListener("pointermove", (e) => follow(e.clientX), { passive: true });
  // A touch shows the crosshair and a horizontal drag scrubs it; touch-action: pan-y keeps the
  // vertical scroll (a vertical drag cancels the pointer instead).
  plot.addEventListener("pointerdown", (e) => (measure(), follow(e.clientX)), { passive: true });
  plot.addEventListener("pointerleave", (e) => e.pointerType === "mouse" && hide(), { passive: true });
  plot.addEventListener("focusout", hide);
  plot.addEventListener("keydown", (e) => {
    const next = { ArrowLeft: index - 1, ArrowRight: index + 1, Home: 0, End: segs.length - 1 }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    // The crosshair follows the keyboard: it sits on the first month of the chosen period.
    place(segs[Math.min(segs.length - 1, Math.max(0, next))]!.a);
  });
}
