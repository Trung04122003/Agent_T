// Entry gate (ROADMAP P25, UX-v3 section 2): a functional splash that identifies the reader. The
// head script in Base.astro decides data-gate="show|skip" before the first paint; this only runs
// the gate when it shows. One action enters: a lens button enters with that lens; "Skip" or Esc
// enters with no lens (owner, 2026-11-01: the common positioning line, the ledger in file order;
// the remembered lens is kept for later). No timer: the gate never closes by itself.
// The opening (strip, question, lenses: CSS in EntryGate.astro, so it starts with the first paint
// and replays when a language change swaps the gate in) runs while every short label decodes here.
// Pointing at a lens types out its reader's line, once the lenses are in (at most 2 effects at once).
import { revealGate, revealName } from "./decode";
import { saveLens } from "./lens";
import { track } from "./gate-metrics";

/** Read-only session flag: set by the test and measuring tools to skip the gate, never by the site. */
export const GATE_KEY = "gateSeen";
/** Everything but the gate: inert while it is open (25.5). */
const OUTSIDE = ['[data-banner="top"]', "header.controls", "main", "footer", '[data-banner="bottom"]'];
export const ENTRY_FX = { line: 480 } as const;

const isOpen = (): boolean => document.documentElement.dataset["gate"] === "show";
const still = (): boolean => matchMedia("(prefers-reduced-motion: reduce)").matches;
let onKey: ((e: KeyboardEvent) => void) | null = null;
let shownAt = 0;
let pointed: string | null = null;
/** No line typed before the opening is over: it would be a third effect at once. */
let ready = false;
/** A lens pointed at during the opening: its line types out as soon as the lenses are in. */
let early: string | null = null;
const previewed = new Set<string>();

function setInert(on: boolean): void {
  for (const sel of OUTSIDE) document.querySelector<HTMLElement>(sel)?.toggleAttribute("inert", on);
}

/** A left-to-right (right-to-left in RTL) clip-path sweep; `steps` gives it a typed feel. */
function sweep(el: Element, duration: number, delay = 0, steps = 0): void {
  if (still()) return;
  const hidden = document.documentElement.dir === "rtl" ? "inset(0 0 0 100%)" : "inset(0 100% 0 0)";
  el.animate([{ clipPath: hidden }, { clipPath: "inset(0 0 0 0)" }], {
    duration,
    delay,
    easing: steps ? `steps(${steps}, end)` : "cubic-bezier(0.2, 0.8, 0.2, 1)",
    fill: "backwards",
  });
}

// Into the file (ROADMAP P26, UX-v3 section 3): an "aperture" opens from where the reader clicked,
// a circle growing over the gate (View Transition of the root, 520 ms: with the ~100 ms the
// browser needs to capture the page, the gate is gone within 700 ms). Narrow screens (< 768 px,
// where capturing the page costs most on a weak CPU) and browsers without View Transitions get a
// 250 ms fade of the gate instead; reduced motion closes it at once. Whatever happens, the gate is
// closed and focus is on the page heading within 1200 ms (26.3).
export const ENTER_FX = { aperture: 520, fade: 250, guard: 1200, narrow: 768 } as const;
/**
 * The opening played on entering (owner, 2026-11-01; EntryGate.astro draws it), by a lens, Skip or
 * Esc: three steps of 480 ms, 60 ms apart, and 120 ms on "access granted". Its own Skip button
 * (focused, so Enter or Space works too) cuts it short; reduced motion goes straight in. The 1200 ms
 * guard counts from its end.
 */
export const LOAD = { total: 1680 } as const;
let leaving = false;

/** Resolves when `p` does, rejects if it fails or takes longer than the guard. */
function guarded(p: Promise<unknown>): Promise<unknown> {
  return Promise.race([p, new Promise((_, fail) => setTimeout(() => fail(new Error("gate: transition timed out")), ENTER_FX.guard))]);
}

