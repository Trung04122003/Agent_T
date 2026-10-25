// Derive the committed map data from Natural Earth (ROADMAP 6.2).
// In:  data/natural-earth/ne_10m_admin_0_countries_vnm.geojson (scripts/fetch-map-data.mjs)
// Out: src/assets/map/region.topo.json — countries around Viet Nam, country code only, simplified.
// Usage: node scripts/build-map.mjs
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { topology } from "topojson-server";
import { presimplify, quantile, simplify } from "topojson-simplify";

const root = resolve(fileURLToPath(import.meta.url), "..", "..");
const source = join(root, "data", "natural-earth", "ne_10m_admin_0_countries_vnm.geojson");
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

let topo = topology({ countries: { type: "FeatureCollection", features } }, 1e5);
topo = presimplify(topo);
// Drop the least significant points; small islands keep their ring (at least a few points).
topo = simplify(topo, quantile(topo, 0.08));

mkdirSync(join(root, "src", "assets", "map"), { recursive: true });
const json = JSON.stringify(topo);
writeFileSync(out, json);
console.log(`wrote src/assets/map/region.topo.json: ${features.length} countries (${features.map((f) => f.properties.code).join(", ")}), ${json.length} bytes`);
