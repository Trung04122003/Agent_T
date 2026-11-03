import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { CITY, SITE } from "../playwright.config";
import { toScreen } from "../src/city/engine/iso";
import { assignLots, PLOT_LOTS, type CityData } from "../src/city/plan";

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
  // Byte for byte, but for the content hashes in chunk names (the city's chunk changes the graph).
  const unhash = (g: typeof on) => JSON.parse(JSON.stringify(g).replace(/\.[A-Za-z0-9_-]{8}\.js/g, ".js"));
  expect(unhash(on)).toEqual(unhash(off));
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
    // No night left; only the dawn sun's faint wash (P38) on that layer.
    await expect.poll(() => darknessAlpha(page)).toBeLessThan(0.1);
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

test.describe("P36 Agent T", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("mode", "mat"));
  });
  const stageOf = (page: Page) => page.locator("[data-city-stage]");

  test("36.6 he waits hidden in the alley, steps out after about 1.2 s, and is in the city", async ({ page }) => {
    await page.goto("/vi/city/");
    await expect(stageOf(page)).toHaveAttribute("data-entrance", "hidden");
    await expect(stageOf(page)).toHaveAttribute("data-entrance", "stepping", { timeout: 3000 });
    await expect(stageOf(page)).toHaveAttribute("data-entrance", "done", { timeout: 4000 });
  });

  test("36.6 the first key starts the entrance, the next one skips it", async ({ page }) => {
    await page.goto("/vi/city/");
    await expect(stageOf(page)).toHaveAttribute("data-entrance", "hidden");
    await stageOf(page).focus();
    await page.keyboard.press("e");
    await expect(stageOf(page)).toHaveAttribute("data-entrance", "stepping");
    await page.keyboard.press("e");
    await expect(stageOf(page)).toHaveAttribute("data-entrance", "done", { timeout: 500 });
  });

  test.describe("reduced motion", () => {
    test.use({ reducedMotion: "reduce" });

    test("36.6 he starts standing at the alley's mouth", async ({ page }) => {
      await page.goto("/vi/city/");
      await page.waitForFunction(() => performance.getEntriesByName("city:first-frame").length > 0);
      await expect(stageOf(page)).toHaveAttribute("data-entrance", "done");
    });

    test("36.2 a click on a building walks him to its door", async ({ page }) => {
      await page.goto("/vi/city/");
      await page.waitForFunction(() => performance.getEntriesByName("city:first-frame").length > 0);
      const data = JSON.parse((await page.locator("[data-city-data]").textContent())!) as CityData;
      const plot = assignLots(data).plots.find((p) => p.lot === "lot-a")!;
      // The camera (no easing with reduced motion) is centred on him at the plaza alley's mouth.
      const lot = PLOT_LOTS.find((l) => l.id === "lot-a")!.rect;
      const cam = toScreen({ x: 26.5, y: 17.5 });
      const aim = toScreen({ x: lot.x + lot.w / 2, y: lot.y + lot.d / 2, z: 1 });
      const box = (await stageOf(page).boundingBox())!;
      await stageOf(page).click({ position: { x: box.width / 2 + (aim.sx - cam.sx) * 0.6, y: box.height / 2 + (aim.sy - cam.sy) * 0.6 } });
      await expect(stageOf(page)).toHaveAttribute("data-walking", "1");
      await expect(stageOf(page)).toHaveAttribute("data-door", plot.id, { timeout: 20_000 });
      await expect(stageOf(page)).toHaveAttribute("data-walking", "0");
    });
  });
});