function enter(via: "lens" | "skip" | "esc", lens: string | null, at?: { x: number; y: number }): void {
  const gate = document.querySelector<HTMLElement>("[data-entry]");
  if (leaving || !gate || !isOpen()) return;
  leaving = true;
  const body = gate.querySelector<HTMLElement>(".entry__body")!;
  body.inert = true; // no second choice while it closes
  const load = still() ? null : gate.querySelector<HTMLElement>("[data-entry-load]");
  const root = document.documentElement;
  // Bookkeeping after the next paint, so the click answers at once (INP, 26.5).
  const ms = Math.round(performance.now() - shownAt);
  setTimeout(() => {
    track({ type: "enter", via, lens, ms });
    if (lens) saveLens(lens);
  });
  const url = new URL(location.href);
  if (lens) url.searchParams.set("lens", lens);
  else url.searchParams.delete("lens");
  history.replaceState(history.state, "", url);
  if (onKey) removeEventListener("keydown", onKey);
  onKey = null;
  // The lens is applied without FLIP and, with the aperture, before the new state is captured,
  // so the ledger does not move a second time (26.4).
  const applyLens = (): void => {
    document.querySelector("[data-lens-nav]")?.dispatchEvent(new CustomEvent("lens:sync", { detail: { animate: false } }));
  };
  let done = false;
  const finish = (): void => {
    if (done) return;
    done = true;
    root.dataset["gate"] = "skip";
    delete root.dataset["vt"];
    gate.classList.remove("is-loading");
    body.inert = false;
    // The page (mode button included) stays inert until here: no Declassify on top of the
    // aperture (26.4).
    setInert(false);
    gate.inert = false;
    leaving = false;
    // Focus back to the page's heading (25.5).
    const h1 = document.querySelector<HTMLElement>("#gate-codename");
    if (h1) {
      h1.tabIndex = -1;
      h1.focus({ preventScroll: true });
    }
    performance.mark("gate:entered"); // read by tools/perf/gate-inp.mjs and e2e/entry.e2e.ts
    void revealGate(root.dir);
  };

  const open = (): void => {
  gate.inert = true;
  if (still()) {
    applyLens();
    return finish();
  }
  try {
    if (!document.startViewTransition || innerWidth < ENTER_FX.narrow) {
      // The fade starts at once; the reorder waits a frame, behind the still-opaque gate (INP).
      const fade = gate.animate([{ opacity: 1 }, { opacity: 0 }], { duration: ENTER_FX.fade, easing: "ease-out", fill: "forwards" });
      requestAnimationFrame(applyLens);
      guarded(fade.finished).then(finish, finish);
      return;
    }
    const x = at?.x ?? innerWidth / 2;
    const y = at?.y ?? innerHeight / 2;
    root.style.setProperty("--vt-x", `${x}px`);
    root.style.setProperty("--vt-y", `${y}px`);
    root.style.setProperty("--vt-r", `${Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))}px`);
    root.dataset["vt"] = "gate";
    const transition = document.startViewTransition(() => {
      applyLens();
      root.dataset["gate"] = "skip";
    });
    transition.ready.then(() => performance.mark("gate:aperture-ready"), () => {});
    guarded(transition.finished).then(finish, () => {
      transition.skipTransition();
      finish();
    });
  } catch {
    applyLens();
    finish();
  }
  };
  if (!load) return open();
  // The opening: the chosen lens named, the steps run in CSS; then the aperture as before.
  if (lens) load.querySelector("[data-entry-load-lens]")!.textContent = gate.querySelector(`[data-entry-lens="${lens}"]`)!.textContent;
  gate.classList.add("is-loading"); // shows it (CSS)
  // The hidden gate stops moving (a reader's line may still be typing): two effects at most.
  for (const a of body.getAnimations({ subtree: true })) a.cancel();
  const skip = load.querySelector<HTMLElement>("[data-entry-load-skip]")!;
  // Once only: the timer or Skip, whichever comes first.
  const go = (): void => {
    clearTimeout(timer);
    skip.onclick = null;
    open();
  };
  const timer = setTimeout(go, LOAD.total);
  skip.onclick = go;
  skip.focus();
}

