import { describe, expect, it } from "vitest";
import { concurrency } from "./commitments";

// ROADMAP 15.1: fixed data, independent of content/.
const built = new Date("2024-06-15T00:00:00Z"); // build month 2024-06

describe("concurrency", () => {
  const result = concurrency(
    [
      { id: "a", start: "2024-01", end: "2024-03" },
      { id: "b", start: "2024-03", end: "2024-04" },
      { id: "c", start: "2024-05", end: null, ongoing: true },
    ],
    built,
  );

  it("counts every month from the first start to the build month, end months included", () => {
    expect(result.months).toEqual(["2024-01", "2024-02", "2024-03", "2024-04", "2024-05", "2024-06"]);
    expect(result.counts).toEqual([1, 1, 2, 1, 1, 1]);
    expect(result.max).toBe(2);
  });

  it("groups runs of months with the same entries", () => {
    expect(result.segments).toEqual([
      { from: "2024-01", to: "2024-02", count: 1, ids: ["a"] },
      { from: "2024-03", to: "2024-03", count: 2, ids: ["a", "b"] },
      { from: "2024-04", to: "2024-04", count: 1, ids: ["b"] },
      { from: "2024-05", to: "2024-06", count: 1, ids: ["c"] },
    ]);
  });

  it("shows gaps as zero", () => {
    const gap = concurrency(
      [
        { id: "a", start: "2024-01", end: "2024-01" },
        { id: "b", start: "2024-03", end: "2024-03" },
      ],
      new Date("2024-03-01T00:00:00Z"),
    );
    expect(gap.counts).toEqual([1, 0, 1]);
    expect(gap.segments[1]).toEqual({ from: "2024-02", to: "2024-02", count: 0, ids: [] });
  });

  it("leaves out what it cannot place in time, never guesses", () => {
    const r = concurrency(
      [
        { id: "year-only", start: "2023", end: "2024-01" },
        { id: "no-end", start: "2024-02", end: null },
        { id: "reversed", start: "2024-05", end: "2024-01" },
      ],
      built,
    );
    expect(r).toEqual({ months: [], counts: [], segments: [], max: 0 });
  });
});
