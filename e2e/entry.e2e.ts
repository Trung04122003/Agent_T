import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { FIXTURE, SITE } from "../playwright.config";

// P25: the entry gate. This file meets the gate as a first-time reader (a fresh session), unlike
// the rest of the suite (e2e/test.ts).
const ui = JSON.parse(readFileSync("content/ui.json", "utf8"));
const lenses = JSON.parse(readFileSync("content/lenses.json", "utf8")).lenses as { id: string; label: { vi: string; en: string } }[];
const firstClaim = (JSON.parse(readFileSync("content/claims.json", "utf8")) as { id: string; visibility?: string }[]).find(
  (c) => c.visibility !== "hold",
)!.id;
const gateOf = (page: Page) => page.locator("[data-entry]");
const state = (page: Page) => page.evaluate(() => document.documentElement.dataset["gate"] ?? null);

test.describe("25.1 / 25.6 when the gate shows", () => {
  test("shown, decided in the head; shown again on reload (owner 2026-11-01), nothing stored", async ({ page }) => {
    // The decision exists before the body is parsed: read it from the first script that can run.
    await page.addInitScript(() => {
      document.addEventListener("readystatechange", () => {
        if (document.readyState === "interactive") (window as unknown as { __early: string | undefined }).__early ??= document.documentElement.dataset["gate"];
      });
    });
    await page.goto("/vi/");
    expect(await state(page)).toBe("show");
    expect(await page.evaluate(() => (window as unknown as { __early: string }).__early)).toBe("show");
    await expect(gateOf(page)).toBeVisible();
    await page.reload();
    expect(await state(page)).toBe("show");
    await expect(gateOf(page)).toBeVisible();
    expect(await page.evaluate(() => sessionStorage.length)).toBe(0);
  });

  for (const [name, url] of [
    ["deep link", `/vi/#claim-${firstClaim}`],
    ["?skip=1", "/vi/?skip=1"],
    ["?skip", "/vi/?skip"],
  ] as const) {
    test(`not shown: ${name}`, async ({ page }) => {
      await page.goto(url);
      expect(await state(page)).toBe("skip");
      await expect(gateOf(page)).toBeHidden();
      // A plain load right after still shows it.
      await page.goto("/vi/");
      expect(await state(page)).toBe("show");
    });
  }

  test("not shown when printing, even on a first view", async ({ page }) => {
    await page.goto("/vi/");
    await page.emulateMedia({ media: "print" });
    await expect(gateOf(page)).toBeHidden();
    await expect(page.locator("[data-onepage]")).toBeVisible();
  });

  test.describe("without JavaScript", () => {
    test.use({ javaScriptEnabled: false });
    test("no gate, the content is there", async ({ page }) => {
      await page.goto("/vi/");
      await expect(gateOf(page)).toBeHidden();
      await expect(page.locator("#gate-codename")).toBeVisible();
      await expect(page.locator("main")).not.toHaveAttribute("inert", /.*/);
    });
  });

  test("other pages never show it", async ({ page }) => {
    await page.goto("/vi/no-such-page");
    expect(await state(page)).toBeNull();
    await expect(gateOf(page)).toHaveCount(0);
  });
});

test("25.2 content: strip, codename, the question, three lenses, flags, Skip from the start; no fake loading", async ({ page }) => {
  await page.goto("/vi/", { waitUntil: "commit" });
  const gate = gateOf(page);
  // Skip is there from the first moment: no wait, no timer.
  await expect(gate.locator("[data-entry-skip]")).toBeVisible({ timeout: 2000 });
  await expect(gate.locator("[data-entry-skip]")).toContainText(ui.entrySkip.vi);
  await expect(gate.locator(".entry__strip")).toContainText(`${ui.portraitLabel.vi} · ${ui.classLevelLabel.vi}: ${ui.modeMat.vi}`);
  await expect(gate.locator("[data-entry-codename]")).toHaveText("Cupid");
  await expect(gate.locator("#entry-title")).toHaveText(ui.entryTitle.vi);
  await expect(gate.locator("[data-entry-lens]")).toHaveText(lenses.map((l) => l.label.vi));
  await expect(gate.locator("[data-entry-lang]")).toHaveCount(2);
  const text = (await gate.textContent())!.toLowerCase();
  for (const bad of ["%", "loading", "đang tải", "tải"]) expect(text, bad).not.toContain(bad);
  await expect(gate.locator("progress, [role=progressbar]")).toHaveCount(0);
});

