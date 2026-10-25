// Download the Natural Earth source data for the map (ROADMAP 6.1) into data/ (git-ignored).
// Pinned to a commit of the official repository; the file's SHA-256 is printed for docs/LICENSES.md.
// Usage: node scripts/fetch-map-data.mjs
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const COMMIT = "9380cca83db5f9aef52d5e762765100745f84b27"; // natural-earth-vector v5.1.2
const FILE = "ne_10m_admin_0_countries_vnm.geojson"; // Admin 0 countries, Viet Nam point of view
const url = `https://raw.githubusercontent.com/nvkelso/natural-earth-vector/${COMMIT}/geojson/${FILE}`;

const root = resolve(fileURLToPath(import.meta.url), "..", "..");
const dir = join(root, "data", "natural-earth");
const res = await fetch(url);
if (!res.ok) throw new Error(`${res.status} ${url}`);
const bytes = Buffer.from(await res.arrayBuffer());
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, FILE), bytes);
console.log(`saved data/natural-earth/${FILE}: ${bytes.length} bytes, sha256 ${createHash("sha256").update(bytes).digest("hex")}`);
