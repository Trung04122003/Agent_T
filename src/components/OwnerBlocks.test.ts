import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { beforeAll, describe, expect, it } from "vitest";
import { aar, claim, hasTearSheet, risk, type Claim } from "../lib/schema";
import TearSheet from "./TearSheet.astro";

// ROADMAP 17.1-17.3: owner-written blocks. Claude Code builds the frame; empty means not shown.
const L = (vi: string, en: string) => ({ vi, en });
const project = (tearSheet: unknown): Claim =>
  claim.parse({
    id: "p",
    kind: "project",
    visibility: "open",
    status: "confirmed",
    org: null,
    title: L("Dự án", "Project"),
    period: { start: "2025-09", end: "2025-12" },
    teaser: null,
    summary: null,
    evidence: [],
    tearSheet,
  });

let container: AstroContainer;
beforeAll(async () => {
  container = await AstroContainer.create();
});

describe("17.1 tear sheet", () => {
  it("an empty tear sheet does not render (no placeholder text)", async () => {
    for (const sheet of [{ role: null, scale: null, result: null }, null, undefined]) {
      const html = await container.renderToString(TearSheet, { props: { claim: project(sheet), locale: "vi" } });
      expect(html.trim(), JSON.stringify(sheet)).toBe("");
    }
  });

  it("renders only the written cells, plus time and tier from the entry", async () => {
    const html = await container.renderToString(TearSheet, {
      props: { claim: project({ role: L("Vai trò A", "Role A"), scale: null, result: L("Kết quả B", "Result B") }), locale: "vi" },
    });
    expect(html).toContain('data-cell="role"');
    expect(html).toContain('data-cell="result"');
    expect(html).not.toContain('data-cell="scale"');
    expect(html).toContain('data-cell="time"');
    expect(html).toContain("09/2025 – 12/2025");
    expect(html).toContain('data-cell="evidence"');
  });

  it("belongs to projects only", () => {
    const role = { ...project({ role: L("a", "a"), scale: null, result: null }), kind: "role" };
    expect(claim.safeParse(role).success).toBe(false);
    expect(hasTearSheet({ role: null, scale: null, result: null })).toBe(false);
    expect(hasTearSheet({ role: null, scale: L("a", "a"), result: null })).toBe(true);
  });
});

describe("17.2 after-action review", () => {
  const full = { planned: L("a", "a"), actual: L("b", "b"), whyDifferent: L("c", "c"), nextTime: L("d", "d") };
  it("needs all four fields, or none", () => {
    expect(aar.safeParse(full).success).toBe(true);
    for (const k of Object.keys(full)) {
      const { [k as keyof typeof full]: _gone, ...three } = full;
      expect(aar.safeParse(three).success, `without ${k}`).toBe(false);
    }
    expect(aar.safeParse({ ...full, extra: L("e", "e") }).success).toBe(false);
    expect(claim.safeParse({ ...project(null), aar: undefined }).success).toBe(true);
  });
});

describe("17.3 limits and risks", () => {
  it("each item is a risk and its mitigation, both languages", () => {
    expect(risk.safeParse({ id: "r1", risk: L("a", "a"), mitigation: L("b", "b") }).success).toBe(true);
    expect(risk.safeParse({ id: "r1", risk: L("a", "a") }).success).toBe(false);
    expect(risk.safeParse({ id: "r1", risk: { vi: "a" }, mitigation: L("b", "b") }).success).toBe(false);
  });
});
