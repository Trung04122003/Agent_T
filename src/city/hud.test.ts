import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { dropHeld, publicClaims } from "../lib/ledger";
import { orderByLens, publicWeights } from "../lib/lens";
import { claims as claimsSchema, lenses as lensesSchema } from "../lib/schema";
import { createStates, nextObjective, STATE_KEY, type CityText } from "./hud";

// ROADMAP-v4 37.2 and 37.4. The ids and weights come the way the city page gets them (route.astro).
const raw = JSON.parse(readFileSync("content/claims.json", "utf8")) as { id: string; visibility?: string }[];
const ledger = publicClaims(claimsSchema.parse(dropHeld(raw)));
const order = ledger.map((c) => c.id);
const classified = new Set(ledger.filter((c) => c.kind === "classified").map((c) => c.id));
const lensList = lensesSchema.parse(JSON.parse(readFileSync("content/lenses.json", "utf8"))).lenses;
const text: Pick<CityText, "order" | "lenses"> = { order, lenses: Object.fromEntries(lensList.map((l) => [l.id, orderByLens(order, publicWeights(l, order))])) };

/** A Storage that keeps values in a Map, or throws on every call when blocked. */
function storage(blocked = false): Storage {
  const m = new Map<string, string>();
  const no = () => {
    throw new DOMException("blocked", "SecurityError");
  };
  return {
    getItem: (k) => (blocked ? no() : (m.get(k) ?? null)),
    setItem: (k, v) => (blocked ? no() : void m.set(k, v)),
    removeItem: (k) => void m.delete(k),
    clear: () => m.clear(),
    key: () => null,
    get length() {
      return m.size;
    },
  };
}

describe("district states (37.2)", () => {
  it("only rise, persist per tab, and count the lights", () => {
    const st = storage();
    const a = createStates(order, () => st);
    expect(a.get(order[0]!)).toBe("sealed");
    expect(a.raise(order[0]!, "briefed")).toBe(true);
    expect(a.raise(order[0]!, "scouted")).toBe(false); // never lowered
    expect(a.lit).toBe(1);
    expect(JSON.parse(st.getItem(STATE_KEY)!)[order[0]!]).toBe("briefed");
    expect(createStates(order, () => st).get(order[0]!)).toBe("briefed");
  });

  it("work with storage blocked (or missing): in memory only, nothing thrown", () => {
    const blocked = createStates(order, () => storage(true));
    expect(blocked.raise(order[1]!, "declassified")).toBe(true);
    expect(blocked.get(order[1]!)).toBe("declassified");
    const none = createStates(order, () => null);
    expect(none.raise(order[1]!, "scouted")).toBe(true);
  });

  it("ignore what they do not know (a stale or tampered value)", () => {
    const st = storage();
    st.setItem(STATE_KEY, JSON.stringify({ [order[0]!]: "unlocked", "not-an-entry": "briefed" }));
    const s = createStates(order, () => st);
    expect(s.get(order[0]!)).toBe("sealed");
    expect(s.lit).toBe(0);
  });
});

describe("compass (37.4)", () => {
  it("the first objective follows the lens: Partner, Client, Curious, and none", () => {
    const fresh = () => createStates(order, () => null);
    expect(nextObjective(text, "partner", fresh(), classified)).toBe("role-bbe-ldc");
    expect(nextObjective(text, "client", fresh(), classified)).toBe("role-prudential");
    expect(nextObjective(text, "curious", fresh(), classified)).toBe("project-air-quality");
    expect(nextObjective(text, null, fresh(), classified)).toBe(order[0]);
  });

  it("moves on once briefed, then to what is not yet declassified; the Vault is never declassified", () => {
    const s = createStates(order, () => null);
    for (const id of order) s.raise(id, "briefed");
    const next = nextObjective(text, null, s, classified);
    expect(next).toBe(order[0]);
    for (const id of order) if (!classified.has(id)) s.raise(id, "declassified");
    expect(nextObjective(text, null, s, classified)).toBeNull();
  });
});
