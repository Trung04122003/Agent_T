import { gzipSync } from "node:zlib";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { CITY, SITE } from "../playwright.config";

// ROADMAP-v4 P33: Agent T City's route, entry, exit and fallback shell, on a real build with the
// city flag on (CITY, port 4324). The gate is met as a first-time reader here (no e2e/test.ts).
test.use({ baseURL: CITY });

const gateOf = (page: Page) => page.locator("[data-entry]");
/** Ledger rows of the dossier page itself: what the city's district list must reach. */
const ledgerIds = (page: Page) => page.locator("[data-claim]").evaluateAll((els) => [...new Set(els.map((e) => (e as HTMLElement).dataset["claim"]!))]);

test("33.1 noindex, canonical to the dossier, in every language", async ({ request }) => {
  for (const l of ["vi", "en"]) {
    const html = await (await request.get(`/${l}/city/`)).text();
    expect(html).toContain('<meta name="robots" content="noindex">');
    expect(html).toContain(`<link rel="canonical" href="/${l}/">`);
    expect(html).toContain(`<html lang="${l}"`);
  }
});

test("33.2 the gate's JS is byte for byte the same with the city on, under 3.2 KB", async ({ request }) => {
  const gateJs = async (base: string) => {
    const html = await (await request.get(`${base}/vi/`)).text();
    const src = html.match(/<script type="module" src="([^"]*EntryGate[^"]*)"/)![1]!;
    const body = await (await request.get(`${base}${src}`)).text();
    const deps = await Promise.all([...body.matchAll(/from"\.\/([^"]+)"/g)].map(async (m) => (await request.get(`${base}/_astro/${m[1]}`)).text()));
    return { head: html.match(/var g="show".*?dataset\.gate=g;/)![0], body, deps };
  };
  const on = await gateJs(CITY);
  const off = await gateJs(SITE);
  expect(on).toEqual(off);
  const size = gzipSync(on.head).length + [on.body, ...on.deps].reduce((n, b) => n + gzipSync(b).length, 0);
  test.info().annotations.push({ type: "size", description: `gate JS ${size} B gzip` });
  expect(size).toBeLessThanOrEqual(3.2 * 1024);
});

test("33.2 gate -> city -> back: language kept, gate not replayed, browser Back works", async ({ page }) => {
  await page.goto("/en/");
  await expect(gateOf(page)).toBeVisible();
  await gateOf(page).locator("[data-city-enter]").click();
  await expect(page).toHaveURL(`${CITY}/en/city/`);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.goBack();
  await expect(page).toHaveURL(`${CITY}/en/`);
  await page.goForward();
  await page.locator(".city__bar [data-city-back]").click();
  await expect(page).toHaveURL(`${CITY}/en/#gate-codename`);
  await expect(gateOf(page)).toBeHidden();
});

test("33.2 dossier header -> city -> back keeps lens, language and mode", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("mode", "giai-mat"));
  await page.goto("/en/?lens=curious&skip=1");
  await expect(page.locator("html")).toHaveAttribute("data-mode", "giai-mat");
  await page.locator("header.controls [data-city-enter]").click();
  await expect(page).toHaveURL(`${CITY}/en/city/?lens=curious`);
  await expect(page.locator("html")).toHaveAttribute("data-mode", "giai-mat");
  for (const a of await page.locator("[data-city-back], [data-city-dossier-link]").all()) {
    expect(new URL((await a.getAttribute("href"))!, CITY).searchParams.get("lens")).toBe("curious");
  }
  await page.locator(".city__bar [data-city-back]").click();
  await expect(page).toHaveURL(`${CITY}/en/?lens=curious#gate-codename`);
  await expect(page.locator("html")).toHaveAttribute("data-mode", "giai-mat");
  await expect(page.locator('[data-positioning-lens="curious"]:visible')).toHaveCount(1);
});

