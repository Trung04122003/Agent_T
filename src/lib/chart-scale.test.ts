import { describe, expect, it } from "vitest";
import { crosshairAt, monthAt, monthLabel } from "./chart-scale";
import { chartEntries, concurrency } from "./commitments";
import { claim, type Claim } from "./schema";

// ROADMAP 23.2 / 23.4: the crosshair's x -> month mapping, its labels and its count.
const box = { left: 100, width: 600, height: 200 }; // 12 months: 50 px each

describe("23.2 monthAt", () => {
  it("maps x to the month under it, both edges included", () => {
    expect(monthAt(box, 12, 100)).toBe(0);
    expect(monthAt(box, 12, 149.9)).toBe(0);
    expect(monthAt(box, 12, 150)).toBe(1);
    expect(monthAt(box, 12, 699.9)).toBe(11);
  });
  it("clamps outside the plot (a pointer on the axis or past the end)", () => {
    expect(monthAt(box, 12, 0)).toBe(0);
    expect(monthAt(box, 12, 10_000)).toBe(11);
  });
  it("is safe with nothing to map", () => {
    expect(monthAt(box, 0, 300)).toBe(0);
    expect(monthAt({ ...box, width: 0 }, 12, 300)).toBe(0);
  });
});

describe("23.2 monthLabel", () => {
  it("counts months from the start, across years", () => {
    expect(monthLabel("2021-09", 0)).toBe("09/2021");
    expect(monthLabel("2021-09", 3)).toBe("12/2021");
    expect(monthLabel("2021-09", 4)).toBe("01/2022");
    expect(monthLabel("2021-09", 61)).toBe("10/2026");
  });
});

describe("23.1 crosshairAt", () => {
  it("snaps to the month's centre and to the count's height", () => {
    expect(crosshairAt(box, 12, 3.5, 0, 0)).toEqual({ x: 25, y: 200 });
    expect(crosshairAt(box, 12, 3.5, 11, 3.5)).toEqual({ x: 575, y: 0 });
  });
});

describe("23.4 a paused entry is not counted under the crosshair", () => {
  const entry = (id: string, paused?: true): Claim =>
    claim.parse({
      id,
      kind: "role",
      visibility: "open",
      status: "confirmed",
      org: { vi: id, en: id },
      title: null,
      period: { start: "2025-06", end: null, ongoing: true },
      teaser: null,
      summary: null,
      evidence: [],
      ...(paused ? { paused } : {}),
    });
  it("the counts the crosshair reads hold the running entry only", () => {
    const spans = chartEntries([entry("running"), entry("on-hold", true)]).map((c) => ({ id: c.id, ...c.period! }));
    const data = concurrency(spans, new Date("2025-08-15T00:00:00Z"));
    expect(data.counts).toEqual([1, 1, 1]);
    expect(data.segments.flatMap((s) => s.ids)).not.toContain("on-hold");
  });
});
