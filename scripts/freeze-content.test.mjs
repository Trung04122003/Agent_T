import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { contentHashes, FREEZE_FILE, reconcile } from "./freeze-content.mjs";

// ROADMAP 19.3: content/ is frozen; any change must be deliberate (then: pnpm freeze:content).
describe("content freeze", () => {
  it("content/ matches the freeze in docs/content-freeze.json", () => {
    const frozen = JSON.parse(readFileSync(FREEZE_FILE, "utf8")).files;
    const changed = Object.keys({ ...frozen, ...contentHashes() }).filter((f) => frozen[f] !== contentHashes()[f]);
    expect(changed, "content changed since the freeze: review it, then run pnpm freeze:content").toEqual([]);
  });

  it("every open entry that needs an approval has one; hold entries stay hold", () => {
    const rows = reconcile();
    expect(rows.filter((r) => r.shows === "open" && r.approval.endsWith("MISSING"))).toEqual([]);
    expect(rows.find((r) => r.id === "role-dfl24-ic")?.shows).toBe("HOLD (never built)");
    // Opened by the owner on 2026-10-29, approved by the office manager (DECISIONS-v3.md).
    const prudential = rows.find((r) => r.id === "role-prudential");
    expect(prudential?.shows).toBe("open");
    expect(prudential?.approval).toMatch(/^Prudential: .+, 2026-07-01$/);
  });
});
