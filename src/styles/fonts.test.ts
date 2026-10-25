import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

// SPEC section 7 test string.
const SAMPLE = "Lê Thái Trung — Ắ Ằ Ẳ Ẵ Ặ Ế Ề Ể Ễ Ệ Ố Ồ Ổ Ỗ Ộ Ớ Ờ Ở Ỡ Ợ Ứ Ừ Ử Ữ Ự";
const require = createRequire(import.meta.url);

function ranges(specifier: string): [number, number][] {
  const body = readFileSync(require.resolve(specifier), "utf8");
  return [...body.matchAll(/unicode-range:\s*([^;]+);/g)].flatMap((m) =>
    m[1]!.split(",").map((r) => {
      const [a, b = a] = r.trim().replace(/^U\+/i, "").split("-");
      return [parseInt(a!, 16), parseInt(b!, 16)] as [number, number];
    }),
  );
}

const fontsCss = readFileSync(new URL("./fonts.css", import.meta.url), "utf8");
const imports = [...fontsCss.matchAll(/@import\s+"([^"]+)"/g)].map((m) => m[1]!);
const chars = [...new Set(SAMPLE.normalize("NFC").replace(/\s/g, ""))];

describe("fonts", () => {
  it("imports at least one and at most 2 families", () => {
    expect(imports.length).toBeGreaterThan(0);
    expect(new Set(imports.map((i) => i.split("/")[1])).size).toBeLessThanOrEqual(2);
  });

  it.each(imports)("%s covers every character of the Vietnamese test string", (file) => {
    const r = ranges(file);
    expect(r.length).toBeGreaterThan(0);
    const missing = chars.filter((ch) => !r.some(([a, b]) => ch.codePointAt(0)! >= a && ch.codePointAt(0)! <= b));
    expect(missing).toEqual([]);
  });
});
