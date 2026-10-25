// Static Open Graph image (ROADMAP 8.4): neutral, codename only, 1200x630, no metadata.
// Usage: node scripts/make-og.mjs   -> public/og.png
import { mkdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = resolve(fileURLToPath(import.meta.url), "..", "..");
const identity = JSON.parse(readFileSync(join(root, "content", "identity.json"), "utf8"));
const name = identity.codenames.find((c) => c.locale === "en" && c.reviewed).name;
const escape = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

const [W, H, M] = [1200, 630, 80];
const mark = (x, y) => `<path d="M${x - 14} ${y}H${x + 14}M${x} ${y - 14}V${y + 14}" stroke="#B8975A" stroke-width="2"/>`;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <rect width="100%" height="100%" fill="#0A0A0B"/>
  ${mark(M, M)}${mark(W - M, M)}${mark(M, H - M)}${mark(W - M, H - M)}
  <line x1="${M + 40}" y1="${H - M - 50}" x2="${W - M - 40}" y2="${H - M - 50}" stroke="#B8975A" stroke-width="1"/>
  <text x="${M + 40}" y="${H - M - 110}" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="190" fill="#E8E6E1">${escape(name)}</text>
</svg>`;

mkdirSync(join(root, "public"), { recursive: true });
const out = join(root, "public", "og.png");
await sharp(Buffer.from(svg)).png().toFile(out);
const meta = await sharp(out).metadata();
console.log(`wrote public/og.png ${meta.width}x${meta.height}, exif: ${meta.exif ? "yes" : "none"}`);
