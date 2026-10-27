import { getCollection } from "astro:content";
import { readFileSync } from "node:fs";
import { inFileOrder } from "./ledger";
import { RISKS_FILE } from "./paths";

/** The owner's "Limits and risks" (ROADMAP 17.3) in file order; collections do not keep it. */
export async function orderedRisks() {
  const order = (JSON.parse(readFileSync(RISKS_FILE, "utf8")) as { id: string }[]).map((r) => r.id);
  return inFileOrder(
    (await getCollection("risks")).map((e) => e.data),
    order,
  );
}
