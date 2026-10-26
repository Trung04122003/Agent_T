import { describe, expect, it } from "vitest";
import claimsJson from "../../content/claims.json";
import identityJson from "../../content/identity.json";
import placesJson from "../../content/places.json";
import uiJson from "../../content/ui.json";
import { claim, claims, endsInFuture, identity, period, place, publishedClaim, ui, withoutNotes } from "./schema";

// Neutral fixtures: placeholder text only, never real content.
const open = {
  id: "role-x",
  kind: "role",
  visibility: "open",
  status: "needs-evidence",
  org: { vi: "Tổ chức X", en: "Org X" },
  title: { vi: "Vai trò X", en: "Role X" },
  period: { start: "2024-02", end: null, ongoing: true },
  teaser: null,
  summary: null,
  evidence: [],
  notes: "internal",
};

const classified = {
  id: "classified-x",
  kind: "classified",
  status: "needs-decision",
  label: { vi: "Nhãn", en: "Label" },
};

describe("claim schema", () => {
  it("accepts a valid open entry and a valid classified entry", () => {
    expect(publishedClaim.safeParse(open).success).toBe(true);
    expect(publishedClaim.safeParse(classified).success).toBe(true);
    expect(publishedClaim.safeParse({ ...classified, period: { start: "2025", end: null } }).success).toBe(true);
  });

  it("classified có thêm chữ thì bị từ chối", () => {
    for (const extra of [
      { summary: { vi: "bí mật", en: "secret" } },
      { teaser: { vi: "bí mật", en: "secret" } },
      { title: { vi: "bí mật", en: "secret" } },
      { org: { vi: "bí mật", en: "secret" } },
      { notes: "secret" },
      { evidence: [{ type: "reference", note: { vi: "bí mật", en: "secret" } }] },
      { visibility: "open" },
    ]) {
      expect(claim.safeParse({ ...classified, ...extra }).success, JSON.stringify(extra)).toBe(false);
    }
  });

  it("confirmed không cần bằng chứng (bậc T1); trạng thái verified cũ bị từ chối", () => {
    expect(claim.safeParse({ ...open, status: "confirmed", evidence: [] }).success).toBe(true);
    expect(claim.safeParse({ ...open, status: "verified", evidence: [] }).success).toBe(false);
    expect(
      claim.safeParse({ ...open, status: "confirmed", evidence: [{ type: "document-on-request", note: { vi: "n", en: "n" } }] }).success,
    ).toBe(true);
  });

  it("mục open thiếu title và org, hoặc thiếu period, thì bị từ chối", () => {
    expect(publishedClaim.safeParse({ ...open, org: null, title: null }).success).toBe(false);
    expect(publishedClaim.safeParse({ ...open, period: null }).success).toBe(false);
    expect(publishedClaim.safeParse({ ...open, org: null }).success).toBe(true);
    expect(publishedClaim.safeParse({ ...open, title: null }).success).toBe(true);
  });

  it("hold entries may be incomplete; local (non-published) schema accepts open drafts", () => {
    expect(publishedClaim.safeParse({ ...open, visibility: "hold", org: null, title: null, period: null }).success).toBe(
      true,
    );
    expect(claim.safeParse({ ...open, period: null }).success).toBe(true);
  });

  it("requires both vi and en, non-empty, and rejects unknown locales", () => {
    expect(claim.safeParse({ ...open, org: { vi: "X" } }).success).toBe(false);
    expect(claim.safeParse({ ...open, org: { vi: "X", en: "  " } }).success).toBe(false);
    expect(claim.safeParse({ ...open, org: { vi: "X", en: "X", es: "X" } }).success).toBe(false);
  });

  it("rejects an evidence note without en (it is displayed)", () => {
    const ev = (note: unknown) => ({ ...open, status: "confirmed", evidence: [{ type: "reference", note }] });
    expect(claim.safeParse(ev({ vi: "Giấy chứng nhận" })).success).toBe(false);
    expect(claim.safeParse(ev("Giấy chứng nhận")).success).toBe(false);
    expect(claim.safeParse(ev({ vi: "Giấy chứng nhận", en: "Certificate" })).success).toBe(true);
  });

  it("rejects identity and places strings without en (SPEC section 7)", () => {
    const id = identity.parse(identityJson);
    expect(identity.safeParse({ ...id, positioning: { vi: id.positioning.vi } }).success).toBe(false);
    const pl = place.parse(placesJson[0]);
    expect(place.safeParse({ ...pl, label: { vi: pl.label.vi } }).success).toBe(false);
  });

  it("rejects malformed periods and unknown fields", () => {
    expect(claim.safeParse({ ...open, period: { start: "2024-13", end: null } }).success).toBe(false);
    expect(claim.safeParse({ ...open, period: { start: "24/02/2024", end: null } }).success).toBe(false);
    expect(claim.safeParse({ ...open, secret: "x" }).success).toBe(false);
  });

  it("rejects duplicate ids in the file", () => {
    expect(claims.safeParse([open, open]).success).toBe(false);
    expect(claims.safeParse([open, classified]).success).toBe(true);
  });

  it("withoutNotes drops notes and keeps Vietnamese text unchanged", () => {
    const s = "Lê Thái Trung — Ắ Ằ Ẳ Ẵ Ặ Ế Ề Ể Ễ Ệ Ố Ồ Ổ Ỗ Ộ Ớ Ờ Ở Ỡ Ợ Ứ Ừ Ử Ữ Ự";
    const parsed = claim.parse({ ...open, org: { vi: s, en: "X" } });
    const out = withoutNotes(parsed as typeof open);
    expect("notes" in out).toBe(false);
    expect(out.org.vi).toBe(s);
  });
});

