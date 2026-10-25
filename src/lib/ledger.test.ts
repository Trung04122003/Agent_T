import { describe, expect, it } from "vitest";
import { fileCode, formatPeriod, inFileOrder } from "./ledger";
import { redactionBars } from "./redaction";

describe("ledger formatting", () => {
  it("numbers rows 01, 02 ... 10", () => {
    expect([0, 1, 9].map(fileCode)).toEqual(["01", "02", "10"]);
  });

  it("formats periods as MM/YYYY or YYYY, never a full date", () => {
    expect(formatPeriod({ start: "2024-02", end: "2024-06" }, "nay")).toBe("02/2024 – 06/2024");
    expect(formatPeriod({ start: "2021", end: "present" }, "nay")).toBe("2021 – nay");
    expect(formatPeriod({ start: "2019", end: null }, "nay")).toBe("2019");
  });
});

describe("inFileOrder", () => {
  it("restores the order of claims.json", () => {
    const items = [{ id: "c" }, { id: "a" }, { id: "b" }];
    expect(inFileOrder(items, ["a", "b", "c"]).map((i) => i.id)).toEqual(["a", "b", "c"]);
  });
});

describe("redactionBars", () => {
  it("is stable for the same seed and key", () => {
    expect(redactionBars("a", "seed")).toEqual(redactionBars("a", "seed"));
  });

  it("changes between builds (seeds) and between entries", () => {
    const keys = Array.from({ length: 20 }, (_, i) => `k${i}`);
    const a = keys.map((k) => redactionBars(k, "build-1").join());
    const b = keys.map((k) => redactionBars(k, "build-2").join());
    expect(a).not.toEqual(b);
    expect(new Set(a).size).toBeGreaterThan(10);
  });

  it("gives 2-4 bars of 35-100 % regardless of key length", () => {
    for (const key of ["x", "x".repeat(5000)]) {
      const bars = redactionBars(key, "s");
      expect(bars.length).toBeGreaterThanOrEqual(2);
      expect(bars.length).toBeLessThanOrEqual(4);
      for (const w of bars) expect(w >= 35 && w <= 100).toBe(true);
    }
  });
});