test.describe("P37 districts, missions, briefings", () => {
  const stageOf = (page: Page) => page.locator("[data-city-stage]");
  const textOf = (page: Page) => page.locator("[data-city-text]").textContent().then((t) => JSON.parse(t!) as { names: Record<string, string>; order: string[] });
  const norm = (t: string) => t.replace(/\s+/g, " ").trim();

  test.describe("reduced motion (he starts at the alley's mouth)", () => {
    test.use({ reducedMotion: "reduce" });
    test.beforeEach(async ({ page }) => {
      await page.addInitScript(() => localStorage.setItem("mode", "mat"));
    });

    test("37.1 F walks to the objective and opens its briefing; Esc closes it; E at the door opens it again", async ({ page }) => {
      await page.goto("/vi/city/");
      await page.waitForFunction(() => performance.getEntriesByName("city:first-frame").length > 0);
      const { order, names } = await textOf(page);
      const first = order[0]!;
      await expect(page.locator("[data-hud-next]")).toHaveText(names[first]!);
      await stageOf(page).focus();
      await page.keyboard.press("f");
      const dialog = page.locator(`dialog[data-brief="${first}"]`);
      await expect(dialog).toHaveAttribute("open", "", { timeout: 25_000 });
      await expect(page.locator("[data-hud-prompt]")).toContainText(names[first]!);
      await expect(page.locator(`[data-log="${first}"]`)).toHaveAttribute("data-state", "briefed");
      await page.keyboard.press("Escape");
      await expect(dialog).not.toHaveAttribute("open");
      await expect(stageOf(page)).toBeFocused();
      await page.keyboard.press("e");
      await expect(dialog).toHaveAttribute("open", "");
      await page.locator(`dialog[data-brief="${first}"] [data-brief-close]`).click();
      await expect(dialog).not.toHaveAttribute("open");
    });
  });

  test("37.2 with storage blocked the city still works; content is never gated by state", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, "sessionStorage", {
        get() {
          throw new DOMException("blocked", "SecurityError");
        },
      });
    });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/vi/city/#d-role-prudential"); // a sealed district, opened straight away
    await expect(page.locator('dialog[data-brief="role-prudential"]')).toHaveAttribute("open", "");
    await expect(page.locator('[data-log="role-prudential"]')).toHaveAttribute("data-state", "briefed");
    expect(errors).toEqual([]);
  });

  for (const mode of ["mat", "giai-mat"] as const) {
    test(`37.3 every briefing reads exactly as its ledger row, vi and en, ${mode}`, async ({ page }) => {
      await page.addInitScript((m) => localStorage.setItem("mode", m), mode);
      for (const l of ["vi", "en"]) {
        await page.goto(`/${l}/#gate-codename`);
        const ledger = await page.locator("[data-ledger] li.row").evaluateAll((rows) =>
          rows.map((r) => {
            r.classList.add("is-open");
            return [(r as HTMLElement).dataset["claim"]!, (r as HTMLElement).innerText] as const;
          }),
        );
        expect(ledger.length).toBeGreaterThan(0);
        await page.goto(`/${l}/city/?lite`); // the dialogs, without the world
        for (const [id, text] of ledger) {
          const row = await page.evaluate((i) => {
            const d = document.querySelector<HTMLDialogElement>(`dialog[data-brief="${i}"]`)!;
            d.showModal();
            const t = d.querySelector<HTMLElement>("li.row")!.innerText;
            d.close();
            return t;
          }, id);
          expect(norm(row), `${l} ${mode} ${id}`).toBe(norm(text));
        }
      }
    });
  }

  for (const [lens, id] of [["partner", "role-bbe-ldc"], ["client", "role-prudential"], ["curious", "project-air-quality"]] as const) {
    test(`37.4 the ${lens} lens points the compass to its first entry`, async ({ page }) => {
      await page.goto(`/en/city/?lens=${lens}`);
      const { names } = await textOf(page);
      await expect(page.locator("[data-hud-next]")).toHaveText(names[id]!);
      await expect(page.locator("[data-hud-light]")).toHaveText(/^Light level \d+ of \d+$/);
    });
  }

  test("37.5 the Vault shows its type label only; the Dead Drop holds the one allowed address", async ({ page, request }) => {
    await page.goto("/en/city/#d-classified-client-files");
    const vault = page.locator('dialog[data-brief="classified-client-files"]');
    await expect(vault).toHaveAttribute("open", "");
    await expect(vault.locator("li.row")).toHaveAttribute("data-kind", "classified");
    await expect(vault.locator(".row__summary, .row__teaser, .row__evidence")).toHaveCount(0);
    await page.keyboard.press("Escape");
    await page.goto("/en/city/#d-dead-drop");
    const drop = page.locator('dialog[data-brief="dead-drop"]');
    await expect(drop).toHaveAttribute("open", "");
    await expect(drop.locator("[data-request]")).toHaveCount(1);
    const allowed = (JSON.parse(readFileSync("tools/leak-allow.json", "utf8")) as { emails: string[] }).emails;
    for (const l of ["vi", "en"]) {
      const html = await (await request.get(`/${l}/city/`)).text();
      const found = new Set(html.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) ?? []);
      expect([...found]).toEqual(allowed);
    }
  });
});

