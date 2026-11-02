import { describe, expect, it } from "vitest";
import claimsFile from "../../content/claims.json";
import { evidenceFlow, type FlowEntry } from "./evidence-flow";

const doc = (note: string) => ({ type: "document-on-request" as const, note: `${note}, available on request` });
const link = (note: string) => ({ type: "link" as const, url: "https://example.org/x", note });

describe("evidence trail layout (owner request 2026-11-01)", () => {
  const flow = evidenceFlow([
    { id: "a", name: "A", evidence: [doc("Certificate")] },
    { id: "b", name: "B", evidence: [link("Code FE"), link("Code BE")] },
    { id: "c", name: "C", evidence: [doc("Licence")] },
    { id: "d", name: "D", evidence: [doc("Certificate")] },
    { id: "e", name: "E", evidence: [] },
  ]);

  it("one unit per (entry, source) pair, the same in every column", () => {
    const sum = (ns: { units: number }[]) => ns.reduce((n, x) => n + x.units, 0);
    expect(flow.units).toBe(5);
    expect(sum(flow.entries)).toBe(5);
    expect(sum(flow.sources)).toBe(5);
    expect(sum(flow.tiers)).toBe(5);
  });

  it("merges a source shared by several entries, names it without 'available on request'", () => {
    const cert = flow.sources.find((s) => s.name === "Certificate")!;
    expect(cert.entries).toEqual(["a", "d"]);
    expect(cert.units).toBe(2);
    expect(cert.tier).toBe("T2");
  });

  it("orders by tier, then by use, and entries after their source: no ribbon crosses", () => {
    expect(flow.sources.map((s) => s.name)).toEqual(["Certificate", "Licence", "Code FE", "Code BE"]);
    expect(flow.entries.map((e) => e.id)).toEqual(["a", "d", "c", "b"]); // "e" has no evidence
    expect(flow.tiers.map((t) => t.tier)).toEqual(["T2", "T3"]);
    for (let i = 1; i < flow.links.length; i++) {
      expect(flow.links[i]!.from).toBeGreaterThan(flow.links[i - 1]!.from);
      expect(flow.links[i]!.to).toBeGreaterThan(flow.links[i - 1]!.to);
    }
  });

  it("feeds land in their tier, one after another", () => {
    expect(flow.feeds.map((f) => [f.tier, f.to, f.units])).toEqual([
      ["T2", 0, 2],
      ["T2", 2, 1],
      ["T3", 3, 1],
      ["T3", 4, 1],
    ]);
  });

  it("the real file: every open entry with evidence is on the trail, nothing held or classified", () => {
    type Raw = { id: string; kind: string; visibility?: string; evidence?: (Omit<FlowEntry["evidence"][number], "note"> & { note: { vi: string } })[] };
    const open = (claimsFile as Raw[]).filter((c) => c.kind !== "classified" && c.visibility !== "hold" && (c.evidence?.length ?? 0) > 0);
    const real = evidenceFlow(open.map((c) => ({ id: c.id, name: c.id, evidence: c.evidence!.map((e) => ({ ...e, note: e.note.vi })) })));
    expect(new Set(real.entries.map((e) => e.id))).toEqual(new Set(open.map((c) => c.id)));
    const hidden = new Set((claimsFile as Raw[]).filter((c) => c.kind === "classified" || c.visibility === "hold").map((c) => c.id));
    expect(real.entries.some((e) => hidden.has(e.id))).toBe(false);
  });
});
