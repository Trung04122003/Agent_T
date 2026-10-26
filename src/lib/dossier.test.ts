import { describe, expect, it } from "vitest";
import { dtg, fileNumber, pageOf, PAGES } from "./dossier";

const built = new Date("2026-10-26T19:22:41Z");

describe("fileNumber", () => {
  it("is the codename in capitals plus build yymm", () => {
    expect(fileNumber("Cupid", built)).toBe("CUPID-2610");
  });
  it("drops diacritics, spaces and other scripts", () => {
    expect(fileNumber("Mũi Tên Vàng", built)).toBe("MUITENVANG-2610");
    expect(fileNumber("武蔵", built)).toBe("FILE-2610");
  });
});

describe("dtg", () => {
  it("formats the build time as a UTC date-time group", () => {
    expect(dtg(built)).toBe("261922Z OCT 26");
    expect(dtg(new Date("2027-01-05T03:04:00Z"))).toBe("050304Z JAN 27");
  });
  it("never looks like a dd/mm/yyyy date (check-leaks rule)", () => {
    expect(dtg(new Date())).toMatch(/^\d{6}Z [A-Z]{3} \d{2}$/);
  });
});

describe("pages", () => {
  it("numbers the sections in reading order", () => {
    expect(PAGES.map((p) => pageOf(p))).toEqual([
      { n: 1, of: 3 },
      { n: 2, of: 3 },
      { n: 3, of: 3 },
    ]);
  });
});
