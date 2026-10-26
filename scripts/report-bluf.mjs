// List the public ledger rows that still have no BLUF, as questions for the owner (ROADMAP 11.3).
// Read-only: it never writes a BLUF. Usage: node scripts/report-bluf.mjs
import { readFileSync } from "node:fs";

const claims = JSON.parse(readFileSync(process.env["CUPID_CLAIMS"] ?? "content/claims.json", "utf8"));
const missing = claims.filter((c) => c.kind !== "classified" && c.visibility === "open" && !c.bluf);
const label = (c) => [c.org?.vi, c.title?.vi].filter(Boolean).join(" — ");

console.log(`report-bluf: ${missing.length} public row(s) without a BLUF (one sentence, max 90 characters, vi + en):`);
for (const c of missing) console.log(`  - ${c.id}: ${label(c)}`);
