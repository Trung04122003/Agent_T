import { getCollection } from "astro:content";
import { readFileSync } from "node:fs";
import { fileCode, inFileOrder, publicClaims } from "./ledger";
import { METRICS_FILE } from "./paths";
import type { Claim } from "./schema";

type Metric = { id: string; source: string };

/**
 * Give each figure the file code of the entry it comes from. A figure whose source is not a public,
 * open entry is an error: it could not be traced on the page (and could point at a hold entry).
 */
export function traceMetrics<M extends Metric>(metrics: M[], claims: Claim[]): (M & { code: string })[] {
  const rows = publicClaims(claims);
  return metrics.map((m) => {
    const i = rows.findIndex((c) => c.id === m.source && c.kind !== "classified");
    if (i < 0) throw new Error(`content/metrics.json: "${m.id}" has source "${m.source}", which is not an open entry`);
    return { ...m, code: fileCode(i) };
  });
}

/** The owner's result figures (ROADMAP 20.3), in file order, traced to their entries. */
export async function tracedMetrics(claims: Claim[]) {
  const order = (JSON.parse(readFileSync(METRICS_FILE, "utf8")) as { id: string }[]).map((m) => m.id);
  // No figure yet: skip the collection, which Astro would report as missing or empty on every page.
  if (order.length === 0) return [];
  const metrics = inFileOrder(
    (await getCollection("metrics")).map((e) => e.data),
    order,
  );
  return traceMetrics(metrics, claims);
}
