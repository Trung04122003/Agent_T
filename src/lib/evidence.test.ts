import { describe, expect, it } from "vitest";
import claimsJson from "../../content/claims.json";
import { tierOf } from "./evidence";
import { evidence as evidenceSchema } from "./schema";

const note = { vi: "n", en: "n" };

describe("evidence tiers (ROADMAP 9.7)", () => {
  it("document-on-request only gives T2", () => {
    expect(tierOf([{ type: "document-on-request" }])).toBe("T2");
  });

  it("a public link gives T3", () => {
    expect(tierOf([{ type: "document-on-request" }, { type: "link", url: "https://example.com" }])).toBe("T3");
  });

  it("a reference counts as T3 only with consent", () => {
    expect(tierOf([{ type: "reference" }])).toBe("T1");
    expect(tierOf([{ type: "reference", consent: false }])).toBe("T1");
    expect(tierOf([{ type: "reference", consent: true }])).toBe("T3");
  });

  it("no outside evidence is T1", () => {
    expect(tierOf([])).toBe("T1");
  });

  it("consent is only accepted on a reference", () => {
    expect(evidenceSchema.safeParse({ type: "reference", note, consent: true }).success).toBe(true);
    expect(evidenceSchema.safeParse({ type: "link", url: "https://example.com", note, consent: true }).success).toBe(false);
  });

  it("real content: AQI project is T3, Duy Tan is T2", () => {
    const by = (id: string) => claimsJson.find((c) => c.id === id) as { evidence: Parameters<typeof tierOf>[0] };
    expect(tierOf(by("project-air-quality").evidence)).toBe("T3");
    expect(tierOf(by("edu-duy-tan").evidence)).toBe("T2");
  });
});
