// /city/atlas.json (ROADMAP-v4 39.1): the Atlas's data, written at build time from the 2D map's own
// inputs and geometry (same as src/components/Map.astro). Injected with the city route only
// (astro.config.mjs), so with the city flag off it is never emitted. One file for both languages.
import type { APIRoute } from "astro";
import { getCollection, getEntry } from "astro:content";
import type { Topology } from "topojson-specification";
import neighbours from "../../content/countries.json";
import placesFile from "../../content/places.json";
import admin from "../../content/provinces.json";
import topo from "../assets/map/region.topo.json";
import { inFileOrder } from "../lib/ledger";
import { buildMap, VIEW } from "../lib/map";
import { atlasFrom } from "./atlas";

export const GET: APIRoute = async () => {
  const places = inFileOrder(
    (await getCollection("places")).map((e) => e.data),
    placesFile.map((p) => p.id),
  );
  // Label text only steers the 2D map's label placement, which the Atlas does not use.
  const map = buildMap(
    topo as unknown as Topology,
    places.map((p) => ({ id: p.id, lat: p.approx.lat, lon: p.approx.lon, text: p.label.vi })),
    admin,
    neighbours.labels,
  );
  const atlas = atlasFrom(
    map,
    [VIEW.width, VIEW.height],
    { hoangSa: (await getEntry("ui", "hoangSaLabel"))?.data, truongSa: (await getEntry("ui", "truongSaLabel"))?.data },
    neighbours.labels,
    places.map((p) => ({ id: p.id, role: p.role, label: p.label })),
  );
  return new Response(JSON.stringify(atlas), { headers: { "Content-Type": "application/json" } });
};