/** Where a click started the aperture: the pointer, or the control's centre from the keyboard. */
function origin(e: MouseEvent): { x: number; y: number } {
  if (e.detail > 0) return { x: e.clientX, y: e.clientY };
  const box = (e.currentTarget as Element).getBoundingClientRect();
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
}

/** Runs on load and again after a language swap while the gate is open (focus on the new flag). */
export function initEntry(afterLangSwap = false): void {
  const gate = document.querySelector<HTMLElement>("[data-entry]");
  const root = document.documentElement;
  if (!gate || !isOpen()) return;
  setInert(true);
  if (afterLangSwap) track({ type: "lang", lang: root.lang });
  else {
    shownAt = performance.now();
    track({ type: "shown", lang: root.lang });
    addEventListener("pagehide", () => isOpen() && track({ type: "leave", ms: Math.round(performance.now() - shownAt) }), { once: true });
  }

  const lensButtons = [...gate.querySelectorAll<HTMLButtonElement>("[data-entry-lens]")];
  const line = gate.querySelector<HTMLElement>("[data-entry-line]")!;
  const point = (id: string, animate: boolean): void => {
    if (!ready) return void (early = id);
    // The wording of the current mode: Mat's own where the owner gave one, else the plain line.
    const versions = gate.querySelector(`[data-entry-line-for="${id}"]`);
    const mode = root.dataset["mode"] === "giai-mat" ? "plain" : "mat";
    const pick = versions?.querySelector(`[data-line-mode="${mode}"]`) ?? versions?.querySelector('[data-line-mode="plain"]');
    const text = pick?.textContent?.trim() ?? "";
    for (const b of lensButtons) b.classList.toggle("is-pointed", b.dataset["entryLens"] === id);
    if (pointed === id && line.textContent === text) return;
    pointed = id;
    line.textContent = text;
    if (text && animate) sweep(line, ENTRY_FX.line, 0, Math.min(40, text.length));
    if (!previewed.has(id)) previewed.add(id), track({ type: "preview", lens: id });
  };

  for (const b of lensButtons) {
    const id = b.dataset["entryLens"]!;
    b.addEventListener("click", (e) => enter("lens", id, origin(e)));
    b.addEventListener("pointerenter", (e) => e.pointerType === "mouse" && point(id, true));
    b.addEventListener("focus", () => point(id, true));
  }
  gate.querySelector<HTMLElement>("[data-entry-skip]")?.addEventListener("click", (e) => {
    e.preventDefault();
    enter("skip", null, origin(e));
  });
  if (onKey) removeEventListener("keydown", onKey);
  onKey = (e) => e.key === "Escape" && isOpen() && enter("esc", null);
  addEventListener("keydown", onKey);

  // The opening sequence: the whole screen decodes (owner request: on a language change too).
  const dir = root.dir;
  for (const el of gate.querySelectorAll<HTMLElement>("[data-entry-decode], [data-entry-codename]")) {
    if (el.getClientRects().length) void revealName(el, el.textContent?.trim() ?? "", dir);
  }
  // Focus: the first lens on opening, the chosen flag after a language change. The line follows
  // once the lenses are in: the one pointed at meanwhile, else the focused first lens, else (after
  // a language change) the one pointed at before, in the new language.
  const keep = afterLangSwap ? pointed : null;
  ready = false;
  early = null;
  pointed = null;
  line.textContent = "";
  if (afterLangSwap) gate.querySelector<HTMLElement>('[data-entry-lang][aria-current="page"]')?.focus();
  else lensButtons[0]?.focus({ preventScroll: true });
  const opening = lensButtons.flatMap((b) => b.getAnimations().map((a) => a.finished));
  void Promise.allSettled(opening).then(() => {
    if (!gate.isConnected || !isOpen()) return; // swapped out by a language change, or entered
    ready = true;
    performance.mark("gate:lenses-in"); // read by tools/gate-eval.mjs
    const first = document.activeElement === lensButtons[0] ? lensButtons[0]!.dataset["entryLens"]! : null;
    const id = early ?? first ?? keep;
    if (id) point(id, true);
  });
}