test("25.2 at most 2 effects at once while the gate opens", async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __max: number; __groups: string[] };
    w.__max = 0;
    const tick = () => {
      // Moving now only: past its delay and not finished (as e2e/budget.e2e.ts counts).
      const moving = document.getAnimations().filter((a) => {
        if (a.playState !== "running") return false;
        const t = (a.effect as KeyframeEffect).getComputedTiming();
        const local = Number(t.localTime);
        return local >= Number(t.delay) && local < Number(t.delay) + Number(t.activeDuration);
      });
      const groups = new Set(
        moving.map((a) => {
          const el = (a.effect as KeyframeEffect).target as Element | null;
          return `${el?.tagName}.${el?.getAttribute("class") ?? ""}`;
        }),
      );
      if (groups.size > w.__max) w.__groups = [...groups];
      w.__max = Math.max(w.__max, groups.size);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await page.goto("/vi/");
  await page.waitForTimeout(1500);
  // A language change replays the sequence; still at most 2.
  await gateOf(page).locator('[data-entry-lang="en"]').click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.waitForTimeout(1500);
  const { max, groups } = await page.evaluate(() => {
    const w = window as unknown as { __max: number; __groups: string[] };
    return { max: w.__max, groups: w.__groups };
  });
  expect(max, groups?.join(" | ")).toBeLessThanOrEqual(2);
});

type LensLines = { id: string; positioning: { vi: string }; positioningMat: { vi: string } }[];

test("owner request: pointing at a lens types out that reader's line (Mat wording); buttons are described by it", async ({ page }) => {
  const real = JSON.parse(readFileSync("content/lenses.json", "utf8")).lenses as LensLines;
  const lineOf = (id: string) => real.find((l) => l.id === id)!.positioningMat.vi;
  await page.goto("/vi/");
  const line = gateOf(page).locator("[data-entry-line]");
  // Focus starts on the first lens: its line follows once the lenses are in.
  await expect(line).toHaveText(lineOf("partner"));
  await gateOf(page).locator('[data-entry-lens="client"]').hover();
  await expect(line).toHaveText(lineOf("client"));
  await expect(gateOf(page).locator('[data-entry-lens="client"]')).toHaveClass(/is-pointed/);
  await expect(line).toHaveAttribute("aria-hidden", "true");
  for (const l of real) {
    await expect(gateOf(page).locator(`[data-entry-lens="${l.id}"]`)).toHaveAccessibleDescription(l.positioningMat.vi);
  }
});

test("owner request: in Giai mat the gate reads each reader's plain line, not the Mat one", async ({ page }) => {
  const real = JSON.parse(readFileSync("content/lenses.json", "utf8")).lenses as LensLines;
  await page.addInitScript(() => localStorage.setItem("mode", "giai-mat"));
  await page.goto("/vi/");
  const line = gateOf(page).locator("[data-entry-line]");
  await expect(line).toHaveText(real.find((l) => l.id === "partner")!.positioning.vi);
  await gateOf(page).locator('[data-entry-lens="curious"]').hover();
  await expect(line).toHaveText(real.find((l) => l.id === "curious")!.positioning.vi);
  for (const l of real) {
    expect(l.positioning.vi).not.toBe(l.positioningMat.vi); // two real wordings
    await expect(gateOf(page).locator(`[data-entry-lens="${l.id}"]`)).toHaveAccessibleDescription(l.positioning.vi);
  }
  // After entering, the page heading shows the same plain line.
  await gateOf(page).locator('[data-entry-lens="curious"]').click();
  await expect(page.locator('[data-positioning-lens="curious"]:visible')).toHaveText(real.find((l) => l.id === "curious")!.positioning.vi);
});

