import type { Claim } from "./schema";

type Period = NonNullable<Extract<Claim, { kind: "classified" }>["period"]>;

/** File code shown on each row: 01, 02, ... (UX section 2). */
export function fileCode(index: number): string {
  return String(index + 1).padStart(2, "0");
}

/** "YYYY-MM" -> "MM/YYYY"; "YYYY" stays. Never a full day, so no dd/mm/yyyy (check-leaks). */
function formatPoint(point: string): string {
  const [year, month] = point.split("-");
  return month ? `${month}/${year}` : year!;
}

export function formatPeriod(period: Period, presentLabel: string): string {
  const start = formatPoint(period.start);
  if (period.ongoing) return `${start} – ${presentLabel}`;
  if (period.end === null) return start;
  return `${start} – ${formatPoint(period.end)}`;
}

/**
 * The loader's filter (content.config.ts): `hold` entries are dropped before validation, so they
 * never reach a page. Shared so that tests and the city read exactly what the ledger reads.
 */
export function dropHeld<T extends { visibility?: string }>(raw: T[]): T[] {
  return raw.filter((c) => c.visibility !== "hold");
}

/** Entries that may be rendered: `hold` never is (SPEC section 6), even if one slips past the loader. */
export function publicClaims<T extends Claim>(claims: T[]): T[] {
  return claims.filter((c) => c.kind === "classified" || c.visibility !== "hold");
}

/** Rows follow the order of claims.json (the owner's order); collections do not keep it. */
export function inFileOrder<T extends { id: string }>(items: T[], idsInFile: string[]): T[] {
  const rank = new Map(idsInFile.map((id, i) => [id, i]));
  return [...items].sort((a, b) => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity));
}
