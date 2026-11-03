// The ledger's entries, as every page that shows them must read them (ROADMAP-v4 rule 2): the
// claims collection (`hold` dropped by the loader, internal fields stripped by the schema), in the
// owner's order from the content file. The dossier and Agent T City both call this; neither reads
// the content file for anything else.
import { readFileSync } from "node:fs";
import { getCollection } from "astro:content";
import { inFileOrder } from "./ledger";
import { CLAIMS_FILE } from "./paths";
import type { Claim } from "./schema";

export async function ledgerEntries(): Promise<Claim[]> {
  const idsInFile = (JSON.parse(readFileSync(CLAIMS_FILE, "utf8")) as { id: string }[]).map((c) => c.id);
  return inFileOrder(
    (await getCollection("claims")).map((e) => e.data),
    idsInFile,
  );
}
