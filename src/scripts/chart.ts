// Commitment chart readout (ROADMAP 15.2-15.3): the pointer or the arrow keys pick a period;
// the band and the readout below follow. Without JS the readout shows the latest period.
type Seg = { a: number; b: number; label: string; count: number; names: string[] };

export function initChart(): void {
  const plot = document.querySelector<HTMLElement>("[data-chart-plot]");
  if (!plot) return;
  const segs = JSON.parse(plot.dataset["segments"] ?? "[]") as Seg[];
  const months = Number(plot.dataset["months"]);
  const band = plot.querySelector<HTMLElement>("[data-chart-band]")!;
  const q = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
  const when = q("[data-chart-when]");
  const count = q("[data-chart-count]");
  const names = q("[data-chart-names]");
  const bars = q("[data-chart-bars]");
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
  const at = (clientX: number): number => {
    const r = plot.getBoundingClientRect();
    const m = Math.min(months - 1, Math.max(0, Math.floor(((clientX - r.left) / r.width) * months)));
    return segs.findIndex((s) => s.a <= m && m < s.b);
  };

  plot.addEventListener("pointermove", (e) => show(at(e.clientX)));
  plot.addEventListener("pointerdown", (e) => show(at(e.clientX)));
  plot.addEventListener("keydown", (e) => {
    const next = { ArrowLeft: index - 1, ArrowRight: index + 1, Home: 0, End: segs.length - 1 }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    show(Math.min(segs.length - 1, Math.max(0, next)));
  });
}