test("owner request: a language change decodes the whole gate screen", async ({ page }) => {
  await page.goto("/vi/");
  await page.waitForTimeout(1200);
  // Record what the Skip label and the lens labels read, frame by frame, across the change.
  await page.evaluate(() => {
    const w = window as unknown as { __seen: Record<string, string[]> };
    w.__seen = {};
    const tick = () => {
      document.querySelectorAll<HTMLElement>("[data-entry] [data-entry-decode], [data-entry-codename]").forEach((el, i) => {
        (w.__seen[i] ??= []).push(el.textContent ?? "");
      });
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await gateOf(page).locator('[data-entry-lang="en"]').click();
  await expect(gateOf(page).locator("[data-entry-skip]")).toContainText(ui.entrySkip.en);
  await page.waitForTimeout(600);
  const seen = await page.evaluate(() => (window as unknown as { __seen: Record<string, string[]> }).__seen);
  const finals = await gateOf(page).locator("[data-entry-decode]:visible").allTextContents();
  // Every visible short label went through scrambled states before settling.
  const scrambled = Object.values(seen).filter((states) => new Set(states).size > 2).length;
  expect(scrambled).toBeGreaterThanOrEqual(finals.length);
  await expect(gateOf(page).locator("[data-entry-lens]")).toHaveText(lenses.map((l) => l.label.en));
});

test("evaluation (owner exception): the gate's events stay in the browser", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (r) => requests.push(new URL(r.url()).origin));
  await page.goto("/vi/");
  await gateOf(page).locator('[data-entry-lens="client"]').hover();
  await expect(gateOf(page).locator("[data-entry-line]")).not.toBeEmpty(); // the reader saw the line
  await gateOf(page).locator('[data-entry-lens="client"]').click();
  const log = await page.evaluate(() => JSON.parse(localStorage.getItem("gateMetrics") ?? "[]"));
  const types = log.map((e: { type: string }) => e.type);
  expect(types[0]).toBe("shown");
  expect(types).toContain("preview");
  const enter = log.find((e: { type: string }) => e.type === "enter");
  expect(enter).toMatchObject({ via: "lens", lens: "client" });
  expect(enter.ms).toBeGreaterThan(0);
  expect(new Set(requests)).toEqual(new Set([new URL(SITE).origin])); // nothing sent anywhere
});

test("25.3 one action enters: a lens button enters with that lens", async ({ page }) => {
  await page.goto("/vi/");
  await gateOf(page).locator('[data-entry-lens="client"]').click(); // the one action
  await expect(gateOf(page)).toBeHidden();
  expect(await state(page)).toBe("skip");
  expect(new URL(page.url()).searchParams.get("lens")).toBe("client");
  await expect(page.locator('[data-lens="client"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("main")).not.toHaveAttribute("inert", /.*/);
});

// Owner, 2026-11-01: Skip and Esc enter with no lens (they used to pick Partner): the common
// positioning line, no lens pressed, no ?lens=, even when a lens is remembered from before.
for (const how of ["Skip", "Esc"] as const) {
  test(`25.3 ${how} enters with no lens: the common positioning line`, async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("lens", "client")); // remembered, not applied
    await page.goto("/vi/");
    if (how === "Skip") await gateOf(page).locator("[data-entry-skip]").click();
    else await page.keyboard.press("Escape");
    await expect(gateOf(page)).toBeHidden({ timeout: 4000 });
    expect(new URL(page.url()).searchParams.get("lens")).toBeNull();
    for (const id of ["partner", "client", "curious"]) await expect(page.locator(`[data-lens="${id}"]`)).toHaveAttribute("aria-pressed", "false");
    await expect(page.locator("[data-positioning]:visible")).toHaveCount(1);
    await expect(page.locator("[data-positioning-lens]:visible")).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem("lens"))).toBe("client"); // kept for later
  });
}

test("25.4 lens and language are remembered for later visits; the lens can still change", async ({ context }) => {
  const first = await context.newPage();
  await first.goto("/vi/");
  // Language picked in the gate: the gate stays, now in English, focus on the chosen flag.
  await gateOf(first).locator('[data-entry-lang="en"]').click();
  await expect(first.locator("html")).toHaveAttribute("lang", "en");
  await expect(gateOf(first).locator("#entry-title")).toHaveText(ui.entryTitle.en);
  await expect(gateOf(first).locator('[data-entry-lang="en"]')).toBeFocused();
  await gateOf(first).locator('[data-entry-lens="curious"]').click();
  await expect(gateOf(first)).toBeHidden();
  await first.close();

  // A later visit (new tab = new session): the gate shows again, in English. Skip enters with no
  // lens (owner, 2026-11-01); the remembered one is kept for later.
  const later = await context.newPage();
  await later.goto("/");
  await expect(later).toHaveURL(/\/en\/$/);
  await expect(gateOf(later)).toBeVisible();
  await gateOf(later).locator("[data-entry-skip]").click();
  await expect(gateOf(later)).toBeHidden({ timeout: 4000 });
  await expect(later.locator('[data-lens="curious"]')).toHaveAttribute("aria-pressed", "false");
  expect(await later.evaluate(() => localStorage.getItem("lens"))).toBe("curious");
  // "In what capacity are you here?" still changes it, and that is remembered too.
  await later.locator('[data-lens="client"]').click();
  expect(await later.evaluate(() => localStorage.getItem("lens"))).toBe("client");
});

