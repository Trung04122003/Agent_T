// Reading directions ("lens", P7): reorder ledger rows by weight without touching claims.json.
export type Lens = { id: string; weights: Record<string, number> };

/** Stable: higher weight first, ties (and unweighted ids) keep their original order. */
export function orderByLens(ids: string[], lens: Lens | undefined): string[] {
  if (!lens) return ids;
  return ids
    .map((id, i) => ({ id, i, w: lens.weights[id] ?? 0 }))
    .sort((a, b) => b.w - a.w || a.i - b.i)
    .map((x) => x.id);
}

/** Weights limited to ids shown on the page, so no hidden (hold) id ever reaches the HTML. */
export function publicWeights(lens: Lens, publicIds: string[]): Lens {
  const allowed = new Set(publicIds);
  return { id: lens.id, weights: Object.fromEntries(Object.entries(lens.weights).filter(([id]) => allowed.has(id))) };
}
