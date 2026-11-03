// Agent T City budgets (ROADMAP-v4 rule 4, P31.5). Fails when the city route's JS, the atlas data
// or the city's own CSS exceed their gzip budgets, or when the city ships any image or font.
// What counts:
// - JS: every script the city page loads, followed through static and dynamic imports (the whole
//   cost of opening the city, shared files included).
// - CSS: stylesheets the city page links that no dossier page links (the dossier's own CSS is a
//   fixed cost of every page, not the city's), plus the <style> blocks the build inlines in city
//   pages and in no dossier page (Astro inlines small stylesheets), each distinct block once.
// - Atlas data: every atlas*.json in the output.
// - Images and fonts: any such file inside the city folder, or referenced by city-only JS or CSS.
// With the city flag off there is no city route: nothing to check, and that passes.
// Usage: node scripts/city-budget.mjs [dir]   (dir defaults to dist/)
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, posix, relative, resolve } from "node:path";
import { gzipSync } from "node:zlib";

export const BUDGET = { js: 80 * 1024, atlas: 60 * 1024, css: 8 * 1024 };
const IMAGE_OR_FONT = /\.(png|jpe?g|webp|avif|gif|svg|ico|bmp|woff2?|ttf|otf|eot)(\?|#|$)/i;

const gz = (buf) => gzipSync(buf, { level: 9 }).length;
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}
/** Site-absolute URL ("/_astro/x.js") or relative to `from` -> path inside `root`. */
function local(root, url, from) {
  const clean = url.split(/[?#]/)[0];
  if (/^[a-z]+:|^\/\//i.test(clean)) return null; // another origin: not ours to size
  const p = clean.startsWith("/") ? join(root, clean) : join(dirname(from), clean);
  return existsSync(p) ? p : null;
}
const attrs = (html, re) => [...html.matchAll(re)].map((m) => m[1]);
const scriptsOf = (html) => [
  ...attrs(html, /<script\b[^>]*\bsrc="([^"]+)"/g),
  ...attrs(html, /<link\b[^>]*rel="modulepreload"[^>]*href="([^"]+)"/g),
  // Inline module scripts import their chunks too.
  ...[...html.matchAll(/<script\b[^>]*type="module"[^>]*>([\s\S]*?)<\/script>/g)].flatMap((m) => importsOf(m[1])),
];
const stylesOf = (html) => attrs(html, /<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g);
function importsOf(js) {
  return [...js.matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*)["'`]([^"'`]+\.m?js)["'`]/g)].map((m) => m[1]);
}
/** Every JS file reachable from these entry files (static and dynamic imports). */
function reachable(root, entries) {
  const seen = new Set();
  const stack = [...entries];
  while (stack.length) {
    const f = stack.pop();
    if (seen.has(f)) continue;
    seen.add(f);
    for (const u of importsOf(readFileSync(f, "utf8"))) {
      const p = local(root, u.startsWith(".") || u.startsWith("/") ? u : `./${u}`, f);
      if (p) stack.push(p);
    }
  }
  return seen;
}

export function cityBudget(dir) {
  const root = resolve(dir);
  const htmls = walk(root).filter((f) => f.endsWith(".html"));
  const isCity = (f) => relative(root, f).split(/[\\/]/).includes("city");
  const cityPages = htmls.filter(isCity);
  const problems = [];
  const report = { cityPages: cityPages.length, js: 0, css: 0, atlas: 0 };
  if (!cityPages.length) return { report, problems, note: "no city route in the output (PUBLIC_CITY off): nothing to check" };

  const pageJs = (pages) =>
    reachable(
      root,
      pages.flatMap((p) => scriptsOf(readFileSync(p, "utf8")).map((u) => local(root, u, p)).filter(Boolean)),
    );
  const pageCss = (pages) => new Set(pages.flatMap((p) => stylesOf(readFileSync(p, "utf8")).map((u) => local(root, u, p)).filter(Boolean)));
  const dossier = htmls.filter((f) => !isCity(f));
  const cityJs = pageJs(cityPages);
  const dossierJs = pageJs(dossier);
  const dossierCss = pageCss(dossier);
  const cityCss = [...pageCss(cityPages)].filter((f) => !dossierCss.has(f));

  report.js = [...cityJs].reduce((n, f) => n + gz(readFileSync(f)), 0);
  const inline = (pages) => new Set(pages.flatMap((p) => [...readFileSync(p, "utf8").matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1])));
  const dossierInline = inline(dossier);
  const cityInline = [...inline(cityPages)].filter((css) => !dossierInline.has(css));
  report.css = cityCss.reduce((n, f) => n + gz(readFileSync(f)), 0) + cityInline.reduce((n, css) => n + gz(Buffer.from(css)), 0);
  const atlas = walk(root).filter((f) => /^atlas.*\.json$/i.test(posix.basename(f.replace(/\\/g, "/"))));
  report.atlas = atlas.reduce((n, f) => n + gz(readFileSync(f)), 0);
  if (report.js > BUDGET.js) problems.push(`city JS ${report.js} B gzip > ${BUDGET.js} B`);
  if (report.css > BUDGET.css) problems.push(`city CSS ${report.css} B gzip > ${BUDGET.css} B`);
  if (report.atlas > BUDGET.atlas) problems.push(`atlas data ${report.atlas} B gzip > ${BUDGET.atlas} B`);

  // No image or font: as files in the city folders, or referenced by what only the city loads.
  for (const f of walk(root).filter((x) => isCity(x) && IMAGE_OR_FONT.test(x))) problems.push(`${relative(root, f)}: image or font in the city route`);
  const cityOnly = [...[...cityJs].filter((f) => !dossierJs.has(f)), ...cityCss, ...cityPages];
  for (const f of cityOnly) {
    // <meta> tags are not fetched (the dossier's share image in og:image is not a city asset).
    const text = readFileSync(f, "utf8").replace(/<meta\b[^>]*>/gi, "");
    const refs = [...text.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)|["'`]([^"'`\s]+\.(?:png|jpe?g|webp|avif|gif|svg|ico|bmp|woff2?|ttf|otf|eot))["'`]/gi)].map((m) => m[1] ?? m[2]);
    for (const r of refs.filter((u) => IMAGE_OR_FONT.test(u) && !u.startsWith("data:"))) problems.push(`${relative(root, f)}: references ${r} (image or font)`);
    if (/url\(\s*["']?data:(image|font)\//i.test(text)) problems.push(`${relative(root, f)}: inline image or font (data: URL)`);
  }
  // City code is for the city route only.
  for (const f of [...cityJs].filter((x) => !dossierJs.has(x))) {
    const name = posix.basename(f.replace(/\\/g, "/"));
    for (const page of dossier) {
      if (readFileSync(page, "utf8").includes(name)) problems.push(`${relative(root, page)}: loads city file ${name}`);
    }
  }
  return { report, problems, note: "" };
}

const self = process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname.replace(/^\/([a-z]:)/i, "$1"));
if (self) {
  const dir = process.argv[2] ?? "dist";
  const { report, problems, note } = cityBudget(dir);
  if (note) console.log(`city-budget: ${note}`);
  else console.log(`city-budget: ${report.cityPages} city page(s); JS ${report.js} B gzip (<= ${BUDGET.js}), city CSS ${report.css} B (<= ${BUDGET.css}), atlas ${report.atlas} B (<= ${BUDGET.atlas})`);
  for (const p of problems) console.error(`  ${p}`);
  if (problems.length) {
    console.error(`city-budget: FAILED (${problems.length})`);
    process.exit(1);
  }
  console.log("city-budget: OK");
}
