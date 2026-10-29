// Scan a build output directory for private data (SPEC section 9).
// Usage: node scripts/check-leaks.mjs [dir]   (default: dist)
// Also rejects source maps, image metadata (EXIF, GPS, XMP) and, while NOINDEX is on
// (src/lib/site.ts), any HTML page without <meta name="robots" content="noindex">.
// Prints file:line and rule only, never the matched text. Exit 1 on any violation.
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { NOINDEX } from "../src/lib/site.ts";

const root = resolve(fileURLToPath(import.meta.url), "..", "..");
const target = resolve(process.argv[2] ?? join(root, "dist"));
const TEXT_EXT = new Set([".html", ".htm", ".js", ".mjs", ".css", ".json", ".xml", ".txt", ".svg", ".webmanifest"]);

const readJson = (name) => JSON.parse(readFileSync(join(root, "content", name), "utf8"));
const norm = (s) => s.normalize("NFC").toLowerCase();

// --- Sensitive strings taken from content/ ---
const claims = readJson("claims.json");
const identity = readJson("identity.json");
const places = readJson("places.json");
const risks = readJson("risks.json");
const metrics = readJson("metrics.json");

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

// A hold entry's string is only secret if no public entry uses the same text (e.g. a shared
// evidence note like "available on request"); otherwise matching it would be a false alarm.
const publicStrings = new Set(
  claims
    .filter((c) => c.kind === "classified" || c.visibility !== "hold")
    .flatMap((c) => collectStrings({ ...c, notes: undefined }, []))
    .map(norm),
);
const secrets = [];
for (const c of claims) {
  if (c.visibility === "hold") {
    for (const s of collectStrings({ ...c, notes: undefined }, [])) {
      if (!publicStrings.has(norm(s))) secrets.push({ rule: `hold text (${c.id})`, s });
    }
  }
  if (typeof c.notes === "string") secrets.push({ rule: `notes (${c.id})`, s: c.notes });
}
for (const m of metrics) {
  if (typeof m.notes === "string") secrets.push({ rule: `notes (metric ${m.id})`, s: m.notes });
}
for (const r of risks) {
  if (typeof r.notes === "string") secrets.push({ rule: `notes (risk ${r.id})`, s: r.notes });
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
// The one email allowed on the site (ROADMAP 24.1), from tools/leak-allow.json; LEAK_ALLOW points
// elsewhere in tests only. More than one address there is refused, so it cannot grow quietly.
const allowPath = process.env["LEAK_ALLOW"] ?? join(root, "tools", "leak-allow.json");
const allowList = JSON.parse(readFileSync(allowPath, "utf8")).emails;
if (!Array.isArray(allowList) || allowList.length !== 1 || typeof allowList[0] !== "string") {
  console.error("check-leaks: tools/leak-allow.json must list exactly one email address.");
  process.exit(2);
}
const allowedEmail = allowList[0].toLowerCase();
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

// ROADMAP 29.8: nothing from private/ (the portrait originals and previews) may reach the site,
// renamed or not: a file under a "private" folder, or with the same bytes as a private file.
const privateDir = join(root, "private");
const privateHashes = new Set(
  existsSync(privateDir)
    ? readdirSync(privateDir, { recursive: true, withFileTypes: true })
        .filter((d) => d.isFile())
        .map((d) => createHash("sha256").update(readFileSync(join(d.parentPath, d.name))).digest("hex"))
    : [],
);

const violations = [];
const files = readdirSync(target, { recursive: true, withFileTypes: true }).filter((d) => d.isFile());
for (const d of files) {
  const path = join(d.parentPath, d.name);
  const rel = relative(target, path);
  if (rel.split(/[\\/]/).includes("private")) violations.push(`${rel}: file from a private folder`);
  if (privateHashes.size && privateHashes.has(createHash("sha256").update(readFileSync(path)).digest("hex"))) {
    violations.push(`${rel}: same bytes as a file in private/`);
  }
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

  const body = readFileSync(path, "utf8");
  if (NOINDEX && /\.html?$/i.test(d.name) && !/<meta name="robots" content="noindex"\s*\/?>/.test(body)) {
    violations.push(`${rel}: page without noindex (NOINDEX is on)`);
  }
  const lines = body.split(/\r?\n/);
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
