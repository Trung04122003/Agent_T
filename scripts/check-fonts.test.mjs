import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

// ROADMAP 27.6: the font check passes on the real faces and fails when a glyph is missing.
const run = (...extra) => spawnSync(process.execPath, ["tools/check-fonts.mjs", ...extra], { encoding: "utf8" });

describe("check-fonts", () => {
  it("passes: every reading profile draws the Vietnamese test text", () => {
    const r = run();
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("check-fonts: OK");
    for (const p of ["ho-so", "bien-ban", "de-doc", "may-chu"]) expect(r.stdout).toContain(`ok   ${p}`);
  });

  it("fails when a character has no glyph (a CJK character none of the faces has)", () => {
    const r = run("中");
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("misses 1: 中");
  });
});
