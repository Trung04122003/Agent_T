// Concurrent commitments over time (ROADMAP 15.1, UX-v2 section 4). The only input is the
// `period` of open entries: a month counts an entry from its start month through its end month;
// ongoing entries run to the build month. Entries whose period has no month (year only) or no
// end are left out rather than guessed. No money, no rates: just how many at once.
import { publicClaims } from "./ledger";
import type { Claim } from "./schema";

/**
 * Entries the chart counts: public, open, with a period, and not paused (ROADMAP 20.2: a paused
 * entry is not a commitment being carried now).
 */
export function chartEntries(claims: Claim[]): Extract<Claim, { kind: "role" | "education" | "project" }>[] {
  return publicClaims(claims).flatMap((c) => (c.kind !== "classified" && c.period && !c.paused ? [c] : []));
}

export type Span = { id: string; start: string; end: string | null; ongoing?: true | undefined };
/** A run of consecutive months with the same set of entries ("YYYY-MM", both inclusive). */
export type Segment = { from: string; to: string; count: number; ids: string[] };
export type Concurrency = { months: string[]; counts: number[]; segments: Segment[]; max: number };

const toIndex = (p: string): number | null => {
  const [y, m] = p.split("-").map(Number);
  return y === undefined || m === undefined || Number.isNaN(m) ? null : y * 12 + (m - 1);
};
const toMonth = (i: number): string => `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`;

export function concurrency(spans: Span[], built: Date): Concurrency {
  const now = built.getUTCFullYear() * 12 + built.getUTCMonth();
  const known = spans
    .map((s) => ({ id: s.id, a: toIndex(s.start), b: s.ongoing ? now : s.end ? toIndex(s.end) : null }))
    .filter((s): s is { id: string; a: number; b: number } => s.a !== null && s.b !== null && s.b >= s.a);
  if (known.length === 0) return { months: [], counts: [], segments: [], max: 0 };

  const first = Math.min(...known.map((s) => s.a));
  const last = Math.max(now, ...known.map((s) => s.b));
  const months: string[] = [];
  const counts: number[] = [];
  const segments: Segment[] = [];
  for (let i = first; i <= last; i++) {
    const ids = known.filter((s) => s.a <= i && i <= s.b).map((s) => s.id);
    months.push(toMonth(i));
    counts.push(ids.length);
    const prev = segments.at(-1);
    if (prev && prev.ids.join() === ids.join()) prev.to = toMonth(i);
    else segments.push({ from: toMonth(i), to: toMonth(i), count: ids.length, ids });
  }
  return { months, counts, segments, max: Math.max(...counts) };
}
