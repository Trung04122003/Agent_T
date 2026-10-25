// Generate the neutral portrait placeholder (UX section 5: no real photo until the owner picks one).
// It deliberately carries fake EXIF and GPS so the build proves metadata is stripped (check-leaks).
// Usage: node scripts/make-placeholder.mjs
import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = resolve(fileURLToPath(import.meta.url), "..", "..");
const out = join(root, "src", "assets", "portrait", "placeholder.jpg");
const [width, height] = [1600, 2000]; // 4:5

// Flat mid grey with fine static grain: reads as "no photo yet" in both modes.
const noise = Buffer.alloc(width * height);
let seed = 42;
for (let i = 0; i < noise.length; i++) {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  noise[i] = 118 + (seed % 12);
}

mkdirSync(join(root, "src", "assets", "portrait"), { recursive: true });
await sharp(noise, { raw: { width, height, channels: 1 } })
  .jpeg({ quality: 80 })
  .withExif({
    IFD0: { Artist: "metadata-probe", Copyright: "metadata-probe" },
    IFD3: { GPSLatitudeRef: "N", GPSLatitude: "0/1 0/1 0/1", GPSLongitudeRef: "E", GPSLongitude: "0/1 0/1 0/1" },
  })
  .toFile(out);

const meta = await sharp(out).metadata();
console.log(`wrote ${out} (${meta.width}x${meta.height}, exif ${meta.exif ? meta.exif.length : 0} bytes)`);
