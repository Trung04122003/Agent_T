// Every displayed localized string in content/, gathered for the completeness check (ROADMAP 10.3).
// Reads the JSON files directly so both the build (Astro) and scripts/check-locales.mjs use it.
import { readFileSync } from "node:fs";
import { CLAIMS_FILE, METRICS_FILE, RISKS_FILE } from "./paths.ts";

const read = (path: string): unknown => JSON.parse(readFileSync(path, "utf8"));

/** Objects that hold one displayed string per language ({ vi, en, ... }); internal notes skipped. */
function localizedObjects(value: unknown, out: Record<string, unknown>[] = []): Record<string, unknown>[] {
  if (Array.isArray(value)) value.forEach((v) => localizedObjects(v, out));
  else if (value && typeof value === "object") {
    const o = value as Record<string, unknown>;
    if (typeof o["vi"] === "string" && typeof o["en"] === "string") out.push(o);
    else for (const [k, v] of Object.entries(o)) if (k !== "notes" && k !== "approval") localizedObjects(v, out);
  }
  return out;
}

export function contentStrings(): { strings: Record<string, unknown>[]; reviewed: string[] } {
  const claims = (read(CLAIMS_FILE) as { visibility?: string; kind: string }[]).filter(
    (c) => c.kind === "classified" || c.visibility !== "hold",
  );
  const identity = read("content/identity.json") as {
    positioning: Record<string, unknown>;
    positioningMat?: Record<string, unknown> | null;
    codenames: { locale: string; reviewed: boolean }[];
  };
  const strings = [
    ...localizedObjects(read("content/ui.json")),
    ...localizedObjects(claims),
    ...localizedObjects(read("content/places.json")),
    ...localizedObjects(read("content/lenses.json")),
    ...localizedObjects(read(RISKS_FILE)),
    ...localizedObjects(read(METRICS_FILE)),
    identity.positioning,
    ...localizedObjects(identity.positioningMat ?? []),
  ];
  return { strings, reviewed: identity.codenames.filter((c) => c.reviewed).map((c) => c.locale) };
}