test("25.4 storage blocked: the gate still shows, no error", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    for (const k of ["sessionStorage", "localStorage"]) {
      Object.defineProperty(window, k, {
        get() {
          throw new DOMException("blocked", "SecurityError");
        },
      });
    }
  });
  await page.goto("/vi/");
  expect(await state(page)).toBe("show");
  await expect(gateOf(page)).toBeVisible();
  // Entering still works with nothing remembered.
  await gateOf(page).locator('[data-entry-lens="client"]').click();
  await expect(gateOf(page)).toBeHidden();
  await expect(page.locator("#gate-codename")).toBeVisible();
  expect(errors).toEqual([]);
});

test("25.5 dialog semantics, inert page, focus in and back; axe passes", async ({ page }) => {
  await page.goto("/vi/");
  const gate = gateOf(page);
  await expect(gate).toHaveAttribute("role", "dialog");
  await expect(gate).toHaveAttribute("aria-modal", "true");
  await expect(gate).toHaveAttribute("aria-labelledby", "entry-title");
  for (const sel of ["main", "header.controls", "footer"]) await expect(page.locator(sel)).toHaveAttribute("inert", "");
  await expect(gate.locator("[data-entry-lens]").first()).toBeFocused();
  // The keyboard stays in the gate.
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press("Tab");
    expect(await page.evaluate(() => !!document.activeElement?.closest("[data-entry]") || document.activeElement === document.body)).toBe(true);
  }
  const result = await new AxeBuilder({ page }).include("[data-entry]").analyze();
  expect(result.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);

  await gate.locator("[data-entry-lens]").first().focus();
  await page.keyboard.press("Enter");
  await expect(gate).toBeHidden();
  await expect(page.locator("#gate-codename")).toBeFocused();
});

test("25.6 no extra request; the gate's JS is at most 3.2 KB gzip", async ({ page, browser }) => {
  const urls = async (p: Page, path: string) => {
    const seen: string[] = [];
    p.on("request", (r) => seen.push(new URL(r.url()).pathname));
    await p.goto(path);
    await p.waitForLoadState("networkidle");
    return seen.sort();
  };
  const withGate = await urls(page, "/vi/");
  const other = await (await browser.newContext()).newPage();
  const without = await urls(other, "/vi/?skip=1");
  expect(withGate).toEqual(without);
  expect(withGate.every((u) => !u.startsWith("http"))).toBe(true);

  // Size: the decision in the head, the gate's script and the chunks it imports that hold gate
  // code (the lens chunk is the page's own, loaded with or without the gate).
  const html = await (await page.request.get(`${SITE}/vi/`)).text();
  const head = html.match(/var g="show".*?dataset\.gate=g;/)![0];
  const entrySrc = html.match(/<script type="module" src="([^"]*EntryGate[^"]*)"/)![1]!;
  const files = [entrySrc];
  const get = async (src: string) => (await page.request.get(`${SITE}${src}`)).text();
  const script = await get(entrySrc);
  for (const m of script.matchAll(/from"\.\/([^"]+)"/g)) files.push(`/_astro/${m[1]}`);
  const bodies = await Promise.all(files.map(get));
  expect(bodies.some((b) => b.includes("data-entry-lens")), "gate module found").toBe(true);
  const size = gzipSync(head).length + bodies.reduce((n, b) => n + gzipSync(b).length, 0);
  test.info().annotations.push({ type: "size", description: `gate JS ${size} B gzip` });
  // 3 KB until the opening after a lens (owner, 2026-11-01): 3.2 KB since.
  expect(size).toBeLessThanOrEqual(3.2 * 1024);
});

