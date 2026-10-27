import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { beforeAll, describe, expect, it } from "vitest";
import printJson from "../../content/print.json";
import { printSettings } from "../lib/schema";
import PrintButton from "./PrintButton.astro";

// ROADMAP 18.2: the button shows only once the owner has approved the one-page file.
let container: AstroContainer;
beforeAll(async () => {
  container = await AstroContainer.create();
});

describe("18.2 one-page download button", () => {
  it("follows content/print.json (approved by the owner on 2026-10-27)", async () => {
    const approved = printSettings.parse(printJson).approval !== null;
    expect(approved).toBe(true);
    const html = await container.renderToString(PrintButton, { props: { locale: "vi" } });
    expect(html).toContain("data-print-cta");
  });

  it("renders nothing without an approval", async () => {
    const html = await container.renderToString(PrintButton, { props: { locale: "vi", approved: false } });
    expect(html).not.toContain("data-print-cta");
  });

  it("renders the button once approved", async () => {
    const html = await container.renderToString(PrintButton, { props: { locale: "vi", approved: true } });
    expect(html).toContain("data-print-button");
    expect(html).toContain("Tải hồ sơ một trang (PDF)");
  });

  it("an approval needs who and when", () => {
    expect(printSettings.safeParse({ approval: { by: "owner", on: "2026-10-27" } }).success).toBe(true);
    expect(printSettings.safeParse({ approval: { by: "owner" } }).success).toBe(false);
    expect(printSettings.safeParse({ approval: { by: "owner", on: "27/10/2026" } }).success).toBe(false);
  });
});
