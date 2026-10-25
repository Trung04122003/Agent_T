import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { beforeAll, describe, expect, it } from "vitest";
import fixture from "../../e2e/fixtures/claims.json";
import { claims as claimsSchema, type Claim } from "../lib/schema";
import Ledger, { type LedgerLabels } from "./Ledger.astro";

const labels: LedgerLabels = {
  heading: "Sổ cái",
  verified: "Đã kiểm chứng",
  viewDeclassified: "Xem bản giải mật",
  classifiedClosed: "Hồ sơ này không mở theo yêu cầu.",
  redacted: "Nội dung đã che",
  present: "nay",
  evidence: "Bằng chứng",
};
// The raw fixture, hold entry included: the component itself must drop it.
const claims: Claim[] = claimsSchema.parse(fixture);

let container: AstroContainer;
beforeAll(async () => {
  container = await AstroContainer.create();
});
const render = (showUnverified: boolean) =>
  container.renderToString(Ledger, { props: { claims, locale: "vi", labels, showUnverified, seed: "test" } });

describe("Ledger (ROADMAP 3.1)", () => {
  it("never renders a hold entry", async () => {
    const html = await render(true);
    expect(claims.some((c) => c.id === "fx-hold")).toBe(true);
    expect(html).not.toContain("HOLD-SENTINEL");
    expect(html).not.toContain("fx-hold");
  });

  it("never renders internal notes", async () => {
    const html = await render(true);
    expect(html).not.toContain("NOTES-SENTINEL");
  });

  it("shows org, title and period of every open entry, numbered 01..", async () => {
    const html = await render(false);
    for (const s of ["Tổ chức Thử Một", "Vai trò thử", "01/2023 – nay", "Dự án thử", "2021 – 06/2022", "Trường thử", "2019"]) {
      expect(html).toContain(s);
    }
    expect(html).toMatch(/row__code[^>]*>01</);
    expect(html).toMatch(/row__code[^>]*>04</);
  });

  it("stamps only verified entries; UNVERIFIED badge only when asked (dev)", async () => {
    const prod = await render(false);
    expect(prod.match(/row__stamp/g)?.length).toBe(1);
    expect(prod).not.toContain("UNVERIFIED");
    const dev = await render(true);
    expect(dev.match(/UNVERIFIED/g)?.length).toBe(5);
  });
});
