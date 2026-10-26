import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const dir = join("test-results", "check-ledger");

function run(name, entries) {
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${name}.json`);
  writeFileSync(file, JSON.stringify(entries));
  const r = spawnSync(process.execPath, ["scripts/check-ledger.mjs", file], { encoding: "utf8" });
  return { code: r.status, out: r.stdout + r.stderr };
}

const verified = {
  id: "role-x",
  kind: "role",
  visibility: "open",
  status: "confirmed",
  org: { vi: "Tổ chức X", en: "Org X" },
  title: null,
  period: { start: "2024", end: null },
  teaser: null,
  summary: null,
  evidence: [{ type: "reference", note: { vi: "n", en: "n" } }],
};
const hold = { ...verified, id: "hold-x", visibility: "hold", status: "needs-decision", period: null, evidence: [] };
const classified = { id: "c-x", kind: "classified", status: "needs-decision", label: { vi: "Nhãn", en: "Label" } };

describe("check-ledger", () => {
  it("passes when every open entry is verified (hold and classified ignored)", () => {
    const r = run("ok", [verified, hold, classified]);
    expect(r.out).toContain("check-ledger: OK");
    expect(r.code).toBe(0);
  });

  it("fails and lists open entries that are unverified or incomplete", () => {
    const r = run("bad", [verified, { ...verified, id: "role-y", status: "needs-evidence", period: null }]);
    expect(r.code).toBe(1);
    expect(r.out).toContain("role-y: status is \"needs-evidence\"");
    expect(r.out).toContain("open entry needs period");
    expect(r.out).not.toContain("role-x:");
  });

  it("fails on schema errors such as duplicate ids", () => {
    const r = run("dup", [verified, verified]);
    expect(r.code).toBe(1);
    expect(r.out).toContain("duplicate id");
  });
});

describe("approval gate (ROADMAP 9.6)", () => {
  const prudential = {
    ...verified,
    id: "role-prudential",
    org: { vi: "Prudential Việt Nam", en: "Prudential Vietnam" },
  };

  it("fails a production build when Prudential is open without approval", () => {
    const r = run("approval-missing", [prudential]);
    expect(r.code).toBe(1);
    expect(r.out).toContain("role-prudential: needs approval from Prudential");
  });

  it("passes once approval is recorded, and ignores it while on hold", () => {
    expect(run("approval-ok", [{ ...prudential, approval: { by: "Compliance", on: "2026-11-01" } }]).code).toBe(0);
    expect(run("approval-hold", [{ ...prudential, visibility: "hold" }]).code).toBe(0);
  });

  it("catches DFL24 by either language", () => {
    const dfl = { ...verified, id: "role-dfl", org: { vi: "Phòng thí nghiệm", en: "DFL24 (Danang Fintech Lab)" } };
    expect(run("approval-dfl", [dfl]).out).toContain("needs approval from DFL24");
  });
});
