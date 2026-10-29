// Download the Natural Earth source data for the map (ROADMAP 6.1) into data/ (git-ignored).
// Pinned to a commit of the official repository; each file's SHA-256 is printed for docs/LICENSES.md.
// Usage: node scripts/fetch-map-data.mjs
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const COMMIT = "9380cca83db5f9aef52d5e762765100745f84b27"; // natural-earth-vector v5.1.2
const FILES = [
  "ne_10m_admin_0_countries_vnm.geojson", // Admin 0 countries, Viet Nam point of view
  "ne_10m_admin_1_states_provinces.geojson", // Admin 1 provinces (Viet Nam's 63, before the 2025 merger)
];

const root = resolve(fileURLToPath(import.meta.url), "..", "..");
const dir = join(root, "data", "natural-earth");
mkdirSync(dir, { recursive: true });
for (const file of FILES) {
  const url = `https://raw.githubusercontent.com/nvkelso/natural-earth-vector/${COMMIT}/geojson/${file}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  writeFileSync(join(dir, file), bytes);
  console.log(`saved data/natural-earth/${file}: ${bytes.length} bytes, sha256 ${createHash("sha256").update(bytes).digest("hex")}`);
}
