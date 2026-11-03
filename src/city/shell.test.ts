import { describe, expect, it } from "vitest";
import { lensFrom } from "./shell";

// ROADMAP-v4 33.2: the lens comes to the city through its own URL or the dossier page that linked here.
describe("lensFrom", () => {
  const origin = "https://example.test";
  it("prefers the city's own ?lens=", () => {
    expect(lensFrom("?lens=client", `${origin}/vi/?lens=curious`, origin)).toBe("client");
  });
  it("takes the referring dossier page's lens", () => {
    expect(lensFrom("", `${origin}/en/?lens=curious&skip=1`, origin)).toBe("curious");
  });
  it("ignores another site's referrer, an empty one and one without a lens", () => {
    expect(lensFrom("", "https://other.test/?lens=curious", origin)).toBeNull();
    expect(lensFrom("", "", origin)).toBeNull();
    expect(lensFrom("?lite", `${origin}/vi/`, origin)).toBeNull();
  });
});