test("25.7 a lens line replaces the common line only where the owner wrote one", async ({ page }) => {
  // Real content: every lens has its line (owner request, 28/10/2026); entering shows that one.
  const real = JSON.parse(readFileSync("content/lenses.json", "utf8")).lenses as LensLines;
  await page.goto("/vi/");
  await expect(page.locator("[data-positioning-lens]")).toHaveCount(real.length * 2); // Mat + Giai mat wordings
  await gateOf(page).locator('[data-entry-lens="curious"]').click();
  // Mat (the default mode) shows the Mat wording.
  await expect(page.locator('[data-positioning-lens="curious"]:visible')).toHaveText(real.find((l) => l.id === "curious")!.positioningMat.vi);
  await expect(page.locator("[data-positioning]:visible")).toHaveCount(0);
  // Fixture: the client lens has a test line, partner has none (null: the common line stays).
  const fixture = JSON.parse(readFileSync("e2e/fixtures/lenses.json", "utf8")).lenses as { id: string; positioning?: { vi: string } | null }[];
  const line = fixture.find((l) => l.id === "client")!.positioning!.vi;
  await page.goto(`${FIXTURE}/vi/`);
  await gateOf(page).locator('[data-entry-lens="client"]').click();
  await expect(page.locator('[data-positioning-lens="client"]')).toBeVisible();
  await expect(page.locator('[data-positioning-lens="client"]')).toHaveText(line);
  for (const p of await page.locator("[data-positioning]").all()) await expect(p).toBeHidden();
  await page.locator('[data-lens="partner"]').click();
  await expect(page.locator('[data-positioning-lens="client"]')).toBeHidden();
  await expect(page.locator("[data-positioning]:visible")).toHaveCount(1);
});

