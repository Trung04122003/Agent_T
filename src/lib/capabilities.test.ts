import { describe, expect, it } from "vitest";
import claims from "../../content/claims.json";
import domainsFile from "../../content/domains.json";
import places from "../../content/places.json";

// Owner, 2026-11-01: each entry's place and fields are references, never free text.
type Raw = { id: string; kind: string; visibility?: string; place?: string; domains?: string[] };
const all = claims as Raw[];

describe("places and fields of the entries", () => {
  it("every place is a place on the map, every field is in content/domains.json", () => {
    const placeIds = new Set(places.map((p) => p.id));
    const domainIds = new Set(domainsFile.domains.map((d) => d.id));
    for (const c of all) {
      if (c.place) expect(placeIds.has(c.place), `${c.id}: ${c.place}`).toBe(true);
      for (const d of c.domains ?? []) expect(domainIds.has(d), `${c.id}: ${d}`).toBe(true);
      expect(new Set(c.domains ?? []).size, `${c.id}: a field twice`).toBe((c.domains ?? []).length);
    }
  });

  it("the owner's answer: every open entry in Da Nang, each in at least one of the four fields", () => {
    const open = all.filter((c) => c.kind !== "classified" && c.visibility !== "hold");
    for (const c of open) {
      expect(c.place, c.id).toBe("da-nang");
      expect(c.domains?.length ?? 0, c.id).toBeGreaterThan(0);
    }
    expect(domainsFile.domains.map((d) => d.vi)).toEqual(["Công nghệ", "Kinh doanh", "Tài chính – bảo hiểm", "Ngoại giao"]);
  });

  it("nothing held or classified carries a place or a field (they never reach the page)", () => {
    for (const c of all.filter((x) => x.kind === "classified" || x.visibility === "hold")) {
      expect(c.place, c.id).toBeUndefined();
      expect(c.domains, c.id).toBeUndefined();
    }
  });
});
