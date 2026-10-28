import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { gmailHref, mailtoHref, MAX_MAILTO, requestDocs, requestMail } from "./request";

// ROADMAP 24.3-24.4: the request mail, per language, from content/ only.
const ui = JSON.parse(readFileSync("content/ui.json", "utf8"));
const claims = JSON.parse(readFileSync("content/claims.json", "utf8")) as Array<{
  id: string;
  kind: string;
  visibility?: string;
  evidence?: { type: "link" | "document-on-request" | "reference"; note: { vi: string; en: string } }[];
}>;
const EMAIL = "lethaitrungwork@gmail.com";
const ev = (vi: string, en: string) => ({ type: "document-on-request" as const, note: { vi, en } });

describe("24.3 requestDocs", () => {
  it("lists only documents given on request, without the 'on request' tail", () => {
    const evidence = [
      ev("Giấy chứng nhận hoàn thành, cung cấp khi có yêu cầu", "Certificate of completion, available on request"),
      { type: "link" as const, url: "https://example.com", note: { vi: "Trang", en: "Page" } },
    ];
    expect(requestDocs(evidence, "vi")).toEqual(["Giấy chứng nhận hoàn thành"]);
    expect(requestDocs(evidence, "en")).toEqual(["Certificate of completion"]);
  });
  it("keeps a note that has no such tail as it is", () => {
    expect(requestDocs([ev("Bảng điểm", "Transcript")], "vi")).toEqual(["Bảng điểm"]);
  });
});

for (const locale of ["vi", "en"] as const) {
  describe(`24.3 mail in ${locale}`, () => {
    const docs = ["Giấy chứng nhận hoàn thành", "Chứng chỉ tư vấn viên bảo hiểm nhân thọ (kỳ thi của Bộ Tài chính)"];
    const mail = requestMail("CUPID-2610-02", docs, ui.requestSubject[locale], ui.requestBody[locale]);
    const href = mailtoHref(EMAIL, mail);
    const params = new URL(href.replace("mailto:", "mailto://x/")).searchParams;

    it("subject carries the file reference of the entry", () => {
      expect(mail.subject).toBe(`[CUPID-2610-02] ${ui.requestSubject[locale]}`);
      expect(params.get("subject")).toBe(mail.subject); // decodes back, diacritics included
    });
    it("body has blanks for the visitor and the documents from content/", () => {
      const body = params.get("body")!;
      expect(body).toContain("CUPID-2610-02");
      expect(body).toContain(docs.join("; "));
      expect(body).not.toMatch(/\{ref\}|\{docs\}/);
      expect(body.split("\r\n").length).toBe(mail.body.split("\n").length); // CRLF line breaks
      expect(body).toBe(mail.body.replace(/\n/g, "\r\n"));
    });
    it("is a plain mailto: to the one address, under the length limit", () => {
      expect(href.startsWith(`mailto:${EMAIL}?subject=`)).toBe(true);
      expect(href.length).toBeLessThan(MAX_MAILTO);
      expect(href).not.toMatch(/[\sÀ-ỹ]/u); // fully percent-encoded
    });
    it("Gmail link holds the same mail", () => {
      const g = new URL(gmailHref(EMAIL, mail));
      expect(g.origin + g.pathname).toBe("https://mail.google.com/mail/");
      expect(g.searchParams.get("to")).toBe(EMAIL);
      expect(g.searchParams.get("su")).toBe(mail.subject);
      expect(g.searchParams.get("body")).toBe(mail.body);
    });
  });
}

it("24.3 every real request mail stays under the length limit", () => {
  for (const c of claims.filter((x) => x.kind !== "classified" && x.visibility !== "hold")) {
    for (const locale of ["vi", "en"] as const) {
      const docs = requestDocs((c.evidence ?? []) as Parameters<typeof requestDocs>[0], locale);
      if (!docs.length) continue;
      const href = mailtoHref(EMAIL, requestMail("CUPID-2610-99", docs, ui.requestSubject[locale], ui.requestBody[locale]));
      expect(href.length, `${c.id} ${locale}`).toBeLessThan(MAX_MAILTO);
    }
  }
});
