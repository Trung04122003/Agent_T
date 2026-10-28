import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Fixtures are generated under test-results/ (git-ignored) so no private text is committed.
const base = join("test-results", "check-leaks");
const claims = JSON.parse(readFileSync("content/claims.json", "utf8"));
const holdTitle = claims.find((c) => c.visibility === "hold" && c.title).title.vi;
const someNote = claims.find((c) => typeof c.notes === "string").notes;

function run(name, files) {
  const dir = join(base, name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  for (const [file, body] of Object.entries(files)) writeFileSync(join(dir, file), body);
  const r = spawnSync(process.execPath, ["scripts/check-leaks.mjs", dir], { encoding: "utf8" });
  return { code: r.status, out: r.stdout + r.stderr };
}

const page = (body) => `<!doctype html><html lang="vi"><head><meta name="robots" content="noindex"></head><body>${body}</body></html>\n`;

describe("check-leaks", () => {
  it("passes a clean page", () => {
    const r = run("clean", { "index.html": page("<p>Lê Thái Trung — Ắ Ằ Ẳ, 2024–2026, v0.3.1234567890</p>") });
    expect(r.out).toContain("check-leaks: OK");
    expect(r.code).toBe(0);
  });

  it.each([
    ["mobile", "Gọi 0900 000 000"],
    ["mobile dotted", "0900.000.000"],
    ["intl", "+84 900 000 000"],
    ["landline", "0236 3000 000"],
  ])("fails on a fake phone number (%s)", (name, text) => {
    const r = run(`phone-${name.replace(" ", "-")}`, { "index.html": page(text) });
    expect(r.code).toBe(1);
    expect(r.out).toContain("index.html:1: VN phone number");
    expect(r.out).not.toContain(text);
  });

  it("fails on an email address and a full date", () => {
    const r = run("email-date", { "index.html": page("a@example.com\n01/02/2003") });
    expect(r.code).toBe(1);
    expect(r.out).toContain("index.html:1: email address");
    expect(r.out).toContain("index.html:2: full date dd/mm/yyyy");
  });

  it("24.1 allows exactly the work email from tools/leak-allow.json, and no other", () => {
    const allowed = JSON.parse(readFileSync("tools/leak-allow.json", "utf8")).emails;
    expect(allowed).toEqual(["lethaitrungwork@gmail.com"]);
    const ok = run("allow-ok", { "index.html": page(`<a href="mailto:${allowed[0]}?subject=x">${allowed[0]}</a>`) });
    expect(ok.out).toContain("check-leaks: OK");
    const other = run("allow-other", { "index.html": page(`${allowed[0]} lethaitrung.work@gmail.com`) });
    expect(other.code).toBe(1);
    expect(other.out).toContain("index.html:1: email address");
  });

  it("24.1 refuses an allowlist with more than one address", () => {
    const list = join(base, "two.json");
    mkdirSync(base, { recursive: true });
    writeFileSync(list, JSON.stringify({ emails: ["a@example.com", "b@example.com"] }));
    const dir = join(base, "allow-two");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "index.html"), page("a@example.com"));
    const r = spawnSync(process.execPath, ["scripts/check-leaks.mjs", dir], { encoding: "utf8", env: { ...process.env, LEAK_ALLOW: list } });
    expect(r.status).toBe(2);
    expect(r.stderr).toContain("exactly one email address");
  });

  it("fails on hold text (even HTML-escaped) and internal notes, without printing them", () => {
    const escaped = holdTitle.replace(/[^\x20-\x7e]/g, (ch) => `&#${ch.codePointAt(0)};`);
    const r = run("hold-notes", { "index.html": page(escaped), "data.json": JSON.stringify({ x: someNote }) });
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/index\.html:1: hold text/);
    expect(r.out).toMatch(/data\.json:1: notes/);
    expect(r.out).not.toContain(holdTitle);
  });

  it.each([
    ["photo.jpg", Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe1, 0, 16]), Buffer.from("Exif\0\0MM")])],
    ["photo.webp", Buffer.from("RIFF\0\0\0\0WEBPVP8X\0\0\0\0EXIF")],
    ["photo.png", Buffer.from("\x89PNG\r\n\x1a\n\0\0\0\0eXIf")],
    ["photo.avif", Buffer.from('\0\0\0\0ftypavif<x:xmpmeta xmlns:x="adobe:ns:meta/">')],
  ])("fails on image metadata (%s)", (file, bytes) => {
    const r = run(`image-${file.replace(".", "-")}`, { [file]: bytes });
    expect(r.code).toBe(1);
    expect(r.out).toMatch(new RegExp(`${file.replace(".", "\\.")}: image (EXIF|XMP) metadata`));
  });

  it("fails on source map files", () => {
    const r = run("map", { "app.js.map": "{}" });
    expect(r.code).toBe(1);
    expect(r.out).toContain("app.js.map: source map file");
  });
});

describe("check-leaks noindex rule", () => {
  it("fails on an HTML page without noindex while NOINDEX is on", () => {
    const r = run("no-noindex", { "page.html": "<!doctype html><html><head><title>x</title></head><body>ok</body></html>\n" });
    expect(r.code).toBe(1);
    expect(r.out).toContain("page.html: page without noindex");
  });
});

describe("check-leaks shared text", () => {
  it("does not flag text a hold entry shares with a public entry", () => {
    const pub = claims.find((c) => c.visibility === "open" && c.evidence?.length);
    const shared = pub.evidence[0].note.vi;
    const r = run("shared-note", { "index.html": page(shared) });
    expect(r.out).toContain("check-leaks: OK");
    expect(r.code).toBe(0);
  });
});
