import { readFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "./test";

// P15: commitment chart — one dataset (period of open entries), two drawings.
const ui = JSON.parse(readFileSync("content/ui.json", "utf8"));
type Raw = {
  id: string;
  kind: string;
  visibility?: string;
  label?: { vi: string; en: string };
  org?: { vi: string; en: string } | null;
  title?: { vi: string; en: string } | null;
  period?: { start: string; end: string | null; ongoing?: boolean } | null;
  paused?: boolean;
};
const raw = JSON.parse(readFileSync("content/claims.json", "utf8")) as Raw[];
// The chart counts open entries with a period, paused ones left out (ROADMAP 20.2).
const open = raw.filter((c) => c.kind !== "classified" && c.visibility !== "hold" && c.period && !c.paused);
const hidden = raw.filter((c) => c.kind === "classified" || c.visibility === "hold");
const setMode = (page: Page, mode: string) => page.addInitScript((m) => localStorage.setItem("mode", m), mode);

// Independent recount: months from the first start to now, end months included.
function recount(): { counts: number[]; segments: number } {
  const idx = (p: string) => Number(p.slice(0, 4)) * 12 + Number(p.slice(5, 7)) - 1;
  const now = new Date();
  const nowI = now.getUTCFullYear() * 12 + now.getUTCMonth();
  const spans = open.map((c) => [idx(c.period!.start), c.period!.ongoing ? nowI : idx(c.period!.end!)] as const);
  const first = Math.min(...spans.map((s) => s[0]));
  const counts: number[] = [];
  let segments = 0;
  let prev = "";
  for (let i = first; i <= nowI; i++) {
    const set = spans.map((s, k) => (s[0] <= i && i <= s[1] ? k : -1)).filter((k) => k >= 0).join();
    counts.push(set ? set.split(",").length : 0);
    if (set !== prev) segments++;
    prev = set;
  }
  return { counts, segments };
}

test("15.2 Giai mat: step line, year labels, names under the pointer", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await setMode(page, "giai-mat");
  await page.goto("/vi/");
  const chart = page.locator("[data-chart]");
  await chart.scrollIntoViewIfNeeded();
  await expect(chart.locator(".chart__line")).toBeVisible();
  await expect(chart.locator(".chart__signal")).toBeHidden();
  await expect(chart.locator(".chart__axis-x").getByText("2024", { exact: true })).toBeVisible();

  // Pointer over the highest step: the readout names every entry running then.
  const { counts } = recount();
  const peak = counts.indexOf(Math.max(...counts));
  const plot = (await chart.locator("[data-chart-plot]").boundingBox())!;
  await page.mouse.move(plot.x + ((peak + 0.5) / counts.length) * plot.width, plot.y + plot.height / 2);
  await expect(chart.locator("[data-chart-count]")).toHaveText(String(Math.max(...counts)));
  const names = (await chart.locator("[data-chart-names]").textContent())!.split(" · ");
  expect(names).toHaveLength(Math.max(...counts));
  const allowed = new Set(open.map((c) => (c.org ?? c.title)!.vi));
  for (const n of names) expect(allowed.has(n), n).toBe(true);
});

test("15.2 Mat: same data as a signal, labels and names covered", async ({ page }) => {
  await setMode(page, "mat");
  await page.goto("/vi/");
  const chart = page.locator("[data-chart]");
  await chart.scrollIntoViewIfNeeded();
  await expect(chart.locator(".chart__signal")).toBeVisible();
  await expect(chart.locator(".chart__line")).toBeHidden();
  const { counts } = recount();
  await expect(chart.locator(".chart__signal rect")).toHaveCount(counts.filter((c) => c > 0).length);
  await expect(chart.locator(".chart__axis-x .chart__redact").first()).toBeVisible();
  await expect(chart.locator(".chart__axis-x").getByText("2024", { exact: true })).toBeHidden();
  await expect(chart.locator("[data-chart-names]")).toBeHidden();
  // Hover keeps the names covered: one bar per name, styled (visible), never the text.
  const plot = (await chart.locator("[data-chart-plot]").boundingBox())!;
  await page.mouse.move(plot.x + plot.width * 0.9, plot.y + plot.height / 2);
  const bars = chart.locator("[data-chart-bars] i");
  expect(await bars.count()).toBeGreaterThan(0);
  await expect(bars.first()).toBeVisible();
  expect((await bars.first().boundingBox())!.width).toBeGreaterThan(20);

  // Owner feedback 2026-10-28: a clear sight frame on the period, and brighter small print.
  const band = await chart.locator("[data-chart-band]").evaluate((e) => {
    const s = getComputedStyle(e);
    const tint = s.backgroundColor !== "rgba(0, 0, 0, 0)";
    return { opacity: s.opacity, side: s.borderLeftWidth, caps: s.backgroundImage.split("linear-gradient").length - 1, tint };
  });
  expect(band).toEqual({ opacity: "1", side: "2px", caps: 4, tint: true });
  await expect(chart.locator(".chart__hint")).toHaveCSS("color", "rgb(196, 193, 185)");
});

test("15.2 the page source never carries hold or classified entries into the chart", async ({ page }) => {
  await page.goto("/vi/");
  const html = await page.locator("[data-chart]").evaluate((el) => el.outerHTML);
  for (const c of hidden) {
    expect(html, c.id).not.toContain(c.id);
    for (const s of [c.org?.vi, c.org?.en, c.title?.vi, c.title?.en, c.label?.vi, c.label?.en]) {
      if (s) expect(html, `${c.id}: ${s}`).not.toContain(s);
    }
  }
});

test("15.3 keyboard steps through the periods; the hidden table matches the data; axe passes", async ({ page }) => {
  await setMode(page, "giai-mat");
  await page.goto("/vi/");
  const chart = page.locator("[data-chart]");
  const plot = chart.locator("[data-chart-plot]");
  await plot.focus();
  const { counts, segments } = recount();
  await expect(chart.locator("tbody tr")).toHaveCount(segments);
  const before = await chart.locator("[data-chart-when]").textContent();
  await page.keyboard.press("ArrowLeft");
  await expect(chart.locator("[data-chart-when]")).not.toHaveText(before!);
  await page.keyboard.press("Home");
  const firstFrom = (await chart.locator("tbody tr").first().locator("td").first().textContent())!;
  expect(await chart.locator("[data-chart-when]").textContent()).toMatch(new RegExp(`^${firstFrom} –`));
  await expect(chart.locator("[data-chart-count]")).toHaveText(String(counts[0]));
  await page.keyboard.press("End");
  await expect(chart.locator("[data-chart-count]")).toHaveText(String(counts.at(-1)));
  await expect(chart.locator("[data-chart-readout]")).toHaveAttribute("aria-live", "polite");

  const result = await new AxeBuilder({ page }).include("[data-chart]").analyze();
  expect(result.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
});

test("15.4 wording: the caption, no money axis, no growth or percentages", async ({ page }) => {
  for (const locale of ["vi", "en"] as const) {
    await page.goto(`/${locale}/`);
    const chart = page.locator("[data-chart]");
    await expect(chart.locator("#chart-title")).toHaveText(ui.chartTitle[locale]);
    const text = (await chart.textContent())!.toLowerCase();
    for (const bad of ["%", "₫", "$", "vnd", "usd", "tăng trưởng", "growth", "lợi nhuận", "profit", "doanh thu", "revenue"]) {
      expect(text, bad).not.toContain(bad);
    }
  }
  expect(ui.chartTitle.vi).toBe("Số cam kết đồng thời theo thời gian"); // ROADMAP 15.4 wording
});
