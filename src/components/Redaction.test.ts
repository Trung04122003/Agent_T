import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { beforeAll, describe, expect, it } from "vitest";
import fixture from "../../e2e/fixtures/claims.json";
import { claims as claimsSchema } from "../lib/schema";
import Ledger from "./Ledger.astro";
import Redaction from "./Redaction.astro";

const labels = {
  heading: "H",
  tiers: { T1: "T1", T2: "T2", T3: "T3" },
  viewDeclassified: "Xem bản giải mật",
  classifiedClosed: "Hồ sơ này không mở theo yêu cầu.",
  redacted: "Nội dung đã che",
  present: "nay",
  evidence: "E",
};

let container: AstroContainer;
beforeAll(async () => {
  container = await AstroContainer.create();
});

/** Visible text nodes plus aria-label / title / alt values of an HTML fragment. */
function strings(html: string): string[] {
  const attrs = [...html.matchAll(/\s(?:aria-label|title|alt)="([^"]*)"/g)].map((m) => m[1]!);
  const text = html
    .replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/g, "")
    .split(/<[^>]+>/)
    .map((s) => s.trim())
    .filter(Boolean);
  return [...attrs, ...text];
}

describe("Redaction (ROADMAP 3.2)", () => {
  it("is an SVG of bars with no text element and only the given label", async () => {
    const html = await container.renderToString(Redaction, { props: { barKey: "k", label: "Nhãn", seed: "s" } });
    expect(html).toContain("<svg");
    expect(html).not.toMatch(/<text|<foreignObject|<title/);
    expect(new Set(strings(html))).toEqual(new Set(["Nhãn"]));
  });

  it("classified entry HTML holds only its label (plus fixed UI text)", async () => {
    const claims = claimsSchema.parse(fixture);
    const html = await container.renderToString(Ledger, {
      props: { claims, locale: "vi", labels, showUnverified: true, seed: "s" },
    });
    const row = html.match(/<li[^>]*id="claim-fx-classified"[\s\S]*?<\/li>/)?.[0];
    expect(row).toBeDefined();
    const allowed = new Set(["Hồ sơ thử — bảo mật theo nghề", "04", labels.classifiedClosed]);
    expect(strings(row!).filter((s) => !allowed.has(s))).toEqual([]);
    expect(row).not.toContain(labels.viewDeclassified);
  });

  it("open-entry redaction contains no summary text", async () => {
    const claims = claimsSchema.parse(fixture);
    const html = await container.renderToString(Ledger, {
      props: { claims, locale: "vi", labels, showUnverified: false, seed: "s" },
    });
    const blocks = [...html.matchAll(/<div class="only-mat row__redacted[\s\S]*?<\/a>/g)].map((m) => m[0]);
    expect(blocks.length).toBe(5);
    for (const b of blocks) {
      expect(b).not.toContain("Tóm tắt thử nghiệm");
      expect(strings(b).filter((s) => ![labels.redacted, labels.viewDeclassified].includes(s))).toEqual([]);
    }
  });
});
