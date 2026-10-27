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

/**
 * Spread of the open entries over the evidence tiers: the one figure the header block keeps
 * (ROADMAP 20.3 dropped "entries on file" and "years on file", which measured the book, not the
 * work). Everything else there comes from the owner's content/metrics.json.
 */
export function tierSpread(claims: Claim[]): Record<Tier, number> {
  const tiers: Record<Tier, number> = { T1: 0, T2: 0, T3: 0 };
  for (const c of publicClaims(claims)) if (c.kind !== "classified") tiers[tierOf(c.evidence)]++;
  return tiers;
}
