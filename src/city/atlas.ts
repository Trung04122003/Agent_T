// The Atlas's data (ROADMAP-v4 P39, UX-v4 section 5): exported at build time from the 2D map's own
// geometry (src/lib/map.ts `buildMap`, same inputs as Map.astro), never from a new geometry source.
// Province shapes and their brightness steps per mode, inner borders, land borders between countries,
// the neighbours' shapes and names, the places of content/places.json, and Hoang Sa and Truong Sa:
// their islands and their labels, taken from the very strings the 2D map shows (ui.json
// hoangSaLabel, truongSaLabel). The export fails the build if either label is missing or does not
// say "(Viet Nam)" / "(Việt Nam)". Nothing here is drawn as a line in the sea: the only line paths
// are land borders (shared edges of land shapes), which a test checks vertex by vertex.
import type { MapGeometry, Tier } from "../lib/map";

type Localized = { vi: string; en: string };
export type Atlas = {
  /** The 2D map's SVG frame (x, y units) and the box around Viet Nam and both archipelagos. */
  view: [number, number];
  focus: [number, number, number, number];
  provinces: { code: string; after: string; d: string; tier: { before: Tier; after: Tier } }[];
  borders: { kept: string; merged: string };
  /** Land borders between countries: shared edges only, never a coastline or a line at sea. */
  frontiers: string;
  countries: { code: string; d: string }[];
  countryLabels: { code: string; x: number; y: number; name: Localized }[];
  places: { id: string; role: string; x: number; y: number; label: Localized }[];
  capital: [number, number];
  archipelagos: Record<"hoangSa" | "truongSa", { dots: [number, number][]; label: [number, number]; anchor: "start" | "end"; text: Localized }>;
};

/** What the sovereignty labels must say (DECISIONS-v4 hard limits), per language. */
export const SOVEREIGN = { vi: "(Việt Nam)", en: "(Viet Nam)" } as const;

/**
 * The export from the 2D map's geometry. `labels`: the 2D map's own archipelago strings (ui.json),
 * `names`: the neighbours' names (countries.json), `places`: content/places.json in its file order.
 * Throws when an archipelago label is missing or does not carry "(Viet Nam)", so the build fails.
 */
export function atlasFrom(
  map: MapGeometry,
  view: [number, number],
  labels: Record<"hoangSa" | "truongSa", Partial<Localized> | undefined>,
  names: { code: string; vi: string; en: string }[],
  places: { id: string; role: string; label: Localized }[],
): Atlas {
  const sovereign = (key: "hoangSa" | "truongSa"): Localized => {
    const l = labels[key];
    for (const lang of ["vi", "en"] as const) {
      const text = l?.[lang];
      if (!text) throw new Error(`atlas: the ${key} label (${lang}) is missing; it must come from the 2D map's own string`);
      if (!text.includes(SOVEREIGN[lang])) throw new Error(`atlas: the ${key} label (${lang}) must say "${SOVEREIGN[lang]}", as the 2D map does`);
    }
    return { vi: l!.vi!, en: l!.en! };
  };
  const nameOf = new Map(names.map((n) => [n.code, { vi: n.vi, en: n.en }]));
  return {
    view,
    focus: map.focus,
    provinces: map.provinces,
    borders: map.borders,
    frontiers: map.frontiers,
    countries: map.countries,
    countryLabels: map.countryLabels.map((c) => ({ ...c, name: nameOf.get(c.code)! })),
    places: map.points.map((p) => {
      const place = places.find((x) => x.id === p.id)!;
      return { id: p.id, role: place.role, x: p.x, y: p.y, label: place.label };
    }),
    capital: map.capital,
    archipelagos: {
      hoangSa: { ...map.archipelagos.hoangSa, text: sovereign("hoangSa") },
      truongSa: { ...map.archipelagos.truongSa, text: sovereign("truongSa") },
    },
  };
}
