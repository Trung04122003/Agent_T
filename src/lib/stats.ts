// Figures for the Giai mat "data floor" (ROADMAP 14.1, 14.3). Every number is computed from
// content/claims.json (public entries only, so `hold` never counts) and the build date.
import { tierOf, type Tier } from "./evidence";
import { publicClaims } from "./ledger";
import type { Claim } from "./schema";

type Period = { start: string; end: string | null; ongoing?: true | undefined };

/** "YYYY-MM" -> months since year 0; null when the month is not given. */
function monthIndex(point: string): number | null {
  const [y, m] = point.split("-").map(Number);
  return y === undefined || m === undefined || Number.isNaN(m) ? null : y * 12 + (m - 1);
}

function builtIndex(built: Date): number {
  return built.getUTCFullYear() * 12 + built.getUTCMonth();
}

/**
 * Length of a period in whole months (end minus start, as the owner counts: 06/2023 - 02/2024
 * is 8). Ongoing periods run to the build month. Null when it cannot be known (no month, no end).
 */
export function durationMonths(period: Period, built: Date): number | null {
  const start = monthIndex(period.start);
  const end = period.ongoing ? builtIndex(built) : period.end ? monthIndex(period.end) : null;
  if (start === null || end === null || end < start) return null;
  return end - start;
}

export type LedgerStats = {
  /** Rows shown in the ledger: open entries plus classified labels. */
  entries: number;
  open: number;
  classified: number;
  /** Whole years from the earliest start to the build month, and that start ("YYYY-MM"). */
  years: number | null;
  since: string | null;
  ongoing: number;
  tiers: Record<Tier, number>;
};

export function ledgerStats(claims: Claim[], built: Date): LedgerStats {
  const rows = publicClaims(claims);
  const open = rows.filter((c) => c.kind !== "classified");
  const starts = open
    .map((c) => c.period?.start ?? null)
    .filter((s): s is string => s !== null && monthIndex(s) !== null)
    .sort();
  const since = starts[0] ?? null;
  const tiers: Record<Tier, number> = { T1: 0, T2: 0, T3: 0 };
  for (const c of open) tiers[tierOf(c.evidence)]++;
  return {
    entries: rows.length,
    open: open.length,
    classified: rows.length - open.length,
    years: since === null ? null : Math.floor((builtIndex(built) - monthIndex(since)!) / 12),
    since,
    ongoing: open.filter((c) => c.period?.ongoing).length,
    tiers,
  };
}
