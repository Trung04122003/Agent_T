// Font coverage check (ROADMAP 27.1/27.6): every reading profile must draw Vietnamese in full,
// with its own glyphs (never a fallback font's). Opens each self-hosted woff2 file with fontkit and
// checks that the union of a family's subsets (latin, latin-ext, vietnamese; Fontsource splits a
// face by unicode-range) has every code point of the test text, for each weight the site uses.
// Test text: SPEC section 7, plus every Vietnamese letter in both cases.
// Usage: node tools/check-fonts.mjs [extra text]   (exit 1 when a glyph is missing; extra text is
// checked too, which is how its test proves the failure path)
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const fontkit = require("fontkit");
const root = resolve(fileURLToPath(import.meta.url), "..", "..");

const SPEC_TEXT = "Lê Thái Trung — Ắ Ằ Ẳ Ẵ Ặ Ế Ề Ể Ễ Ệ Ố Ồ Ổ Ỗ Ộ Ớ Ờ Ở Ỡ Ợ Ứ Ừ Ử Ữ Ự";
const VOWELS = "aăâeêioôơuưy";
const TONES = ["", "\u0300", "\u0301", "\u0309", "\u0303", "\u0323"]; // huyền, sắc, hỏi, ngã, nặng
const letters = [...VOWELS].flatMap((v) => TONES.map((t) => (v + t).normalize("NFC")));
const ALPHABET = [...letters, "đ", ..."bcdghklmnpqrstvx"].join("");
export const TEST_TEXT = [SPEC_TEXT, ALPHABET, ALPHABET.toLocaleUpperCase("vi"), ...process.argv.slice(2)].join(" ");

/** The faces each reading profile uses (src/styles/tokens.css): family package and weights. */
export const PROFILES = [
  // Only latin + vietnamese are declared for these two faces (src/styles/fonts.css), so only those count.
  { profile: "ho-so", family: "be-vietnam-pro", weights: [400, 700], subsets: ["latin", "vietnamese"] },
  { profile: "bien-ban", family: "source-serif-4", weights: [400, 700], subsets: ["latin", "vietnamese"] },
  { profile: "de-doc", family: "lexend", weights: [400, 700] },
  { profile: "may-chu", family: "ibm-plex-mono", weights: [400, 700] },
];
const SUBSETS = ["latin", "latin-ext", "vietnamese"];

const needed = [...new Set([...TEST_TEXT.normalize("NFC")].filter((c) => c.trim()))];
let failed = 0;
for (const { profile, family, weights, subsets = SUBSETS } of PROFILES) {
  for (const weight of weights) {
    const covered = new Set();
    for (const subset of subsets) {
      const path = join(root, "node_modules", "@fontsource", family, "files", `${family}-${subset}-${weight}-normal.woff2`);
      const font = fontkit.create(readFileSync(path));
      for (const cp of font.characterSet) covered.add(cp);
    }
    const missing = needed.filter((c) => !covered.has(c.codePointAt(0)));
    if (missing.length) {
      failed++;
      console.error(`check-fonts: ${profile} (${family} ${weight}) misses ${missing.length}: ${missing.join(" ")}`);
    } else {
      console.log(`  ok   ${profile} (${family} ${weight}): all ${needed.length} characters`);
    }
  }
}
if (failed) {
  console.error(`check-fonts: ${failed} face(s) cannot draw the Vietnamese test text.`);
  process.exit(1);
}
console.log("check-fonts: OK");