test.describe("P38 day engine", () => {
  // Still frames: no entrance walk, no stirring bars, no rain, instant mode switches.
  test.use({ reducedMotion: "reduce" });

  test("38.2 M in the city switches the dossier's own mode, which the dossier then shows", async ({ page }) => {
    await page.addInitScript(() => {
      if (!sessionStorage.getItem("seeded")) {
        localStorage.setItem("mode", "mat");
        sessionStorage.setItem("seeded", "1");
      }
    });
    await page.goto("/vi/city/");
    await expect(page.locator("html")).toHaveAttribute("data-mode", "mat");
    await page.locator("[data-city-stage]").focus();
    await page.keyboard.press("m");
    await expect(page.locator("html")).toHaveAttribute("data-mode", "giai-mat");
    await page.goto("/vi/#gate-codename");
    await expect(page.locator("html")).toHaveAttribute("data-mode", "giai-mat");
    // And back: the dossier's toggle, then the city follows.
    await page.locator("[data-mode-toggle]").first().click();
    await expect(page.locator("html")).toHaveAttribute("data-mode", "mat");
    await page.goto("/vi/city/");
    await expect(page.locator("html")).toHaveAttribute("data-mode", "mat");
  });

  test("38.3 district states show in both modes: dawn veils sealed districts, night lights briefed ones", async ({ page }) => {
    const shot = async (mode: string, state: string) => {
      await page.addInitScript(([m, s]) => {
        localStorage.setItem("mode", m);
        sessionStorage.setItem("city:districts", s);
      }, [mode, JSON.stringify({ "role-bluesea": state })] as const);
      await page.goto("/vi/city/?quality=medium");
      await page.waitForFunction(() => performance.getEntriesByName("city:first-frame").length > 0);
      await page.waitForTimeout(400);
      return page.locator("[data-city-stage]").screenshot();
    };
    for (const mode of ["giai-mat", "mat"]) {
      const sealed = await shot(mode, "sealed");
      const again = await shot(mode, "sealed");
      const declassified = await shot(mode, "declassified");
      expect(sealed.equals(again), `${mode}: the same state draws the same frame`).toBe(true);
      expect(sealed.equals(declassified), `${mode}: the state shows`).toBe(false);
    }
  });
});

test.describe("full screen on PC and laptop (owner request, 03/11/2026)", () => {
  for (const [w, h] of [[1366, 768], [1920, 1080]] as const) {
    test(`${w}x${h}: the city spans the window's width, no sideways scroll; the button takes it full screen`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await page.goto("/vi/city/");
      const stage = page.locator("[data-city-stage]");
      const box = (await stage.boundingBox())!;
      expect(Math.round(box.width)).toBe(w);
      expect(box.height).toBeGreaterThanOrEqual(560);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
      // The text column stays a column.
      expect((await page.locator(".city__districts").boundingBox())!.width).toBeLessThan(w * 0.8);
      const full = page.locator("[data-hud-full]");
      await expect(full).toBeVisible();
      await full.click();
      await expect.poll(() => page.evaluate(() => document.fullscreenElement?.hasAttribute("data-city-stage") ?? false)).toBe(true);
      await expect(full).toHaveAttribute("aria-pressed", "true");
      await full.click();
      await expect.poll(() => page.evaluate(() => document.fullscreenElement === null)).toBe(true);
    });
  }

  test("a phone keeps the column layout and no full-screen button", async ({ browser }) => {
    const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const page = await phone.newPage();
    await page.goto(`${CITY}/vi/city/`);
    await expect(page.locator("[data-hud-full]")).toBeHidden();
    await phone.close();
  });
});

test("33.5 with the city on, dossier pages load the same JS as with it off, and no more of it", async ({ request }) => {
  // Every script a dossier page loads, through its static imports, by name (hash removed) and size.
  const reach = async (base: string, page: string) => {
    const html = await (await request.get(`${base}${page}`)).text();
    const queue = [...html.matchAll(/(?:src|href)="\/_astro\/([^"]+\.js)"/g)].map((m) => m[1]!);
    const seen = new Map<string, number>();
    while (queue.length) {
      const f = queue.pop()!;
      if (seen.has(f)) continue;
      const body = await (await request.get(`${base}/_astro/${f}`)).text();
      seen.set(f, gzipSync(body).length);
      for (const m of body.matchAll(/(?:from|import)\s*\(?"\.\/([^"]+\.js)"/g)) queue.push(m[1]!);
    }
    return { names: [...seen.keys()].map((f) => f.replace(/\.[A-Za-z0-9_-]{8}\.js$/, "")).sort(), bytes: [...seen.values()].reduce((a, b) => a + b, 0) };
  };
  for (const page of ["/vi/", "/en/"]) {
    const off = await reach(SITE, page);
    const on = await reach(CITY, page);
    expect(on.names, page).toEqual(off.names);
    expect(on.bytes, page).toBeLessThanOrEqual(off.bytes);
  }
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
