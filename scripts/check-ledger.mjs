// Production ledger gate (SPEC section 6, ROADMAP 9.6-9.7): every `open` entry must be confirmed by
// the owner, complete (org or title, plus period) and, for listed organisations, approved.
// Prints ids and reasons only. Exit 1 if any fail.
// Usage: node scripts/check-ledger.mjs [claims.json]   (default: $CUPID_CLAIMS or content/claims.json)
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { approvalFor } from "../src/lib/approval.ts";
import { claims, publishedClaim } from "../src/lib/schema.ts";

const root = resolve(fileURLToPath(import.meta.url), "..", "..");
const file = resolve(process.argv[2] ?? process.env["CUPID_CLAIMS"] ?? join(root, "content", "claims.json"));

const parsed = claims.safeParse(JSON.parse(readFileSync(file, "utf8")));
if (!parsed.success) {
  console.error("check-ledger: claims.json does not match the schema:");
  for (const i of parsed.error.issues) console.error(`  [${i.path.join(".")}] ${i.message}`);
  process.exit(1);
}

const failing = [];
for (const c of parsed.data) {
  if (c.kind === "classified" || c.visibility !== "open") continue;
  const reasons = [];
  if (c.status !== "confirmed") reasons.push(`status is "${c.status}", needs "confirmed"`);
  const approver = approvalFor(c);
  if (approver && !c.approval) reasons.push(`needs approval from ${approver} (add approval: { by, on })`);
  const full = publishedClaim.safeParse(c);
  if (!full.success) for (const i of full.error.issues) reasons.push(i.message);
  if (reasons.length) failing.push({ id: c.id, reasons });
}

if (failing.length) {
  console.error(`check-ledger: ${failing.length} open entr${failing.length === 1 ? "y is" : "ies are"} not publishable:`);
  for (const f of failing) console.error(`  - ${f.id}: ${f.reasons.join("; ")}`);
  console.error("Production build blocked. Verify these entries or set visibility to \"hold\".");
  process.exit(1);
}
console.log("check-ledger: OK, all open entries confirmed.");
