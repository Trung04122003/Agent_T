import { describe, expect, it } from "vitest";
import { usePhotos } from "./portrait";

const alt = { mat: { vi: "a", en: "a" }, giaiMat: { vi: "b", en: "b" } };

describe("usePhotos", () => {
  it("uses the placeholder when no photo is given", () => {
    expect(usePhotos(undefined, undefined, undefined)).toBe(false);
  });

  it("uses photos when both images and all four alts exist", () => {
    expect(usePhotos({}, {}, alt)).toBe(true);
  });

  it("rejects a single image", () => {
    expect(() => usePhotos({}, undefined, alt)).toThrow();
    expect(() => usePhotos(undefined, {}, alt)).toThrow();
  });

  it("rejects missing or blank alt text in either language", () => {
    expect(() => usePhotos({}, {}, undefined)).toThrow();
    expect(() => usePhotos({}, {}, { ...alt, mat: { vi: "a", en: " " } })).toThrow();
    expect(() => usePhotos({}, {}, { ...alt, giaiMat: { vi: "", en: "b" } })).toThrow();
  });
});
