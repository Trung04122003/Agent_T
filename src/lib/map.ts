// Build-time map geometry (SPEC section 8): Natural Earth (Viet Nam point of view) projected with
// d3-geo into SVG path strings. Runs during the build only; the page ships plain SVG.
import { geoCentroid, geoMercator, geoPath } from "d3-geo";
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from "geojson";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";

export const VIEW = { width: 600, height: 780 };
/** Visible area (lon/lat): mainland Viet Nam, Hoang Sa and Truong Sa. */
const FRAME = { west: 101.2, east: 119, south: 5.6, north: 23.8 };
/**
 * Archipelago extents used to find their islands in the Viet Nam feature. Truong Sa follows the
 * extent on vi.wikipedia.org (6°12'–12°00' N, 111°30'–117°20' E); Hoang Sa is centred on
 * 16°30' N 112°00' E (same source), checked 2026-10-25.
 */
const ARCHIPELAGOS = {
  hoangSa: { west: 111, east: 113.2, south: 15.4, north: 17.4 },
  truongSa: { west: 111.5, east: 117.4, south: 6.2, north: 12 },
} as const;

type Box = { west: number; east: number; south: number; north: number };
/** `text` is the label as shown (it sets the label's width for the placement). */
type Point = { id: string; lat: number; lon: number; text: string };
/** Where a point's label goes, relative to its dot (SVG units, text anchor). */
export type LabelSpot = { dx: number; dy: number; anchor: "start" | "end" };
export type MapGeometry = {
  countries: { code: string; d: string }[];
  archipelagos: Record<
    keyof typeof ARCHIPELAGOS,
    { dots: [number, number][]; label: [number, number]; anchor: "start" | "end" }
  >;
  points: { id: string; x: number; y: number; label: LabelSpot }[];
};

/** Label metrics at the map's 11px monospace: about 0.6em per character. */
export const LABEL = { size: 11, char: 6.6, dot: 7, pad: 2 } as const;

const inside = ([lon, lat]: [number, number], b: Box) => lon >= b.west && lon <= b.east && lat >= b.south && lat <= b.north;
const round = (n: number) => Math.round(n * 10) / 10;

export function buildMap(topo: Topology, points: Point[]): MapGeometry {
  const object = topo.objects["countries"] as GeometryCollection<{ code: string }>;
  const countries = feature(topo, object) as FeatureCollection<Polygon | MultiPolygon, { code: string }>;

  const frame: Feature<Polygon> = {
    type: "Feature",
    properties: {},
    geometry: {
      type: "Polygon",
      // Clockwise: d3-geo reads a counter-clockwise ring as "the whole globe except this box".
      coordinates: [
        [
          [FRAME.west, FRAME.south],
          [FRAME.west, FRAME.north],
          [FRAME.east, FRAME.north],
          [FRAME.east, FRAME.south],
          [FRAME.west, FRAME.south],
        ],
      ],
    },
  };
  const projection = geoMercator().fitSize([VIEW.width, VIEW.height], frame);
  projection.clipExtent([
    [-2, -2],
    [VIEW.width + 2, VIEW.height + 2],
  ]);
  const path = geoPath(projection).digits(1);
  const project = (lon: number, lat: number) => projection([lon, lat])!.map(round) as [number, number];

  // Islands: every polygon of the Viet Nam feature whose centre lies in an archipelago extent.
  const vn = countries.features.find((f) => f.properties.code === "VNM");
  if (!vn) throw new Error("map: Viet Nam feature missing from region.topo.json");
  const polygons = vn.geometry.type === "MultiPolygon" ? vn.geometry.coordinates : [vn.geometry.coordinates];
  const centres = polygons.map((rings) => geoCentroid({ type: "Polygon", coordinates: rings }) as [number, number]);

  // Labels sit just above each group, over open sea: Hoang Sa starts at its western edge; Truong
  // Sa ends at its eastern edge (its islands are near the right of the frame).
  const archipelago = (box: Box, anchor: "start" | "end") => {
    const dots = centres.filter((c) => inside(c, box)).map(([lon, lat]) => project(lon, lat));
    if (dots.length === 0) throw new Error("map: no island found in an archipelago extent");
    const xs = dots.map((d) => d[0]);
    const ys = dots.map((d) => d[1]);
    const label: [number, number] = [anchor === "start" ? Math.min(...xs) : Math.max(...xs), Math.min(...ys) - 12];
    return { dots, label, anchor };
  };

  return {
    countries: countries.features
      .map((f) => ({ code: f.properties.code, d: path(f) ?? "" }))
      .filter((c) => c.d !== ""),
    archipelagos: {
      hoangSa: archipelago(ARCHIPELAGOS.hoangSa, "start"),
      truongSa: archipelago(ARCHIPELAGOS.truongSa, "end"),
    },
    points: placeLabels(
      points.map((p) => {
        const [x, y] = project(p.lon, p.lat);
        return { id: p.id, x, y, text: p.text };
      }),
    ),
  };
}

export type Rect = { x0: number; y0: number; x1: number; y1: number };
const overlaps = (a: Rect, b: Rect) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

/** The box a label covers at a given spot (baseline at dy; ascent ~0.8em, descent ~0.3em). */
export function labelRect(p: { x: number; y: number; text: string }, s: LabelSpot): Rect {
  const w = [...p.text].length * LABEL.char + LABEL.pad * 2;
  const x0 = s.anchor === "start" ? p.x + s.dx - LABEL.pad : p.x + s.dx - w + LABEL.pad;
  const base = p.y + s.dy;
  return { x0, y0: base - LABEL.size * 0.8 - LABEL.pad, x1: x0 + w, y1: base + LABEL.size * 0.3 + LABEL.pad };
}

/** Tried in order: right, left, then below and above on either side. */
const SPOTS: LabelSpot[] = [
  { dx: 11, dy: 4, anchor: "start" },
  { dx: -11, dy: 4, anchor: "end" },
  { dx: 9, dy: 17, anchor: "start" },
  { dx: -9, dy: 17, anchor: "end" },
  { dx: 9, dy: -10, anchor: "start" },
  { dx: -9, dy: -10, anchor: "end" },
];

/**
 * ROADMAP 20.4: give every point label a spot that covers no other label and no other dot
 * (Da Nang / Dien Ban, Thai Nguyen / Thuong Tin are close). First free spot wins; if none is free,
 * the spot with the least overlap is kept.
 */
function placeLabels(points: { id: string; x: number; y: number; text: string }[]) {
  const dots: Rect[] = points.map((p) => ({ x0: p.x - LABEL.dot, y0: p.y - LABEL.dot, x1: p.x + LABEL.dot, y1: p.y + LABEL.dot }));
  const taken: Rect[] = [];
  return points.map((p, i) => {
    const others = dots.filter((_, j) => j !== i);
    const cost = (s: LabelSpot) => {
      const r = labelRect(p, s);
      return [...taken, ...others].filter((o) => overlaps(r, o)).length;
    };
    const label = SPOTS.find((s) => cost(s) === 0) ?? [...SPOTS].sort((a, b) => cost(a) - cost(b))[0]!;
    taken.push(labelRect(p, label));
    return { id: p.id, x: p.x, y: p.y, label };
  });
}