describe("content files", () => {
  it("claims.json matches the schema (ids unique)", () => {
    const r = claims.safeParse(claimsJson);
    expect(r.error?.issues ?? []).toEqual([]);
  });

  it("identity.json matches the schema", () => {
    const r = identity.safeParse(identityJson);
    expect(r.error?.issues ?? []).toEqual([]);
  });

  it("places.json matches the schema", () => {
    const r = place.array().safeParse(placesJson);
    expect(r.error?.issues ?? []).toEqual([]);
  });

  it("ui.json matches the schema (every string has vi and en)", () => {
    const r = ui.safeParse(uiJson);
    expect(r.error?.issues ?? []).toEqual([]);
    expect(ui.safeParse({ modeMat: { vi: "Mật" } }).success).toBe(false);
  });
});

describe("org vs title (ROADMAP 9.4)", () => {
  const row = {
    id: "p",
    kind: "project",
    visibility: "open",
    status: "needs-evidence",
    org: { vi: "Hệ thống giám sát", en: "Monitoring System" },
    title: { vi: "Khác", en: "Other" },
    period: { start: "2025", end: null },
    teaser: null,
    summary: null,
    evidence: [],
  };

  it("rejects a title that repeats the org once normalised (case, punctuation, spacing)", () => {
    expect(claim.safeParse({ ...row, title: { vi: "hệ  thống giám sát.", en: "Other" } }).success).toBe(false);
    expect(claim.safeParse({ ...row, title: { vi: "Khác", en: "MONITORING — system" } }).success).toBe(false);
  });

  it("accepts distinct org and title, or a missing org", () => {
    expect(claim.safeParse(row).success).toBe(true);
    expect(claim.safeParse({ ...row, org: null }).success).toBe(true);
  });
});

describe("dates (ROADMAP 9.5)", () => {
  const at = new Date("2026-10-25T00:00:00Z");

  it("knows when an end lies after the build month or year", () => {
    expect(endsInFuture("2026-11", at)).toBe(true);
    expect(endsInFuture("2027", at)).toBe(true);
    expect(endsInFuture("2026-10", at)).toBe(false);
    expect(endsInFuture("2026", at)).toBe(false);
    expect(endsInFuture("2025-12", at)).toBe(false);
  });

  it("rejects a future end date stated as fact", () => {
    expect(period.safeParse({ start: "2026-06", end: "2999-06" }).success).toBe(false);
  });

  it("accepts ongoing without an end, and rejects ongoing with one", () => {
    expect(period.safeParse({ start: "2026-06", end: null, ongoing: true }).success).toBe(true);
    expect(period.safeParse({ start: "2026-06", end: "2026-07", ongoing: true }).success).toBe(false);
  });

  it("accepts a past end", () => {
    expect(period.safeParse({ start: "2021-09", end: "2026-06" }).success).toBe(true);
  });
});
