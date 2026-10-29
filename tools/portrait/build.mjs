// Portrait build (ROADMAP P29): one photo session, two treatments. Reads the owner's originals
// from private/portrait-raw/ (git-ignored; calm.jpg, smile.jpg) and the crop/mask coordinates
// from tools/portrait/crops.json, and writes:
//   public/portrait/{low,high-b}-{480,720,960}.{avif,webp,jpg}      the site's files
//   private/portrait-preview/*.jpg                                   previews for the owner
// Allowed edits only (ROADMAP P29): crop, slight rotation, exposure, contrast, colour temperature
// and saturation, edge vignette, a light background blur, sharpening. Never skin smoothing, face
// or body changes, eye/teeth edits, AI backgrounds, or removing anything from the person.
//   low     (Mat)            from calm: darker (x0.7), more contrast, 25% less saturation, warm, vignette
//   high-a  (Giai mat, A)    from calm: exposure close to the original, neutral white balance
//   high-b  (Giai mat, B)    from smile, cropped so the eyes sit where they sit in `low`, same scale
// Every file: sRGB, no metadata (checked with sharp.metadata()), at most 120 KB.
// Usage: node tools/portrait/build.mjs [--blur] [--raw dir] [--crops file] [--out dir] [--preview dir]
//   --blur  also apply the background blur (step 29.5, a trial; previews are made both ways)
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = resolve(fileURLToPath(import.meta.url), "..", "..", "..");
const arg = (name, fallback) => (process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : fallback);
const RAW = resolve(arg("--raw", join(root, "private", "portrait-raw")));
const CROPS = resolve(arg("--crops", join(root, "tools", "portrait", "crops.json")));
const OUT = resolve(arg("--out", join(root, "public", "portrait")));
const PREVIEW = resolve(arg("--preview", join(root, "private", "portrait-preview")));
const BLUR = process.argv.includes("--blur");

// Widths: 480 (small phones), 720 (most phones: a 380 px frame at DPR 1.75-2), 960 (2x the 473 px
// frame at 1280, ROADMAP 29.1).
export const TARGET = { width: 960, height: 1200, widths: [480, 720, 960], maxBytes: 120 * 1024, faceMin: 40 };

const crops = JSON.parse(readFileSync(CROPS, "utf8"));
for (const f of ["calm", "smile"]) {
  if (!existsSync(join(RAW, `${f}.jpg`))) {
    console.error(`portrait: ${join(RAW, `${f}.jpg`)} is missing (ROADMAP 29.0: the owner copies the originals there).`);
    process.exit(2);
  }
}

/**
 * Crop box for `smile` that puts its eyes where `calm`'s crop puts calm's eyes, at the same scale
 * (eye distance), so Declassify changes only the expression. Crop and scale only, no warping.
 */
function alignedCrop(calm, smile) {
  const dist = (e) => Math.hypot(e.right[0] - e.left[0], e.right[1] - e.left[1]);
  const mid = (e) => [(e.left[0] + e.right[0]) / 2, (e.left[1] + e.right[1]) / 2];
  const k = dist(smile.eyes) / dist(calm.eyes);
  const [cx, cy] = mid(calm.eyes);
  const [sx, sy] = mid(smile.eyes);
  const c = calm.crop;
  return {
    left: Math.round(sx - (cx - c.left) * k),
    top: Math.round(sy - (cy - c.top) * k),
    width: Math.round(c.width * k),
    height: Math.round(c.height * k),
  };
}

/**
 * Soft mask (white = the person, kept sharp), the size of the output, for the background blur:
 * one or more ellipses in output pixels (e.g. the head, then the shoulders), feathered.
 */
function ellipseMask(m, w, h) {
  const shapes = m.shapes.map((e) => `<ellipse cx="${e.cx}" cy="${e.cy}" rx="${e.rx}" ry="${e.ry}" fill="#fff"/>`).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><defs><filter id="f" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="${m.feather}"/></filter></defs><g filter="url(#f)">${shapes}</g></svg>`;
  return Buffer.from(svg);
}
/** Dark edge vignette (black, transparent in the middle), as a PNG overlay. */
function vignette(w, h, strength) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><defs><radialGradient id="g" cx="50%" cy="42%" r="75%"><stop offset="55%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity="${strength}"/></radialGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`;
  return Buffer.from(svg);
}

/** Gray-world white balance: per-channel gains that bring the crop's means together. */
async function neutralGains(buf) {
  const { channels } = await sharp(buf).stats();
  const means = channels.slice(0, 3).map((c) => c.mean);
  const grey = (means[0] + means[1] + means[2]) / 3;
  return means.map((m) => grey / m);
}

