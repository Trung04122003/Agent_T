// Static grain for the Mat background (ROADMAP 28.3): a small noise tile, repeated, so the dark
// background has some texture and no banding. Never animated. Its 3% strength is in the file
// (alpha 8/255), so CSS can use it as a plain background layer that scrolls with the page: no
// overlay layer to composite (an overlay cost frames, docs/perf-log.md). Deterministic (seeded),
// so the file only changes when this script does.
// Writes public/noise.png (64 x 64, 8-bit grey + alpha, about 8 KB; budget 8 KB). Node's zlib only.
// Usage: node tools/make-noise.mjs
import { writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { crc32, deflateSync } from "node:zlib";

const root = resolve(fileURLToPath(import.meta.url), "..", "..");
const SIZE = 64;
const ALPHA = 8; // 8/255, about 3%

// Mulberry32: small seeded PRNG.
let seed = 0x2610;
const random = () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// Per row: one filter byte (0, none), then grey and alpha for each pixel.
const ROW = 1 + SIZE * 2;
const raw = Buffer.alloc(SIZE * ROW);
for (let y = 0; y < SIZE; y++) {
  raw[y * ROW] = 0;
  for (let x = 0; x < SIZE; x++) {
    raw[y * ROW + 1 + x * 2] = Math.floor(random() * 256);
    raw[y * ROW + 2 + x * 2] = ALPHA;
  }
}

const chunk = (type, data) => {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body) >>> 0);
  return Buffer.concat([length, body, crc]);
};
const header = Buffer.alloc(13);
header.writeUInt32BE(SIZE, 0); // width
header.writeUInt32BE(SIZE, 4); // height
header[8] = 8; // bit depth
header[9] = 4; // greyscale with alpha
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", header),
  chunk("IDAT", deflateSync(raw, { level: 9 })),
  chunk("IEND", Buffer.alloc(0)),
]);
writeFileSync(join(root, "public", "noise.png"), png);
console.log(`make-noise: public/noise.png, ${png.length} B`);