test("33.3 the skip link is the first Tab stop and leads to the dossier", async ({ page }) => {
  await page.goto("/vi/city/");
  await page.keyboard.press("Tab");
  const skip = page.locator(".city-skip");
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(`${CITY}/vi/#gate-codename`);
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("33.3 the district list reaches every open entry and the Vault", async ({ page }) => {
    for (const l of ["vi", "en"]) {
      await page.goto(`/${l}/`);
      const ledger = await ledgerIds(page);
      expect(ledger.length).toBeGreaterThan(0);
      await page.goto(`/${l}/city/`);
      await expect(page.locator(".city__note")).toBeVisible();
      await expect(page.locator("[data-city-stage]")).toBeHidden();
      await expect(page.locator("[data-city-lite]")).toBeHidden();
      const items = page.locator("[data-district]");
      const districts = await items.evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset["district"]!));
      // Every ledger row has its district, in the same order; the classified one is the Vault.
      expect(districts.filter((id) => ledger.includes(id))).toEqual(ledger);
      for (const id of districts) {
        const link = page.locator(`#d-${id} [data-city-dossier-link]`);
        await expect(link).toBeVisible();
        expect(await link.getAttribute("href")).toBe(`/${l}/#claim-${id}`);
      }
    }
  });
});

test("33.3 print shows one line pointing to the dossier", async ({ page }) => {
  await page.goto("/vi/city/");
  await page.emulateMedia({ media: "print" });
  const line = page.locator(".city__print");
  await expect(line).toBeVisible();
  await expect(line.locator("a")).toHaveAttribute("href", "/vi/");
  for (const s of [".city__bar", ".city__districts", "[data-city-stage]", "[data-city-lite]"]) await expect(page.locator(s)).toBeHidden();
});

test("33.4 Lite via ?lite: the static plan, usable with the keyboard alone", async ({ page }) => {
  await page.goto("/vi/city/?lite");
  await expect(page.locator("[data-city]")).toHaveAttribute("data-view", "lite");
  await expect(page.locator("[data-city-lite]")).toBeVisible();
  await expect(page.locator("[data-city-stage]")).toBeHidden();
  await expect(page.locator("[data-city-stage] canvas")).toHaveCount(0);
  const plots = page.locator("[data-city-lite] a");
  const count = await plots.count();
  expect(count).toBe(await page.locator("[data-district]").count());
  // Tab from the top until the first plot has focus, then Enter jumps to its entry in the list.
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press("Tab");
    if (await plots.first().evaluate((a) => a === document.activeElement)) break;
  }
  await expect(plots.first()).toBeFocused();
  const target = (await plots.first().getAttribute("href"))!;
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(new RegExp(`${target}$`));
  await expect(page.locator(`${target}:target`)).toHaveCount(1);
  const axe = await new AxeBuilder({ page }).include("[data-city]").analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);
});

test("33.4 without ?lite the world view shows (the stage, no static plan)", async ({ page }) => {
  await page.goto("/vi/city/");
  await expect(page.locator("[data-city]")).toHaveAttribute("data-view", "world");
  await expect(page.locator("[data-city-stage]")).toBeVisible();
  await expect(page.locator("[data-city-lite]")).toBeHidden();
});

test("34 the city draws its plan, and repaints in the other palette on a mode switch", async ({ page }) => {
  await page.goto("/vi/city/");
  await page.waitForFunction(() => performance.getEntriesByName("city:first-frame").length > 0);
  const stage = page.locator("[data-city-stage]");
  const painted = () =>
    page.evaluate(() => {
      const c = document.querySelector<HTMLCanvasElement>(".city-layer--dynamic")!;
      const d = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
      let n = 0;
      for (let i = 3; i < d.length; i += 4 * 97) if (d[i]! > 0) n++;
      return n / (d.length / (4 * 97));
    });
  expect(await painted()).toBeGreaterThan(0.5);
  const before = Number(await stage.getAttribute("data-bake-chunks"));
  expect(before).toBeGreaterThan(0);
  await page.evaluate(() => (document.documentElement.dataset["mode"] = "giai-mat"));
  await expect.poll(async () => Number(await stage.getAttribute("data-bake-chunks"))).toBeGreaterThan(before);
  // The data handed to the page names entries but carries no tier and no text.
  const data = JSON.parse((await page.locator("[data-city-data]").textContent())!);
  expect(Object.keys(data.plots[0]).sort()).toEqual(["domains", "id", "kind"]);
});

