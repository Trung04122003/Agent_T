import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { chartEntries } from "./commitments";
import { tierOf } from "./evidence";
import { claim, claims as claimsSchema, type Claim } from "./schema";
import { durationMonths, tierSpread } from "./stats";

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
    expect(tierSpread(claimsSchema.parse(raw))).toEqual(expected);
    expect(raw.some((c) => c.visibility === "hold")).toBe(true); // the case is really exercised
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
