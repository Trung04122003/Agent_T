import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import fixture from "../../e2e/fixtures/claims.json";
import { traceMetrics } from "./metrics";
import { claims as claimsSchema, metric } from "./schema";

// ROADMAP 20.3: owner figures, each traced to an open entry; Claude Code never fills them in.
const claims = claimsSchema.parse(fixture);
const L = (vi: string, en: string) => ({ vi, en });

describe("20.3 metrics", () => {
  it("the real content/metrics.json holds only what the owner wrote (empty for now)", () => {
    expect(JSON.parse(readFileSync("content/metrics.json", "utf8"))).toEqual([]);
  });

  it("a figure carries the file code of its source entry", () => {
    const [m] = traceMetrics([{ id: "m1", source: "fx-pending" }], claims);
    expect(m).toMatchObject({ id: "m1", code: "02" });
  });

  it("a figure whose source is hold, classified or unknown fails", () => {
    for (const source of ["fx-hold", "fx-classified", "nope"]) {
      expect(() => traceMetrics([{ id: "m", source }], claims), source).toThrow(/not an open entry/);
    }
  });

  it("schema: label and unit in both languages, value a number, unit may be null", () => {
    const ok = { id: "m", label: L("Nhãn", "Label"), value: 3, unit: null, source: "fx-pending" };
    expect(metric.safeParse(ok).success).toBe(true);
    expect(metric.safeParse({ ...ok, value: "3" }).success).toBe(false);
    expect(metric.safeParse({ ...ok, label: { vi: "Nhãn" } }).success).toBe(false);
  });
});
