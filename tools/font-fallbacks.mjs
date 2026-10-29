// Fallback metrics for the reading profiles (ROADMAP 27.3): the values for the local fallback
// @font-face rules in src/styles/fonts.css, so the text barely moves when the web font swaps in.
// size-adjust matches the average advance width of a Vietnamese/English sample; ascent, descent
// and line gap then match the web font at that size. Reads the web font (Fontsource woff2) and the
// fallback from C:\Windows\Fonts (read only). Prints CSS; copy it into fonts.css by hand.
// Usage: node tools/font-fallbacks.mjs
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const fontkit = require("fontkit");
const root = resolve(fileURLToPath(import.meta.url), "..", "..");
const SAMPLE = "Tôi biến hệ thống phức tạp thành hành động rõ ràng. I turn complex systems into clear action.";

const PAIRS = [
  { name: "Source Serif 4", family: "source-serif-4", local: "Georgia", file: "georgia.ttf" },
  { name: "Lexend", family: "lexend", local: "Arial", file: "arial.ttf" },
  { name: "IBM Plex Mono", family: "ibm-plex-mono", local: "Courier New", file: "cour.ttf" },
];

/** Advance width of the sample in em; each character from the first file that has it. */
const width = (...fonts) =>
  [...SAMPLE.normalize("NFC")].reduce((w, ch) => {
    const cp = ch.codePointAt(0);
    const font = fonts.find((f) => f.hasGlyphForCodePoint(cp)) ?? fonts[0];
    return w + font.glyphForCodePoint(cp).advanceWidth / font.unitsPerEm;
  }, 0);
const pct = (n) => `${(n * 100).toFixed(2)}%`;

for (const p of PAIRS) {
  const web = fontkit.create(readFileSync(join(root, "node_modules", "@fontsource", p.family, "files", `${p.family}-vietnamese-400-normal.woff2`)));
  const latin = fontkit.create(readFileSync(join(root, "node_modules", "@fontsource", p.family, "files", `${p.family}-latin-400-normal.woff2`)));
  const fallback = fontkit.create(readFileSync(join("C:", "Windows", "Fonts", p.file)));
  // Fontsource splits the face: ASCII in "latin", the Vietnamese letters in "vietnamese".
  const size = width(latin, web) / width(fallback);
  const em = latin.unitsPerEm;
  console.log(`@font-face {
  font-family: "${p.name} fallback";
  src: local("${p.local}");
  size-adjust: ${pct(size)};
  ascent-override: ${pct(latin.ascent / em / size)};
  descent-override: ${pct(Math.abs(latin.descent) / em / size)};
  line-gap-override: ${pct(latin.lineGap / em / size)};
}`);
}
