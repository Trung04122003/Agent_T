import { describe, expect, it } from "vitest";
import claimsJson from "../../content/claims.json";
import lensesJson from "../../content/lenses.json";
import { orderByLens, publicWeights } from "./lens";
import { lenses as lensesSchema } from "./schema";

const config = lensesSchema.parse(lensesJson);
const publicIds = claimsJson
  .filter((c) => c.kind === "classified" || (c as { visibility?: string }).visibility !== "hold")
  .map((c) => c.id);
const lens = (id: string) => config.lenses.find((l) => l.id === id)!;

describe("lenses (ROADMAP 7.1)", () => {
  it("lenses.json matches the schema and has the three UX directions", () => {
    expect(config.lenses.map((l) => l.id)).toEqual(["partner", "client", "curious"]);
  });

  it("weights only name claims that exist", () => {
    const all = new Set(claimsJson.map((c) => c.id));
    for (const l of config.lenses) expect(Object.keys(l.weights).filter((id) => !all.has(id))).toEqual([]);
  });

  it("orders by weight, then by claims.json order (stable)", () => {
    expect(orderByLens(["a", "b", "c", "d"], { id: "x", weights: { c: 2, d: 2, a: 1 } })).toEqual(["c", "d", "a", "b"]);
    expect(orderByLens(["a", "b"], undefined)).toEqual(["a", "b"]);
  });

  it.each([
    // role-prudential is open since 2026-10-29 (approval in claims.json); curious gives it no
    // weight, so it follows claims.json order there.
    ["partner", ["role-bbe-ldc", "role-jci", "role-bluesea", "role-prudential", "edu-duy-tan", "role-dz-ta", "project-air-quality", "classified-client-files"]],
    ["client", ["role-prudential", "role-bluesea", "classified-client-files", "role-jci", "role-bbe-ldc", "edu-duy-tan", "role-dz-ta", "project-air-quality"]],
    ["curious", ["project-air-quality", "role-dz-ta", "edu-duy-tan", "role-jci", "role-bbe-ldc", "classified-client-files", "role-prudential", "role-bluesea"]],
  ])("%s order", (id, expected) => {
    expect(orderByLens(publicIds, lens(id))).toEqual(expected);
  });

  it("never exposes hidden ids through public weights", () => {
    const withHold = { id: "t", weights: { "role-dfl24-ic": 99, "role-jci": 1 } };
    expect(publicWeights(withHold, publicIds).weights).toEqual({ "role-jci": 1 });
  });
});

describe("lenses (ROADMAP 7.4)", () => {
  it("three lenses give three different orders over the same set of ids", () => {
    const orders = config.lenses.map((l) => orderByLens(publicIds, l));
    expect(new Set(orders.map((o) => o.join())).size).toBe(3);
    for (const o of orders) expect([...o].sort()).toEqual([...publicIds].sort());
  });
});
