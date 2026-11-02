import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { chartEntries } from "./commitments";
import { tierOf } from "./evidence";
import { claim, claims as claimsSchema, type Claim } from "./schema";
import { durationMonths, experienceBalance, tierSpread } from "./stats";

// ROADMAP 14.3 / 20.2 / 20.3: every figure traces back to content/, and paused entries do not run.
const raw = JSON.parse(readFileSync("content/claims.json", "utf8")) as Array<{
  id: string;
  kind: string;
  visibility?: string;
  paused?: boolean;
  evidence?: { type: string; url?: string; consent?: boolean }[];
}>;
const built = new Date("2026-10-26T12:00:00Z");

describe("durationMonths", () => {
  it("counts end minus start, as the owner does (06/2023 - 02/2024 = 8)", () => {
    expect(durationMonths({ start: "2023-06", end: "2024-02" }, built)).toBe(8);
  });
  it("runs ongoing periods to the build month", () => {
    expect(durationMonths({ start: "2025-06", end: null, ongoing: true }, built)).toBe(16);
  });
  it("is null when it cannot be known", () => {
    expect(durationMonths({ start: "2025", end: "2026-01" }, built)).toBeNull();
    expect(durationMonths({ start: "2025-03", end: null }, built)).toBeNull();
  });
});

describe("20.3 tier spread on the real content", () => {
  it("counts every shown open entry once, hold never", () => {
    const open = raw.filter((c) => c.kind !== "classified" && c.visibility !== "hold");
    const expected = { T1: 0, T2: 0, T3: 0 };
    for (const c of open) expected[tierOf((c.evidence ?? []) as Parameters<typeof tierOf>[0])]++;
    // Nothing is held back in the real file since 2026-11-02 (the IC team role was removed): a
    // made-up held copy of an open entry keeps the case exercised; it must not be counted.
    const source = raw.find((c) => c.kind !== "classified" && c.visibility === "open")!;
    const held = { ...source, id: "role-held-test", visibility: "hold" };
    expect(tierSpread(claimsSchema.parse([...raw, held]))).toEqual(expected);
  });
});

describe("20.2 paused entries", () => {
  const entry = (id: string, paused?: true): Claim =>
    claim.parse({
      id,
      kind: "role",
      visibility: "open",
      status: "confirmed",
      org: { vi: id, en: id },
      title: null,
      period: { start: "2025-06", end: null, ongoing: true },
      teaser: null,
      summary: null,
      evidence: [],
      ...(paused ? { paused } : {}),
    });

  it("schema accepts only paused: true", () => {
    expect(claim.safeParse({ ...entry("a"), paused: false }).success).toBe(false);
  });

  it("the commitment chart leaves paused entries out", () => {
    expect(chartEntries([entry("running"), entry("on-hold", true)]).map((c) => c.id)).toEqual(["running"]);
  });

  it("Bluesea is paused in content/ and so out of the chart", () => {
    expect(raw.find((c) => c.id === "role-bluesea")?.paused).toBe(true);
    expect(chartEntries(claimsSchema.parse(raw)).map((c) => c.id)).not.toContain("role-bluesea");
  });
});

describe("28.4 experience balance", () => {
  const role = (id: string, start: string, end: string | null, extra: Record<string, unknown> = {}): Claim =>
    claim.parse({
      id,
      kind: "role",
      visibility: "open",
      status: "confirmed",
      org: { vi: id, en: id },
      title: null,
      period: { start, end, ...(end === null ? { ongoing: true } : {}) },
      teaser: null,
      summary: null,
      evidence: [],
      ...extra,
    });
  const at = new Date("2025-01-15T00:00:00Z"); // build month 2025-01

  it("a lone entry's balance is its own length (owner's counting: 06/2023 - 02/2024 is 8)", () => {
    expect(experienceBalance([role("a", "2023-06", "2024-02")], at).get("a")).toBe(8);
  });

  it("overlapping months count once", () => {
    // a: 2024-01..2024-06 (5 months), b: 2024-04..2024-09 (5), overlap 2024-04..2024-05.
    const b = experienceBalance([role("a", "2024-01", "2024-06"), role("b", "2024-04", "2024-09")], at);
    expect(b.get("a")).toBe(5); // up to a's end: Jan-May
    expect(b.get("b")).toBe(8); // Jan-Aug, not 5 + 5
  });

  it("a gap adds nothing; an entry inside another adds nothing", () => {
    const b = experienceBalance(
      [role("a", "2023-01", "2023-04"), role("inner", "2023-02", "2023-03"), role("c", "2023-10", "2023-12")],
      at,
    );
    expect(b.get("inner")).toBe(2); // Jan-Feb of a
    expect(b.get("a")).toBe(3);
    expect(b.get("c")).toBe(5); // 3 + Oct-Nov; the gap Apr-Sep counts zero
  });

  it("ongoing entries run to the build month; paused entries add nothing but still show a balance", () => {
    const b = experienceBalance([role("a", "2024-07", null), role("p", "2024-01", null, { paused: true })], at);
    expect(b.get("a")).toBe(6); // 2024-07 .. 2024-12
    expect(b.get("p")).toBe(6); // its own months are not counted
  });

  it("no month, no balance; classified entries never get one", () => {
    expect(experienceBalance([role("y", "2023", "2024-01")], at).has("y")).toBe(false);
  });
});
