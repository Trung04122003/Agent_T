import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { FIXTURE } from "../playwright.config";

// ROADMAP 5.4 / SPEC section 7: Vietnamese with diacritics survives content -> build -> screen.
const SAMPLE = "Lê Thái Trung — Ắ Ằ Ẳ Ẵ Ặ Ế Ề Ể Ễ Ệ Ố Ồ Ổ Ỗ Ộ Ớ Ờ Ở Ỡ Ợ Ứ Ừ Ử Ữ Ự";
const read = (f: string) => JSON.parse(readFileSync(f, "utf8"));

test("the SPEC test string is byte-identical in the built HTML (no entities, no normalisation)", () => {
  const fixture = read("e2e/fixtures/claims.json");
  expect(fixture.some((c: { title?: { vi: string } }) => c.title?.vi === SAMPLE)).toBe(true);
  const html = readFileSync("test-results/dist-fixture/vi/index.html");
  expect(html.includes(Buffer.from(SAMPLE, "utf8"))).toBe(true);
});

test("the SPEC test string reaches the screen unchanged, before and after a language round trip", async ({ page }) => {
  await page.goto(`${FIXTURE}/vi/`);
  const title = page.locator("#claim-fx-extra-3 .row__title");
  const shown = await title.evaluate((el) => (el as HTMLElement).innerText);
  expect(shown).toBe(SAMPLE);
  expect([...shown].length).toBe([...SAMPLE].length);
  expect(shown.normalize("NFC")).toBe(shown);

  await page.locator("[data-lang-switch]").click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.locator("[data-lang-switch]").click();
  await expect(page.locator("html")).toHaveAttribute("lang", "vi");
  expect(await page.locator("#claim-fx-extra-3 .row__title").evaluate((el) => (el as HTMLElement).innerText)).toBe(SAMPLE);
});

test("every vi string of the real content appears unchanged on /vi/", async ({ page }) => {
  const identity = read("content/identity.json");
  const ui = read("content/ui.json");
  const claims = read("content/claims.json") as Array<Record<string, { vi: string } | string | null>>;
  const expected = [
    identity.legalName,
    identity.positioning.vi,
    ...claims
      .filter((c) => c["kind"] !== "classified" && c["visibility"] === "open")
      .flatMap((c) => ["org", "title"].map((k) => (c[k] as { vi: string } | null)?.vi))
      .filter((s): s is string => Boolean(s)),
    ...["codenameLabel", "gateScrollHint", "portraitLabel", "ledgerHeading", "updatedLabel"].map((k) => ui[k].vi),
  ];
  await page.goto("/vi/");
  const text = await page.evaluate(() => document.body.textContent ?? "");
  expect(expected.filter((s) => !text.includes(s))).toEqual([]);
});
