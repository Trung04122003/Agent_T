import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Topology } from "topojson-specification";
import { buildMap, VIEW } from "../lib/map";
import { atlasFrom, SOVEREIGN, type Atlas } from "./atlas";

// ROADMAP-v4 P39: the Atlas's export, built the way src/city/atlas.json.ts builds it, from the 2D
// map's own inputs (no claims, no ledger data: places, provinces, countries, the map's strings).
const read = (f: string) => JSON.parse(readFileSync(f, "utf8"));
const topo = read("src/assets/map/region.topo.json") as Topology;
const placesFile = read("content/places.json") as { id: string; role: string; label: { vi: string; en: string }; approx: { lat: number; lon: number } }[];
const admin = read("content/provinces.json");
const neighbours = read("content/countries.json").labels as { code: string; vi: string; en: string; lon: number; lat: number }[];
const ui = read("content/ui.json") as Record<string, { vi: string; en: string }>;

const map = buildMap(
  topo,
  placesFile.map((p) => ({ id: p.id, lat: p.approx.lat, lon: p.approx.lon, text: p.label.vi })),
  admin,
  neighbours,
);
const labels = { hoangSa: ui["hoangSaLabel"], truongSa: ui["truongSaLabel"] };
const build = (l: Parameters<typeof atlasFrom>[2] = labels): Atlas =>
  atlasFrom(map, [VIEW.width, VIEW.height], l, neighbours, placesFile.map((p) => ({ id: p.id, role: p.role, label: p.label })));
// Built lazily, so a missing or wrong label fails the sovereignty test by name (not the file's load).
let built: Atlas | null = null;
const atlasOf = (): Atlas => (built ??= build());

describe("sovereignty (39.2)", () => {
  it("Hoang Sa and Truong Sa carry the 2D map's own labels, in vi and en, both saying (Viet Nam)", () => {
    for (const key of ["hoangSa", "truongSa"] as const) {
      const source = labels[key]!;
      expect(atlasOf().archipelagos[key].text).toEqual({ vi: source.vi, en: source.en });
      expect(atlasOf().archipelagos[key].text.vi).toContain(SOVEREIGN.vi);
      expect(atlasOf().archipelagos[key].text.en).toContain(SOVEREIGN.en);
      expect(atlasOf().archipelagos[key].dots.length).toBeGreaterThan(0);
    }
  });

  it("the export fails (and so the build) when either label is missing or drops (Viet Nam)", () => {
    expect(() => build({ ...labels, hoangSa: undefined })).toThrow(/hoangSa label \(vi\) is missing/);
    expect(() => build({ ...labels, truongSa: { vi: ui["truongSaLabel"]!.vi } })).toThrow(/truongSa label \(en\) is missing/);
    expect(() => build({ ...labels, truongSa: { ...ui["truongSaLabel"]!, en: "Truong Sa Archipelago" } })).toThrow(/must say "\(Viet Nam\)"/);
    expect(() => build({ ...labels, hoangSa: { ...ui["hoangSaLabel"]!, vi: "Quần đảo Hoàng Sa" } })).toThrow(/must say "\(Việt Nam\)"/);
  });
});

/** Every x, y vertex of an SVG path string (d3-geo's M/L/Z output). */
const vertices = (d: string): string[] => [...d.matchAll(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g)].map((m) => `${Number(m[1])},${Number(m[2])}`);

describe("no lines in the sea (39.3)", () => {
  it("the only line paths are land borders, and each of their vertices lies on a land shape's outline", () => {
    const land = new Set([...atlasOf().provinces, ...atlasOf().countries].flatMap((s) => vertices(s.d)));
    for (const [name, d] of [["frontiers", atlasOf().frontiers], ["borders.kept", atlasOf().borders.kept], ["borders.merged", atlasOf().borders.merged]] as const) {
      const v = vertices(d);
      expect(v.length, name).toBeGreaterThan(0);
      const off = v.filter((p) => !land.has(p));
      expect(off, `${name}: vertices off any land shape`).toEqual([]);
    }
  });

  it("the check itself catches a line drawn at sea", () => {
    const land = new Set([...atlasOf().provinces, ...atlasOf().countries].flatMap((s) => vertices(s.d)));
    const [hx, hy] = atlasOf().archipelagos.hoangSa.label;
    const [tx, ty] = atlasOf().archipelagos.truongSa.label;
    expect(vertices(`M${hx},${hy}L${tx},${ty}`).filter((p) => !land.has(p)).length).toBe(2);
  });

  it("the archipelagos are islands and a label, never a line or a shape around them", () => {
    for (const a of Object.values(atlasOf().archipelagos)) {
      expect(Object.keys(a).sort()).toEqual(["anchor", "dots", "label", "text"]);
    }
    // No other path-like field than the shapes and land borders checked above.
    expect(Object.keys(atlasOf()).sort()).toEqual(["archipelagos", "borders", "capital", "countries", "countryLabels", "focus", "frontiers", "places", "provinces", "view"]);
  });
});

describe("places and privacy (39.4)", () => {
  it("only the places of content/places.json, in its order, with their public label and role only", () => {
    expect(atlasOf().places.map((p) => p.id)).toEqual(placesFile.map((p) => p.id));
    for (const p of atlasOf().places) expect(Object.keys(p).sort()).toEqual(["id", "label", "role", "x", "y"]);
    const json = JSON.stringify(atlasOf());
    expect(json).not.toMatch(/"(notes|approx|lat|lon|region)"/);
  });

  it("neighbour names are content/countries.json's", () => {
    expect(atlasOf().countryLabels.map((c) => [c.code, c.name])).toEqual(neighbours.map((n) => [n.code, { vi: n.vi, en: n.en }]));
  });
});
