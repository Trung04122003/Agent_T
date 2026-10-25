// Scan a build output directory for private data (SPEC section 9).
// Usage: node scripts/check-leaks.mjs [dir]   (default: dist)
// Also rejects source maps and image metadata (EXIF, GPS, XMP).
// Prints file:line and rule only, never the matched text. Exit 1 on any violation.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(import.meta.url), "..", "..");
const target = resolve(process.argv[2] ?? join(root, "dist"));
const TEXT_EXT = new Set([".html", ".htm", ".js", ".mjs", ".css", ".json", ".xml", ".txt", ".svg", ".webmanifest"]);

const readJson = (name) => JSON.parse(readFileSync(join(root, "content", name), "utf8"));
const norm = (s) => s.normalize("NFC").toLowerCase();

// --- Sensitive strings taken from content/ ---
const claims = readJson("claims.json");
const identity = readJson("identity.json");
const places = readJson("places.json");

const SKIP_KEYS = new Set(["kind", "visibility", "status", "type"]);
function collectStrings(value, out, key = "") {
  if (typeof value === "string") {
    if (!SKIP_KEYS.has(key) && value.trim().length >= 3) out.push(value.trim());
  } else if (Array.isArray(value)) {
    for (const v of value) collectStrings(v, out, key);
  } else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) collectStrings(v, out, k);
  }
  return out;
}

const secrets = [];
for (const c of claims) {
  if (c.visibility === "hold") for (const s of collectStrings(c, [])) secrets.push({ rule: `hold text (${c.id})`, s });
  if (typeof c.notes === "string") secrets.push({ rule: `notes (${c.id})`, s: c.notes });
}
for (const p of places) if (typeof p.notes === "string") secrets.push({ rule: `notes (place ${p.id})`, s: p.notes });
if (typeof identity.positioning?.notes === "string") secrets.push({ rule: "notes (identity)", s: identity.positioning.notes });

const denyPath = join(root, "tools", "denylist.local.txt");
let denyCount = 0;
if (existsSync(denyPath)) {
  for (const line of readFileSync(denyPath, "utf8").split(/\r?\n/)) {
    const word = line.trim();
    if (word) {
      secrets.push({ rule: "denylist", s: word });
      denyCount++;
    }
  }
} else {
  console.warn("\n!!! WARNING: tools/denylist.local.txt not found. Denylist check SKIPPED. !!!\n");
}
const needles = secrets.map(({ rule, s }) => ({ rule, s: norm(s) }));

// --- Patterns ---
const allowedEmail = identity.contact?.email?.toLowerCase();
const patterns = [
  // VN mobile (0 + 9 digits) or landline (02xx + 7 digits), optional +84 and separators.
  { rule: "VN phone number", re: /(?<![\w.])(?:\+?84|0)[\s.-]?(?:[35789]\d|2\d\d)(?:[\s.-]?\d){7}(?!\d)/g },
  { rule: "email address", re: /[\w.%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi, allow: (m) => m.toLowerCase() === allowedEmail },
  { rule: "full date dd/mm/yyyy", re: /(?<!\d)(?:0?[1-9]|[12]\d|3[01])[/.-](?:0?[1-9]|1[0-2])[/.-](?:19|20)\d\d(?!\d)/g },
];

// Image metadata (UX section 5): EXIF (holds GPS) and XMP must be stripped by the build.
// "Exif" covers the JPEG APP1 header and the AVIF/HEIF item type; "eXIf" (PNG), "EXIF" and
// "XMP " (WebP) are container chunks.
const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif", ".tif", ".tiff", ".heic"]);
const IMAGE_MARKERS = [
  { rule: "image EXIF metadata", bytes: Buffer.from("Exif") },
  { rule: "image EXIF metadata", bytes: Buffer.from("eXIf") },
  { rule: "image EXIF metadata", bytes: Buffer.from("EXIF") },
  { rule: "image XMP metadata", bytes: Buffer.from("<x:xmpmeta") },
  { rule: "image XMP metadata", bytes: Buffer.from("XMP ") },
];

const decodeEntities = (s) =>
  s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

// --- Scan ---
if (!existsSync(target)) {
  console.error(`check-leaks: directory not found: ${target}. Run the build first.`);
  process.exit(2);
}

const violations = [];
const files = readdirSync(target, { recursive: true, withFileTypes: true }).filter((d) => d.isFile());
for (const d of files) {
  const path = join(d.parentPath, d.name);
  const rel = relative(target, path);
  if (d.name.endsWith(".map")) {
    violations.push(`${rel}: source map file`);
    continue;
  }
  if (IMAGE_EXT.has(extname(d.name).toLowerCase())) {
    const bytes = readFileSync(path);
    for (const m of IMAGE_MARKERS) if (bytes.includes(m.bytes)) violations.push(`${rel}: ${m.rule}`);
    continue;
  }
  if (!TEXT_EXT.has(extname(d.name).toLowerCase())) continue;

  const lines = readFileSync(path, "utf8").split(/\r?\n/);
  lines.forEach((raw, i) => {
    const line = decodeEntities(raw);
    const where = `${rel}:${i + 1}`;
    for (const p of patterns) {
      for (const m of line.matchAll(p.re)) if (!p.allow?.(m[0])) violations.push(`${where}: ${p.rule}`);
    }
    const hay = norm(line);
    for (const n of needles) if (hay.includes(n.s)) violations.push(`${where}: ${n.rule}`);
  });
}

console.log(
  `check-leaks: scanned ${files.length} file(s) in ${relative(root, target) || "."}; ` +
    `${secrets.length - denyCount} content string(s), ${denyCount} denylist word(s).`,
);
if (violations.length) {
  console.error(`check-leaks: ${violations.length} violation(s):`);
  for (const v of violations) console.error(`  ${v}`);
  process.exit(1);
}
console.log("check-leaks: OK");
