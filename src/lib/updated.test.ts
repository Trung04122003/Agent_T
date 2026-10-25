import { describe, expect, it } from "vitest";
import { updatedStamp } from "./updated";

describe("updatedStamp", () => {
  it("formats month/year", () => {
    expect(updatedStamp(new Date("2026-10-15T05:00:00Z"))).toEqual({ text: "10/2026", iso: "2026-10" });
  });

  it("uses Viet Nam time at month and year boundaries", () => {
    // 31 Oct 20:00 UTC is already 1 Nov 03:00 in Ho Chi Minh City.
    expect(updatedStamp(new Date("2026-10-31T20:00:00Z")).text).toBe("11/2026");
    expect(updatedStamp(new Date("2026-12-31T18:00:00Z")).text).toBe("01/2027");
  });

  it("never produces a full dd/mm/yyyy date (check-leaks rule)", () => {
    expect(updatedStamp(new Date()).text).toMatch(/^\d{2}\/\d{4}$/);
  });
});
