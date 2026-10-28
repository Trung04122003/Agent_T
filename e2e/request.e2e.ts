import { readFileSync } from "node:fs";
import { expect, test, type Page } from "./test";

// P24: "Request declassified documents". A button in the evidence of every open entry that gives
// documents on request (Giai mat), one general button at the end of the page; never on hold or
// classified entries. mailto:, Gmail and copy only: no form, no request leaves the page.
type Raw = { id: string; kind: string; visibility?: string; evidence?: { type: string }[] };
const raw = JSON.parse(readFileSync("content/claims.json", "utf8")) as Raw[];
const ui = JSON.parse(readFileSync("content/ui.json", "utf8"));
const EMAIL = "lethaitrungwork@gmail.com";
const setMode = (page: Page, mode: string) => page.addInitScript((m) => localStorage.setItem("mode", m), mode);
const onRequest = raw.filter((c) => c.kind !== "classified" && c.visibility !== "hold" && c.evidence?.some((e) => e.type === "document-on-request")).map((c) => c.id);
const without = raw.filter((c) => !onRequest.includes(c.id)).map((c) => c.id);

test("24.2 buttons by entry type: on-request entries only, plus one at the end of the page", async ({ page }) => {
  expect(onRequest.length).toBeGreaterThan(0);
  expect(raw.some((c) => c.kind === "classified" || c.visibility === "hold")).toBe(true); // both cases exercised
  await setMode(page, "giai-mat");
  await page.goto("/vi/");
  for (const id of onRequest) await expect(page.locator(`#claim-${id} [data-request]`), id).toHaveCount(1);
  for (const id of without) await expect(page.locator(`#claim-${id} [data-request]`), id).toHaveCount(0);
  await expect(page.locator("footer [data-request]")).toHaveCount(1);
  await expect(page.locator("[data-request]")).toHaveCount(onRequest.length + 1);
  // Hold entries are not in the page at all, buttons included.
  const html = await page.content();
  for (const c of raw.filter((x) => x.visibility === "hold")) expect(html).not.toContain(c.id);

  // The row button sits in the evidence block: Giai mat only. The page-end one shows in both modes.
  const first = page.locator(`#claim-${onRequest[0]}`);
  await first.locator("[data-row-toggle]").click();
  await expect(first.locator("[data-request-mail]")).toBeVisible();
  await expect(first.locator("[data-request-mail]")).toHaveText(ui.requestDocs.vi);
  await page.locator("[data-mode-toggle]").click();
  await expect(page.locator("html")).toHaveAttribute("data-mode", "mat");
  await expect(first.locator("[data-request-mail]")).toBeHidden();
  await expect(page.locator("footer [data-request-mail]")).toBeVisible();
  // No form anywhere (24.5).
  await expect(page.locator("form")).toHaveCount(0);
});

for (const locale of ["vi", "en"] as const) {
  test(`24.3 mail per language (${locale}): file reference, template, diacritics decode`, async ({ page }) => {
    await page.goto(`/${locale}/`);
    const fileNo = (await page.locator('[data-banner="top"] [data-file-no]').textContent())!;
    const row = page.locator(`#claim-${onRequest[0]}`);
    const code = (await row.locator(".row__code").first().textContent())!.trim();
    const href = (await row.locator("[data-request-mail]").getAttribute("href"))!;
    expect(href.length).toBeLessThan(1800);
    const url = new URL(href.replace("mailto:", "mailto://x/"));
    expect(href.startsWith(`mailto:${EMAIL}?`)).toBe(true);
    expect(url.searchParams.get("subject")).toBe(`[${fileNo}-${code}] ${ui.requestSubject[locale]}`);
    const body = url.searchParams.get("body")!;
    expect(body.startsWith(ui.requestBody[locale].split("\n")[0])).toBe(true);
    expect(body).toContain(`${fileNo}-${code}`);
    // General request: the file number alone, no document named.
    const general = new URL((await page.locator("footer [data-request-mail]").getAttribute("href"))!.replace("mailto:", "mailto://x/"));
    expect(general.searchParams.get("subject")).toBe(`[${fileNo}] ${ui.requestSubject[locale]}`);
  });
}

test("24.4 Gmail opens a new tab safely; copy uses the clipboard", async ({ page, context, browserName }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/vi/");
  const box = page.locator("footer [data-request]");
  const gmail = box.locator("[data-request-gmail]");
  await expect(gmail).toHaveAttribute("target", "_blank");
  await expect(gmail).toHaveAttribute("rel", "noopener noreferrer");
  const g = new URL((await gmail.getAttribute("href"))!);
  expect(`${g.origin}${g.pathname}`).toBe("https://mail.google.com/mail/");
  expect(g.searchParams.get("to")).toBe(EMAIL);
  expect(g.searchParams.get("su")).toMatch(/^\[CUPID-\d{4}\] /);
  // The address is shown plainly (24.5: no obfuscation).
  await expect(box.locator("[data-request-addr]")).toHaveText(EMAIL);

  await box.locator("[data-copy-email]").click();
  await expect(box.locator("[data-copy-status]")).toHaveText(ui.requestCopied.vi);
  if (browserName === "chromium") expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(EMAIL);
});

test("24.4 without a clipboard, the address gets selected for a manual copy", async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, "clipboard", { value: undefined }));
  await page.goto("/vi/");
  const box = page.locator("footer [data-request]");
  await box.locator("[data-copy-email]").click();
  await expect(box.locator("[data-copy-status]")).toHaveText(ui.requestSelected.vi);
  expect(await page.evaluate(() => getSelection()?.toString())).toBe(EMAIL);
});

test("24.4 still works after an in-place language switch", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/vi/");
  await page.locator("[data-lang-switch]:not([aria-current])").click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  const box = page.locator("footer [data-request]");
  await expect(box.locator("[data-request-mail]")).toHaveText(ui.requestDocs.en);
  await box.locator("[data-copy-email]").click();
  await expect(box.locator("[data-copy-status]")).toHaveText(ui.requestCopied.en);
});
