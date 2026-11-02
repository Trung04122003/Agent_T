// Evidence trail (owner request 2026-11-01): every open entry, the named sources that back it, and
// the tier each source gives (ROADMAP 9.7). One unit is one (entry, source) pair, so the three
// columns hold the same number of units and the ribbons never need scaling. Pure layout, in units:
// the component turns it into pixels.
import { evidenceName, tierOf, type Tier } from "./evidence";

type Evidence = { type: "link" | "document-on-request" | "reference"; url?: string | undefined; consent?: boolean | undefined; note: string };
export type FlowEntry = { id: string; name: string; evidence: readonly Evidence[] };
/** start: first unit from the top of its column; units: its height; i: its place in the column. */
type Node = { start: number; units: number; i: number };
export type Flow = {
  units: number;
  entries: (Node & { id: string; name: string })[];
  sources: (Node & { key: string; name: string; tier: Tier; url?: string; entries: string[] })[];
  tiers: (Node & { tier: Tier; entries: string[] })[];
  /** entry -> source: one unit, at `from` in the entry and `to` in the source. */
  links: { entry: string; source: string; from: number; to: number }[];
  /** source -> tier: the source's whole height, landing at `to` in the tier. */
  feeds: { source: string; tier: Tier; from: number; to: number; units: number; entries: string[] }[];
};

const TIERS: Tier[] = ["T1", "T2", "T3"];

export function evidenceFlow(input: readonly FlowEntry[]): Flow {
  // Sources by name (the same certificate backs several entries), each with its own tier.
  const byKey = new Map<string, { key: string; name: string; tier: Tier; url?: string; entries: string[] }>();
  for (const e of input) {
    for (const ev of e.evidence) {
      const name = evidenceName(ev.note);
      const key = `${ev.type}|${name}`;
      const s = byKey.get(key) ?? { key, name, tier: tierOf([ev]), ...(ev.url ? { url: ev.url } : {}), entries: [] };
      s.entries.push(e.id);
      byKey.set(key, s);
    }
  }
  // Order: tier from low to high, then the most used source first. Entries follow their first
  // source, so no two ribbons cross; ties keep the file's order.
  const sources = [...byKey.values()].sort((a, b) => TIERS.indexOf(a.tier) - TIERS.indexOf(b.tier) || b.entries.length - a.entries.length);
  const rank = (e: FlowEntry) => Math.min(...e.evidence.map((ev) => sources.findIndex((s) => s.key === `${ev.type}|${evidenceName(ev.note)}`)));
  const entries = input.filter((e) => e.evidence.length > 0).map((e, n) => ({ e, n })).sort((a, b) => rank(a.e) - rank(b.e) || a.n - b.n).map(({ e }) => e);

  let at = 0;
  const entryNodes = entries.map((e, i) => {
    const node = { id: e.id, name: e.name, start: at, units: e.evidence.length, i };
    at += node.units;
    return node;
  });
  at = 0;
  const sourceNodes = sources.map((s, i) => {
    const node = { ...s, start: at, units: s.entries.length, i };
    at += node.units;
    return node;
  });
  at = 0;
  const tierNodes = TIERS.flatMap((tier) => {
    const feeding = sourceNodes.filter((s) => s.tier === tier);
    const units = feeding.reduce((n, s) => n + s.units, 0);
    if (!units) return [];
    const node = { tier, start: at, units, entries: [...new Set(feeding.flatMap((s) => s.entries))] };
    at += units;
    return [node];
  }).map((t, i) => ({ ...t, i }));

  // Entry -> source ribbons: each entry's units in source order, each source's units in entry order.
  const used = new Map<string, number>();
  const links = entryNodes.flatMap((node) => {
    const e = entries[node.i]!;
    return e.evidence
      .map((ev) => sourceNodes.find((s) => s.key === `${ev.type}|${evidenceName(ev.note)}`)!)
      .sort((a, b) => a.i - b.i)
      .map((s, k) => {
        const to = s.start + (used.get(s.key) ?? 0);
        used.set(s.key, (used.get(s.key) ?? 0) + 1);
        return { entry: node.id, source: s.key, from: node.start + k, to };
      });
  });
  const filled = new Map<Tier, number>();
  const feeds = sourceNodes.map((s) => {
    const t = tierNodes.find((n) => n.tier === s.tier)!;
    const to = t.start + (filled.get(s.tier) ?? 0);
    filled.set(s.tier, (filled.get(s.tier) ?? 0) + s.units);
    return { source: s.key, tier: s.tier, from: s.start, to, units: s.units, entries: s.entries };
  });
  return { units: at, entries: entryNodes, sources: sourceNodes, tiers: tierNodes, links, feeds };
}
