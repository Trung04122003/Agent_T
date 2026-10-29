// Derive the committed map data from Natural Earth (ROADMAP 6.2).
// In:  data/natural-earth/ne_10m_admin_0_countries_vnm.geojson and ne_10m_admin_1_states_provinces.geojson
//      (scripts/fetch-map-data.mjs)
// Out: src/assets/map/region.topo.json — countries around Viet Nam (country code only) and Viet Nam's
//      63 provinces before the 2025 merger (ISO 3166-2 code only), in one topology so they share
//      arcs; the 34 after the merger are unions of these (content/provinces.json), done at build.
// Usage: node scripts/build-map.mjs
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { topology } from "topojson-server";
import { presimplify, quantile, simplify } from "topojson-simplify";

const root = resolve(fileURLToPath(import.meta.url), "..", "..");
const source = join(root, "data", "natural-earth", "ne_10m_admin_0_countries_vnm.geojson");
const admin1 = join(root, "data", "natural-earth", "ne_10m_admin_1_states_provinces.geojson");
const out = join(root, "src", "assets", "map", "region.topo.json");

// Generous frame around Viet Nam, Hoang Sa and Truong Sa (lon/lat); the page clips to its view.
const REGION = { west: 96, south: 2, east: 124, north: 28 };

function bbox(geometry) {
  let [w, s, e, n] = [Infinity, Infinity, -Infinity, -Infinity];
  const walk = (c) => {
    if (typeof c[0] === "number") {
      w = Math.min(w, c[0]);
      e = Math.max(e, c[0]);
      s = Math.min(s, c[1]);
      n = Math.max(n, c[1]);
    } else c.forEach(walk);
  };
  walk(geometry.coordinates);
  return { w, s, e, n };
}

const all = JSON.parse(readFileSync(source, "utf8"));
const features = all.features
  .filter((f) => {
    const b = bbox(f.geometry);
    // Skip features spanning the antimeridian (their box covers the globe but no land is here).
    if (b.e - b.w > 180) return false;
    return b.e >= REGION.west && b.w <= REGION.east && b.n >= REGION.south && b.s <= REGION.north;
  })
  // Keep only the country code: no names, so the map can never label a neighbour.
  .map((f) => ({ type: "Feature", properties: { code: f.properties.ADM0_A3 }, geometry: f.geometry }));

// Mainland provinces only: admin-1 is drawn from the default point of view (it files Hoang Sa and
// Truong Sa under other countries), so the islands keep coming from the Viet Nam feature above.
const provinces = JSON.parse(readFileSync(admin1, "utf8"))
  .features.filter((f) => f.properties.adm0_a3 === "VNM")
  .map((f) => ({ type: "Feature", properties: { code: f.properties.iso_3166_2 }, geometry: f.geometry }));
if (provinces.length !== 63) throw new Error(`build-map: expected 63 provinces, found ${provinces.length}`);

let topo = topology(
  { countries: { type: "FeatureCollection", features }, provinces: { type: "FeatureCollection", features: provinces } },
  1e5,
);
topo = presimplify(topo);
// Drop the least significant points; small islands keep their ring (at least a few points).
topo = simplify(topo, quantile(topo, 0.08));

mkdirSync(join(root, "src", "assets", "map"), { recursive: true });
const json = JSON.stringify(topo);
writeFileSync(out, json);
console.log(`wrote src/assets/map/region.topo.json: ${features.length} countries (${features.map((f) => f.properties.code).join(", ")}), ${provinces.length} provinces, ${json.length} bytes`);
