// Crosshair maths for the commitment chart (ROADMAP 23.2). Pure, so it is unit-tested and shared
// with src/scripts/chart.ts. The plot box is measured once (on pointer entry, again on resize) and
// passed in: nothing here reads layout.

export type PlotBox = { left: number; width: number; height: number };

/** Index of the month under a viewport x, clamped to the chart (0 when there is nothing to map). */
export function monthAt(box: PlotBox, months: number, clientX: number): number {
  if (months <= 0 || box.width <= 0) return 0;
  return Math.min(months - 1, Math.max(0, Math.floor(((clientX - box.left) / box.width) * months)));
}

/** "MM/YYYY" of the month `i` months after `start` ("YYYY-MM"), the chart's own date format. */
export function monthLabel(start: string, i: number): string {
  const k = Number(start.slice(0, 4)) * 12 + Number(start.slice(5, 7)) - 1 + i;
  return `${String((k % 12) + 1).padStart(2, "0")}/${Math.floor(k / 12)}`;
}

/** Where the crosshair sits for month `i`, in plot pixels: the month's centre, the count's height. */
export function crosshairAt(box: PlotBox, months: number, top: number, i: number, count: number): { x: number; y: number } {
  return { x: ((i + 0.5) / months) * box.width, y: ((top - count) / top) * box.height };
}
