import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Real builds, end to end (ROADMAP 3.5, 5.2). Test datasets build into test-results/.
// Kept in one file so these builds never run in parallel on the same output folder.
function buildProd(claimsFile) {
  rmSync("test-results/dist-fixture", { recursive: true, force: true });
  const r = spawnSync("pnpm build:prod", {
    shell: true,
    encoding: "utf8",
    env: { ...process.env, CUPID_CLAIMS: claimsFile },
  });
  return { code: r.status, out: r.stdout + r.stderr };
}

describe("pnpm build:prod", () => {
  it("fails while an open entry is not verified, listing it", () => {
    const r = buildProd("e2e/fixtures/claims.json");
    expect(r.code).not.toBe(0);
    expect(r.out).toContain("fx-pending: status is \"needs-evidence\"");
    expect(r.out).toContain("fx-plain");
    expect(r.out).not.toContain("fx-verified:");
    expect(existsSync("test-results/dist-fixture/vi/index.html")).toBe(false);
  }, 120_000);

  it("passes when every open entry is verified, and builds without hold text", () => {
    const r = buildProd("e2e/fixtures/claims-verified.json");
    expect(r.out).toContain("check-ledger: OK");
    expect(r.code).toBe(0);
    const html = readFileSync("test-results/dist-fixture/vi/index.html", "utf8");
    expect(html).toContain('data-claim="fx-verified"');
    expect(html).not.toContain("fx-hold");
    expect(html).not.toContain("UNCONFIRMED");
  }, 120_000);
});

// ROADMAP 5.2: a displayed string without `en` (or `vi`) must fail the real build.
function build(claimsFile) {
  const r = spawnSync("pnpm build", {
    shell: true,
    encoding: "utf8",
    env: { ...process.env, CUPID_CLAIMS: claimsFile },
  });
  return { code: r.status, out: r.stdout + r.stderr };
}

describe("pnpm build and translations", () => {
  it("fails when one en string is removed, naming the entry and field", () => {
    const r = build("e2e/fixtures/claims-missing-en.json");
    expect(r.code).not.toBe(0);
    expect(r.out).toContain("InvalidContentEntryDataError");
    expect(r.out).toContain("fx-verified");
    expect(r.out).toMatch(/title\.en/);
  }, 120_000);

  it("passes on the same dataset with every string translated", () => {
    expect(build("e2e/fixtures/claims-verified.json").code).toBe(0);
  }, 120_000);
});

// ROADMAP-v4 P31.3: Agent T City is built only with PUBLIC_CITY=1 (off in build:prod by default).
// When off, no city route and no link to one anywhere in the output.
function buildCity(flag) {
  rmSync("test-results/dist-fixture", { recursive: true, force: true });
  const env = { ...process.env, CUPID_CLAIMS: "e2e/fixtures/claims-verified.json" };
  delete env["PUBLIC_CITY"];
  if (flag) env["PUBLIC_CITY"] = "1";
  const r = spawnSync("pnpm build:prod", { shell: true, encoding: "utf8", env });
  return { code: r.status, out: r.stdout + r.stderr };
}
function htmlFiles(dir) {
  return readdirSync(dir, { recursive: true })
    .map(String)
    .filter((f) => f.endsWith(".html"))
    .map((f) => join(dir, f));
}

describe("PUBLIC_CITY build flag", () => {
  it("off (the default): no city route, no link to it", () => {
    const r = buildCity(false);
    expect(r.code).toBe(0);
    const out = "test-results/dist-fixture";
    for (const l of ["vi", "en"]) expect(existsSync(join(out, l, "city"))).toBe(false);
    for (const f of htmlFiles(out)) expect(readFileSync(f, "utf8"), f).not.toMatch(/href="[^"]*\/city\b/);
  }, 120_000);

  it("on: the city route exists in every language", () => {
    const r = buildCity(true);
    expect(r.code).toBe(0);
    for (const l of ["vi", "en"]) expect(existsSync(join("test-results/dist-fixture", l, "city", "index.html"))).toBe(true);
  }, 120_000);
});
