import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { beforeAll, describe, expect, it } from "vitest";
import fixture from "../../e2e/fixtures/claims.json";
import { claims as claimsSchema, type Claim } from "../lib/schema";
import Ledger, { type LedgerLabels } from "./Ledger.astro";

const labels: LedgerLabels = {
  heading: "Sổ cái",
  tiers: { T1: "T1 — tự khai", T2: "T2 — tài liệu", T3: "T3 — liên kết" },
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

  it("shows a computed evidence tier on every open row; UNCONFIRMED badge only when asked (dev)", async () => {
    const prod = await render(false);
    expect(prod.match(/data-tier="T3"/g)?.length).toBe(1); // fx-verified has a public link
    expect(prod.match(/data-tier="T1"/g)?.length).toBe(5);
    expect(prod).not.toContain("UNCONFIRMED");
    expect(prod).not.toMatch(/kiểm chứng/i);
    const dev = await render(true);
    expect(dev.match(/UNCONFIRMED/g)?.length).toBe(5);
  });
});

describe("Ledger v2 (ROADMAP 9.2-9.3)", () => {
  const rowHtml = (html: string, id: string) => html.match(new RegExp(`<li[^>]*id="claim-${id}"[\\s\\S]*?</h3>[\\s\\S]*?(?=<li class="row|</ol>)`))?.[0] ?? "";

  it("9.2 teaser is Mat-only and summary is Giai-mat-only, never shared", async () => {
    const html = await render(false);
    const row = rowHtml(html, "fx-verified");
    expect(row).toMatch(/class="only-mat row__teaser"[^>]*>Câu mở đầu thử nghiệm\./);
    expect(row).toMatch(/class="only-giai-mat row__summary"[^>]*>Tóm tắt thử nghiệm số một/);
    expect(row).not.toMatch(/class="row__teaser"/); // no mode-less teaser left
  });

  it("9.3 a row with a summary gets the redaction and the declassify link", async () => {
    const row = rowHtml(await render(false), "fx-pending");
    expect(row).toContain("only-mat row__redacted");
    expect(row).toContain('data-declassify="fx-pending"');
  });

  it("9.3 a row without a summary gets neither redaction nor link", async () => {
    const row = rowHtml(await render(false), "fx-plain");
    expect(row).toContain("row__teaser");
    expect(row).not.toContain("row__redacted");
    expect(row).not.toContain("data-declassify");
  });
});

describe("BLUF row line (ROADMAP 11.2)", () => {
  it("shows the BLUF under the title, outside the mode-specific panel", async () => {
    const html = await render(false);
    const head = html.match(/<li[^>]*id="claim-fx-verified"[\s\S]*?<\/h3>/)?.[0] ?? "";
    expect(head).toMatch(/row__title[^>]*>Vai trò thử<\/span>[\s\S]*?<span class="row__bluf"[^>]*>Câu BLUF thử nghiệm\.<\/span>/);
    expect(head).not.toMatch(/only-(mat|giai-mat)[^"]*row__bluf|row__bluf[^"]*only-/);
  });

  it("renders nothing when BLUF is null or missing", async () => {
    const html = await render(false);
    expect(html.match(/class="row__bluf"/g)?.length).toBe(1);
    const pending = html.match(/<li[^>]*id="claim-fx-pending"[\s\S]*?<\/h3>/)?.[0] ?? "";
    expect(pending).not.toContain("row__bluf");
  });
});
