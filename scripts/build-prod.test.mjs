import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
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
    expect(html).not.toContain("UNVERIFIED");
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
