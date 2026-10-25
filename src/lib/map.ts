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
type Point = { id: string; lat: number; lon: number };
export type MapGeometry = {
  countries: { code: string; d: string }[];
  archipelagos: Record<
    keyof typeof ARCHIPELAGOS,
    { dots: [number, number][]; label: [number, number]; anchor: "start" | "end" }
  >;
  points: { id: string; x: number; y: number; labelY: number }[];
};

const LABEL_GAP = 14;

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
    points: spreadLabels(
      points.map((p) => {
        const [x, y] = project(p.lon, p.lat);
        return { id: p.id, x, y, labelY: y + 4 };
      }),
    ),
  };
}

/** Point labels sit to the right of their dot; close neighbours (Da Nang, Dien Ban) get pushed apart. */
function spreadLabels<T extends { y: number; labelY: number }>(points: T[]): T[] {
  const byY = [...points].sort((a, b) => a.labelY - b.labelY);
  for (let i = 1; i < byY.length; i++) {
    const prev = byY[i - 1]!;
    const cur = byY[i]!;
    if (cur.labelY - prev.labelY < LABEL_GAP) cur.labelY = prev.labelY + LABEL_GAP;
  }
  return points;
}
