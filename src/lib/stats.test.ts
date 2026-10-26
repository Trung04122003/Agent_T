import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { tierOf } from "./evidence";
import { claims as claimsSchema } from "./schema";
import { durationMonths, ledgerStats } from "./stats";

// ROADMAP 14.3: every figure must trace back to content/. The expectations below are recomputed
// straight from the raw JSON, independently of stats.ts.
const raw = JSON.parse(readFileSync("content/claims.json", "utf8")) as Array<{
  kind: string;
  visibility?: string;
  period?: { start: string; end: string | null; ongoing?: boolean } | null;
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

describe("ledgerStats on the real content", () => {
  const stats = ledgerStats(claimsSchema.parse(raw), built);
  const shown = raw.filter((c) => c.kind === "classified" || c.visibility !== "hold");
  const open = shown.filter((c) => c.kind !== "classified");

  it("counts only what the ledger shows (hold never counts)", () => {
    expect(stats.entries).toBe(shown.length);
    expect(stats.open).toBe(open.length);
    expect(stats.classified).toBe(shown.length - open.length);
    expect(raw.some((c) => c.visibility === "hold")).toBe(true); // the case is really exercised
  });

  it("years on file run from the earliest public start to the build month", () => {
    const first = open.map((c) => c.period?.start).filter((s): s is string => !!s && s.includes("-")).sort()[0]!;
    const [y, m] = first.split("-").map(Number) as [number, number];
    expect(stats.since).toBe(first);
    expect(stats.years).toBe(Math.floor((2026 * 12 + 9 - (y * 12 + m - 1)) / 12));
  });

  it("ongoing and evidence tiers match the entries", () => {
    expect(stats.ongoing).toBe(open.filter((c) => c.period?.ongoing).length);
    const tiers = { T1: 0, T2: 0, T3: 0 };
    for (const c of open) tiers[tierOf((c.evidence ?? []) as Parameters<typeof tierOf>[0])]++;
    expect(stats.tiers).toEqual(tiers);
    expect(stats.tiers.T1 + stats.tiers.T2 + stats.tiers.T3).toBe(stats.open);
  });
});