/** Distinct pictures the dynamic layer showed, sampled every 50 ms for `ms`. */
async function dynamicStates(page: Page, ms: number): Promise<number> {
  return page.evaluate(async (ms) => {
    const c = document.querySelector<HTMLCanvasElement>(".city-layer--dynamic")!;
    const g = c.getContext("2d")!;
    const seen = new Set<number>();
    for (let t = 0; t < ms; t += 50) {
      const d = g.getImageData(0, 0, c.width, c.height).data;
      let h = 0;
      for (let i = 0; i < d.length; i += 4 * 31) h = (Math.imul(h, 31) + d[i]! + d[i + 1]! * 7) | 0;
      seen.add(h);
      await new Promise((r) => setTimeout(r, 50));
    }
    return seen.size;
  }, ms);
}
const darknessAlpha = (page: Page) =>
  page.evaluate(() => {
    const c = document.querySelector<HTMLCanvasElement>(".city-layer--darkness")!;
    const d = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
    let sum = 0;
    for (let i = 3; i < d.length; i += 4) sum += d[i]!;
    return sum / (d.length / 4) / 255;
  });

test.describe("P35 night engine", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("mode", "mat"));
  });

  test("35.2 Mat lays the darkness over the city, cut by light; Giai mat lifts it", async ({ page }) => {
    await page.goto("/vi/city/");
    await page.waitForFunction(() => performance.getEntriesByName("city:first-frame").length > 0);
    await expect.poll(() => darknessAlpha(page)).toBeGreaterThan(0.5);
    // Not uniform: lamps, the lantern and signs cut it.
    expect(await darknessAlpha(page)).toBeLessThan(0.8);
    await page.evaluate(() => (document.documentElement.dataset["mode"] = "giai-mat"));
    await expect.poll(() => darknessAlpha(page)).toBe(0);
  });

  test("35.4 rain only on the High tier, capped at 120; none on Medium or in Giai mat", async ({ page }) => {
    const stage = page.locator("[data-city-stage]");
    await page.goto("/vi/city/?quality=high");
    await expect(stage).toHaveAttribute("data-tier", "high");
    await expect(stage).toHaveAttribute("data-rain", "120");
    await page.evaluate(() => (document.documentElement.dataset["mode"] = "giai-mat"));
    await expect(stage).toHaveAttribute("data-rain", "0");
    await page.goto("/vi/city/?quality=medium");
    await expect(stage).toHaveAttribute("data-tier", "medium");
    await expect(stage).toHaveAttribute("data-rain", "0");
  });

  test("35.3 the sign bars stir in Mat", async ({ page }) => {
    await page.goto("/vi/city/");
    await page.waitForFunction(() => performance.getEntriesByName("city:first-frame").length > 0);
    await page.waitForTimeout(1000); // the last chunks bake first
    expect(await dynamicStates(page, 8000)).toBeGreaterThan(1);
  });

  test.describe("reduced motion", () => {
    test.use({ reducedMotion: "reduce" });
    test("35.3 freezes the bars and stops the rain", async ({ page }) => {
      await page.goto("/vi/city/?quality=high");
      await page.waitForFunction(() => performance.getEntriesByName("city:first-frame").length > 0);
      await expect(page.locator("[data-city-stage]")).toHaveAttribute("data-rain", "0");
      await page.waitForTimeout(500);
      expect(await dynamicStates(page, 8000)).toBe(1);
    });
  });
});

test("33.5 a dossier page loads no city file; the city page does", async ({ page }) => {
  const js = async (path: string) => {
    const seen: string[] = [];
    page.on("request", (r) => {
      if (r.resourceType() === "script") seen.push(r.url());
    });
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    page.removeAllListeners("request");
    return Promise.all(seen.map(async (u) => ({ u, body: await (await page.request.get(u)).text() })));
  };
  const isCity = (b: string) => b.includes("city:first-frame");
  for (const path of ["/vi/", "/en/?skip=1"]) {
    const files = await js(path);
    expect(files.length).toBeGreaterThan(0);
    expect(files.filter((f) => isCity(f.body)).map((f) => f.u), path).toEqual([]);
  }
  expect((await js("/vi/city/")).some((f) => isCity(f.body))).toBe(true);
});