async function render(name, source, crop, look, mask, blur) {
  const raw = sharp(join(RAW, `${source}.jpg`)).rotate(); // honour the camera's orientation, then drop it
  let base = await raw
    .extract(crop)
    .resize(TARGET.width, TARGET.height, { fit: "fill" }) // same 4:5 box: a resize, never a distortion
    .toColourspace("srgb")
    .toBuffer();
  if (blur && mask) {
    const soft = await sharp(base).blur(mask.sigma).toBuffer();
    const subject = await sharp(base).ensureAlpha().composite([{ input: ellipseMask(mask, TARGET.width, TARGET.height), blend: "dest-in" }]).png().toBuffer();
    base = await sharp(soft).composite([{ input: subject }]).toBuffer();
  }
  let img = sharp(base);
  if (look === "low") {
    img = img
      .modulate({ brightness: 0.7, saturation: 0.75 })
      .linear(1.15, -128 * 0.15) // contrast up around mid-grey
      .recomb([
        [1.05, 0, 0],
        [0, 1.0, 0],
        [0, 0, 0.9],
      ]); // warm, towards the site's brass
  } else {
    const [r, g, b] = await neutralGains(base);
    img = img.recomb([
      [r, 0, 0],
      [0, g, 0],
      [0, 0, b],
    ]);
  }
  img = img.sharpen({ sigma: 0.6 });
  let graded = await img.toBuffer();
  if (look === "low") graded = await sharp(graded).composite([{ input: vignette(TARGET.width, TARGET.height, 0.7) }]).toBuffer();
  return graded;
}

/** Mean luminance (0-255) of a box of the output, e.g. the face (ROADMAP 29.3). */
async function meanLuma(buf, box) {
  const region = await sharp(buf).extract(box).greyscale().stats();
  return region.channels[0].mean;
}

async function encode(name, buf) {
  const written = [];
  for (const width of TARGET.widths) {
    const sized = width === TARGET.width ? sharp(buf) : sharp(buf).resize(width);
    for (const [ext, make] of [
      ["avif", (q) => sized.clone().avif({ quality: q, effort: 6 })],
      ["webp", (q) => sized.clone().webp({ quality: q })],
      ["jpg", (q) => sized.clone().jpeg({ quality: q, mozjpeg: true })],
    ]) {
      // Start at a good quality; step down until within the budget.
      let q = ext === "avif" ? 60 : 80;
      let data = await make(q).toBuffer();
      while (data.length > TARGET.maxBytes && q > 30) data = await make((q -= 5)).toBuffer();
      const meta = await sharp(data).metadata();
      if (meta.exif || meta.xmp || meta.iptc) throw new Error(`${name}-${width}.${ext}: metadata left in the file`);
      if (data.length > TARGET.maxBytes) throw new Error(`${name}-${width}.${ext}: ${data.length} B over budget`);
      writeFileSync(join(OUT, `${name}-${width}.${ext}`), data);
      written.push({ file: `${name}-${width}.${ext}`, bytes: data.length, quality: q });
    }
  }
  return written;
}

mkdirSync(OUT, { recursive: true });
mkdirSync(PREVIEW, { recursive: true });
const smileCrop = crops.smile.crop ?? alignedCrop(crops.calm, crops.smile);
const jobs = [
  { name: "low", source: "calm", crop: crops.calm.crop, look: "low" },
  { name: "high-a", source: "calm", crop: crops.calm.crop, look: "high" },
  { name: "high-b", source: "smile", crop: smileCrop, look: "high" },
];
const shipped = new Set(Object.values(crops.ship ?? { mat: "low", giaiMat: "high-a" }));
const report = [];
for (const j of jobs) {
  const mask = crops[j.source].mask;
  const out = await render(j.name, j.source, j.crop, j.look, mask, BLUR);
  // Previews both ways (29.5 trial): with and without the background blur.
  const other = await render(j.name, j.source, j.crop, j.look, mask, !BLUR);
  writeFileSync(join(PREVIEW, `${j.name}${BLUR ? "-blur" : ""}.jpg`), await sharp(out).jpeg({ quality: 90 }).toBuffer());
  writeFileSync(join(PREVIEW, `${j.name}${BLUR ? "" : "-blur"}.jpg`), await sharp(other).jpeg({ quality: 90 }).toBuffer());
  const face = crops.face; // in output pixels (960 x 1200)
  const luma = face ? Math.round(await meanLuma(out, face)) : null;
  if (j.name === "low" && luma !== null && luma < TARGET.faceMin) console.warn(`portrait: low face luma ${luma} < ${TARGET.faceMin}`);
  // Only the owner's choice goes to the site (crops.json "ship"); the rest stays a preview.
  const files = shipped.has(j.name) ? await encode(j.name, out) : [];
  report.push({ variant: j.name, source: j.source, crop: j.crop, faceLuma: luma, files });
}
writeFileSync(join(PREVIEW, "report.json"), JSON.stringify(report, null, 2));
for (const r of report) {
  console.log(`${r.variant} (${r.source}) crop ${JSON.stringify(r.crop)} face luma ${r.faceLuma}`);
  for (const f of r.files) console.log(`  ${f.file}: ${f.bytes} B (q${f.quality})`);
}
