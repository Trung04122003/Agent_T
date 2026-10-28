// Entry gate (ROADMAP P25, UX-v3 section 2): a functional splash that identifies the reader. The
// head script in Base.astro decides data-gate="show|skip" before the first paint; this only runs
// the gate when it shows. One action enters: a lens button enters with that lens; "Skip" or Esc
// enters with the remembered lens (or Partner). No timer: the gate never closes by itself.
// The opening (strip, question, lenses: CSS in EntryGate.astro, so it starts with the first paint
// and replays when a language change swaps the gate in) runs while every short label decodes here.
// Pointing at a lens types out its reader's line, once the lenses are in (at most 2 effects at once).
import { revealGate, revealName } from "./decode";
import { readLens, saveLens } from "./lens";
import { track } from "./gate-metrics";

export const GATE_KEY = "gateSeen";
const DEFAULT_LENS = "partner";
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

function enter(via: "lens" | "skip" | "esc", lens: string): void {
  const root = document.documentElement;
  track({ type: "enter", via, lens, ms: Math.round(performance.now() - shownAt) });
  saveLens(lens);
  const url = new URL(location.href);
  url.searchParams.set("lens", lens);
  history.replaceState(history.state, "", url);
  document.querySelector("[data-lens-nav]")?.dispatchEvent(new CustomEvent("lens:sync", { detail: { animate: false } }));
  root.dataset["gate"] = "skip";
  setInert(false);
  if (onKey) removeEventListener("keydown", onKey);
  onKey = null;
  // Focus back to the page's heading (25.5).
  const h1 = document.querySelector<HTMLElement>("#gate-codename");
  if (h1) {
    h1.tabIndex = -1;
    h1.focus({ preventScroll: true });
  }
  void revealGate(root.dir);
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

  const fallback = readLens() ?? DEFAULT_LENS;
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
    b.addEventListener("click", () => enter("lens", id));
    b.addEventListener("pointerenter", (e) => e.pointerType === "mouse" && point(id, true));
    b.addEventListener("focus", () => point(id, true));
  }
  gate.querySelector("[data-entry-skip]")?.addEventListener("click", (e) => {
    e.preventDefault();
    enter("skip", fallback);
  });
  if (onKey) removeEventListener("keydown", onKey);
  onKey = (e) => e.key === "Escape" && isOpen() && enter("esc", fallback);
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
