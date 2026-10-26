// WCAG contrast check for the two mode token sets in src/styles/tokens.css (SPEC section 10).
// Usage: node scripts/check-contrast.mjs [tokens.css]. Exit 1 if any required pair fails.
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(import.meta.url), "..", "..");
const css = readFileSync(resolve(process.argv[2] ?? join(root, "src", "styles", "tokens.css")), "utf8");

/** Read `--name: #hex;` declarations from the block whose selector ends with [data-mode="<mode>"]. */
function tokens(mode) {
  const m = css.match(new RegExp(`\\[data-mode="${mode}"\\]\\s*\\{([^}]*)\\}`));
  if (!m) throw new Error(`No token block for data-mode="${mode}"`);
  return Object.fromEntries([...m[1].matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})\s*;/gi)].map((d) => [d[1], d[2]]));
}

function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function ratio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// [foreground, background, minimum, required]. Text needs 4.5 (AA); accent doubles as the focus
// ring, which needs only 3 (non-text), so the 4.5 check covers it.
const PAIRS = [
  ["ink", "bg", 4.5, true],
  ["ink", "surface", 4.5, true],
  ["ink-muted", "bg", 4.5, true],
  ["ink-muted", "surface", 4.5, true],
  ["accent", "bg", 4.5, true],
  ["accent", "surface", 4.5, true],
  // Redaction bars are graphics that must stay visible (WCAG 1.4.11 non-text contrast).
  ["redact", "bg", 3, true],
  ["redact", "surface", 3, true],
  // Text must stay readable where it crosses a grid line (UX-v2 section 3).
  ["ink", "grid", 4.5, true],
  ["ink-muted", "grid", 4.5, true],
];

let failed = 0;
for (const mode of ["mat", "giai-mat"]) {
  const t = tokens(mode);
  console.log(`[${mode}]`);
  for (const [fg, bg, min, required] of PAIRS) {
    if (!t[fg] || !t[bg]) {
      console.error(`  missing token --${fg} or --${bg}`);
      failed++;
      continue;
    }
    const r = ratio(t[fg], t[bg]);
    const ok = r >= min;
    if (!ok && required) failed++;
    const tag = ok ? "ok  " : required ? "FAIL" : "WARN";
    console.log(`  ${tag} --${fg} on --${bg}: ${r.toFixed(2)}:1 (min ${min})`);
  }
}
if (failed) {
  console.error(`check-contrast: ${failed} required pair(s) below WCAG AA.`);
  process.exit(1);
}
console.log("check-contrast: OK (WCAG AA in both modes)");
