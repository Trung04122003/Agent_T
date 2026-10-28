// Reading directions at build time (P7, P25): content/lenses.json, or a test list through
// CUPID_LENSES (e2e fixtures). Server side only; the browser gets what the components render.
import { readFileSync } from "node:fs";
import { LENSES_FILE } from "./paths";
import { lenses } from "./schema";

export function getLenses() {
  return lenses.parse(JSON.parse(readFileSync(LENSES_FILE, "utf8"))).lenses;
}