// Owner request 2026-11-01: after a lens is chosen, a "special-ops" opening (three ~half-second
// steps, a bar and a scan that lights the grid), then the aperture. Replaces 25.2's "no loader".
test.describe("the opening after a lens is chosen", () => {
  const lensesIn = (page: Page) => page.waitForFunction(() => performance.getEntriesByName("gate:lenses-in").length > 0);
  const enteredAt = (page: Page, timeout = 4000) =>
    page.waitForFunction(() => performance.getEntriesByName("gate:entered")[0]?.startTime ?? 0, null, { timeout }).then((h) => h.jsonValue());

  test("names the lens, runs three steps, then opens the file; transform only, each step <= 600 ms", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/vi/");
    await lensesIn(page);
    const load = gateOf(page).locator("[data-entry-load]");
    await expect(load).toBeHidden();
    // Watch, frame by frame, when the last mark and "access granted" show (they are up for a
    // moment only, before the aperture takes the gate away).
    await page.evaluate(() => {
      const w = window as unknown as { __seen: Record<string, boolean> };
      w.__seen = {};
      const tick = () => {
        const shown = (sel: string) => {
          const el = document.querySelector(sel);
          return !!el && getComputedStyle(el).visibility === "visible" && el.getClientRects().length > 0;
        };
        if (shown(".entry__load-steps li:last-child b")) w.__seen["last"] = true;
        if (shown(".entry__load-granted")) w.__seen["granted"] = true;
        if (document.documentElement.dataset["gate"] === "show") requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    const clickedAt = await page.evaluate(() => performance.now());
    await gateOf(page).locator('[data-entry-lens="client"]').click();
    await expect(load).toBeVisible();
    await expect(load).toHaveAttribute("role", "status");
    await expect(load.locator("[data-entry-load-lens]")).toHaveText(lenses.find((l) => l.id === "client")!.label.vi);
    await expect(load.locator("[data-entry-load-skip]")).toBeFocused();
    await expect(load.locator(".entry__load-steps li")).toHaveText([ui.entryLoadVerify.vi, ui.entryLoadDecrypt.vi, ui.entryLoadUnlock.vi].map((s) => new RegExp(s)));
    // What moves: the bar and the scan, by transform, each part at most 600 ms.
    const moves = await load.evaluate((l) =>
      l.getAnimations({ subtree: true }).map((a) => ({
        name: (a as CSSAnimation).animationName,
        duration: Number(a.effect!.getComputedTiming().duration),
        props: Object.keys((a.effect as KeyframeEffect).getKeyframes()[1] ?? {}).filter((k) => !["offset", "easing", "composite", "computedOffset"].includes(k)),
      })),
    );
    for (const m of moves) expect(m.duration, m.name).toBeLessThanOrEqual(600);
    for (const m of moves.filter((x) => x.name === "entry-scan" || x.name === "entry-fill")) expect(m.props).toEqual(["transform"]);
    expect(moves.filter((m) => m.name === "entry-scan")).toHaveLength(3);
    expect(moves.filter((m) => m.name === "entry-fill")).toHaveLength(3);
    const at = (await enteredAt(page)) as number;
    // All three marks and "access granted" showed before it went on.
    expect(await page.evaluate(() => (window as unknown as { __seen: Record<string, boolean> }).__seen)).toEqual({ last: true, granted: true });
    expect(at - clickedAt).toBeGreaterThanOrEqual(1600); // the owner's longer wait, really waited
    await expect(gateOf(page)).toBeHidden();
    await expect(page.locator("#gate-codename")).toBeFocused();
    expect(new URL(page.url()).searchParams.get("lens")).toBe("client");
  });

  test("at most 2 things move at once during the opening", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/vi/");
    await lensesIn(page);
    await gateOf(page).locator('[data-entry-lens="partner"]').click();
    const { max, groups } = await page.evaluate(
      () =>
        new Promise<{ max: number; groups: string[] }>((done) => {
          let max = 0;
          let groups: string[] = [];
          const start = performance.now();
          const tick = () => {
            const moving = document.getAnimations().filter((a) => {
              if (a.playState !== "running") return false;
              const t = (a.effect as KeyframeEffect).getComputedTiming();
              const local = Number(t.localTime);
              return local >= Number(t.delay) && local < Number(t.delay) + Number(t.activeDuration);
            });
            const g = new Set(moving.map((a) => `${((a.effect as KeyframeEffect).target as Element | null)?.tagName}.${((a.effect as KeyframeEffect).target as Element | null)?.getAttribute("class") ?? ""}`));
            if (g.size > max) (max = g.size), (groups = [...g]);
            if (performance.now() - start < 1700) requestAnimationFrame(tick);
            else done({ max, groups });
          };
          requestAnimationFrame(tick);
        }),
    );
    expect(max, groups.join(" | ")).toBeLessThanOrEqual(2);
  });

  test("its Skip goes straight on", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/vi/");
    await lensesIn(page);
    await gateOf(page).locator('[data-entry-lens="curious"]').click();
    const skippedAt = await page.evaluate(() => performance.now());
    await gateOf(page).locator("[data-entry-load-skip]").click();
    const at = (await enteredAt(page)) as number;
    expect(at - skippedAt).toBeLessThan(1300); // the aperture only (guard 1200 ms)
    expect(new URL(page.url()).searchParams.get("lens")).toBe("curious");
  });

  test("Skip and Esc on the gate play the opening too, for an unidentified reader", async ({ page }) => {
    for (const how of ["Skip", "Esc"] as const) {
      await page.goto("/vi/"); // the gate shows on every load
      await lensesIn(page);
      if (how === "Skip") await gateOf(page).locator("[data-entry-skip]").click();
      else await page.keyboard.press("Escape");
      const load = gateOf(page).locator("[data-entry-load]");
      await expect(load).toBeVisible();
      await expect(load.locator("[data-entry-load-lens]")).toHaveText(ui.entryLoadUnknown.vi);
      await expect(load.locator("[data-entry-load-skip]")).toBeFocused();
      expect((await enteredAt(page)) as number).toBeGreaterThan(0);
      expect(new URL(page.url()).searchParams.get("lens")).toBeNull();
    }
  });

  test("reduced motion: no opening", async ({ page }) => {

    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/vi/");
    const after = await gateOf(page).locator('[data-entry-lens="partner"]').evaluate((b) => {
      (b as HTMLElement).click();
      return { gate: document.documentElement.dataset["gate"], loading: document.querySelector("[data-entry]")!.classList.contains("is-loading") };
    });
    expect(after).toEqual({ gate: "skip", loading: false });
  });
});
