// Agent T City content map (ROADMAP-v4 P31.2): what the city may show, derived from the same
// filtered entries the ledger renders (the claims collection, `hold` dropped by the loader). City
// code never reads the raw content file: it takes these entries and nothing else. One plot per open
// entry, the Vault for the classified one, and a landmark for each dossier part that exists.
import { tierOf, type Tier } from "../lib/evidence";
import { publicClaims } from "../lib/ledger";
import type { Claim } from "../lib/schema";

export type CityPlot = {
  /** Same id as the ledger row (`#claim-<id>`), so a district can link to it. */
  id: string;
  plot: string;
  kind: "role" | "education" | "project";
  domains: string[];
  tier: Tier;
  place: string | null;
};
/** Landmarks stand for dossier parts, never for a person or an organisation (UX-v4 section 2). */
export type Landmark = "archive-tower" | "debrief-room" | "risk-registry" | "lab" | "dead-drop";
export type CityContentMap = {
  plots: CityPlot[];
  /** The classified entry: its type label only, never its text. */
  vault: { id: string; plot: "vault" } | null;
  landmarks: { id: Landmark; component: string }[];
};

/**
 * `entries`: the ledger's entries (the claims collection). `hold` is dropped again here, so a
 * caller that forgot the loader's filter still cannot leak one. `risks`: how many items the
 * "Limits and risks" section shows.
 */
export function cityContentMap(entries: readonly Claim[], risks: number): CityContentMap {
  const shown = publicClaims([...entries]);
  const open = shown.flatMap((c) => (c.kind === "classified" ? [] : [c]));
  const classified = shown.find((c) => c.kind === "classified");
  const plots = open.map((c) => ({
    id: c.id,
    plot: `plot-${c.id}`,
    kind: c.kind,
    domains: [...(c.domains ?? [])],
    tier: tierOf(c.evidence),
    place: c.place ?? null,
  }));
  const landmarks: CityContentMap["landmarks"] = [];
  if (open.length) landmarks.push({ id: "archive-tower", component: "ledger" });
  if (open.some((c) => c.aar)) landmarks.push({ id: "debrief-room", component: "aar" });
  if (risks > 0) landmarks.push({ id: "risk-registry", component: "risks" });
  if (open.some((c) => c.domains?.length) || open.some((c) => c.evidence.length)) {
    landmarks.push({ id: "lab", component: "capability-matrix, evidence-trail" });
  }
  if (open.some((c) => c.evidence.some((e) => e.type === "document-on-request"))) {
    landmarks.push({ id: "dead-drop", component: "request-declassification" });
  }
  return { plots, vault: classified ? { id: classified.id, plot: "vault" } : null, landmarks };
}
