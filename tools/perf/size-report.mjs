// Size report (docs/performance-playbook.md, section 2): every file in dist/ (or the folder given),
// gzip -9 and brotli sizes, grouped by type. Usage: node tools/perf/size-report.mjs [dir] [--json]
import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";
import { brotliCompressSync, constants, gzipSync } from "node:zlib";

export const GROUPS = {
  js: [".js", ".mjs"],
  css: [".css"],
  font: [".woff2", ".woff", ".ttf", ".otf"],
  image: [".png", ".jpg", ".jpeg", ".webp", ".avif", ".gif", ".svg", ".ico"],
  json: [".json", ".webmanifest"],
  html: [".html"],
};
export const groupOf = (file) => Object.entries(GROUPS).find(([, exts]) => exts.includes(extname(file).toLowerCase()))?.[0] ?? "other";

export function filesIn(dir) {
  const out = [];
  const walk = (d) => {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else out.push(p);
    }
  };
  walk(dir);
  return out;
}

export const gz = (buf) => gzipSync(buf, { level: 9 }).length;
const br = (buf) => brotliCompressSync(buf, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }).length;

export function sizeReport(dir) {
  const rows = filesIn(dir).map((f) => {
    const buf = readFileSync(f);
    return { file: relative(dir, f).replace(/\\/g, "/"), group: groupOf(f), raw: buf.length, gzip: gz(buf), brotli: br(buf) };
  });
  const groups = {};
  for (const r of rows) {
    const g = (groups[r.group] ??= { files: 0, raw: 0, gzip: 0, brotli: 0 });
    g.files++;
    g.raw += r.raw;
    g.gzip += r.gzip;
    g.brotli += r.brotli;
  }
  return { rows, groups };
}

if (import.meta.url === `file:///${resolve(process.argv[1] ?? "").replace(/\\/g, "/")}`) {
  const dir = resolve(process.argv.slice(2).find((a) => !a.startsWith("--")) ?? "dist");
  const report = sizeReport(dir);
  if (process.argv.includes("--json")) console.log(JSON.stringify(report.groups));
  else {
    console.log(`size-report: ${dir}`);
    for (const [g, v] of Object.entries(report.groups).sort()) {
      console.log(`  ${g.padEnd(6)} ${String(v.files).padStart(4)} files  raw ${v.raw}  gzip ${v.gzip}  brotli ${v.brotli}`);
    }
  }
}
