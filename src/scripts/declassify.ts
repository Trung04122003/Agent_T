// Mode change with motion (UX section 3, signature 1 "Declassify"). All timings live here and in
// src/styles/motion.css, so the effect layer can be cut without touching behaviour (mode.ts).
import { currentMode, setMode, type Mode } from "./mode";

/**
 * Declassify v2 (ROADMAP 16.1), never more than 2 effects at a time (UX-v2 section 1). The owner
 * chose (2026-10-27) to keep every effect and let the bars move slowly enough to be seen, so the
 * scene runs 720 ms instead of the 600 ms the roadmap asked for (about 800 ms from the click,
 * with the browser's page capture). Every effect starts from the same clock (transition.ready,
 * when the reveal starts); hand-overs keep a 10 ms gap so a dropped frame never lines up three
 * effects. Milliseconds from the scene start:
 *     0-140  reveal + stamp       150-255  reveal + portrait
 *   265-360  bars + banner        370-570  bars + chart line     570-720  bars (last ends at 720)
 * The bars start as soon as the reveal is done and each one eases out over 280 ms, 25 ms apart.
 * Closing runs the same way without the chart line (the chart is a signal in Mat).
 * The text under the bars has no fade of its own: the shrinking bars uncover it.
 */
export const TIMING = {
  total: 720,
  reveal: 255, // View Transition circle, both directions
  fallback: 250, // crossfade when View Transitions are missing
  stamp: 140, // toggle stamp flip, with the reveal
  portraitAt: 150,
  portrait: 105, // previous photo fades out, done with the reveal
  bannerAt: 265,
  banner: 95, // classification strip types its new level in (clip-path)
  chartAt: 370,
  chart: 200, // chart line drawn left to right (clip-path), opening only
  barsAt: 265,
  bar: 280,
  barStagger: 25,
  maxBars: 8,
} as const;

// Only bars that exist in Mat alone; classified bars stay in both modes and never move.
const BARS = ".row__redacted .redaction__bars rect, .gate__legal .redact";
const marked: Element[] = [];

function reducedMotion(): boolean {
  return matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function inViewport(el: Element): boolean {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
}

/** Up to maxBars visible bars get the staggered animation; the rest change instantly. */
function markBars(bars: Element[], stagger: number): void {
  bars.slice(0, TIMING.maxBars).forEach((bar, i) => {
    bar.classList.add("bar-anim");
    (bar as HTMLElement | SVGElement).style.setProperty("--bar-delay", `${i * stagger}ms`);
    marked.push(bar);
  });
}

function clearBars(): void {
  for (const bar of marked.splice(0)) {
    bar.classList.remove("bar-anim");
    (bar as HTMLElement | SVGElement).style.removeProperty("--bar-delay");
  }
}

function visibleBars(): Element[] {
  return [...document.querySelectorAll(BARS)].filter(inViewport);
}

function flipStamp(): void {
  document.querySelector<HTMLElement>("[data-mode-toggle]")?.animate(
    [
      { transform: "perspective(400px) rotateX(0deg)" },
      { transform: "perspective(400px) rotateX(90deg)" },
      { transform: "perspective(400px) rotateX(0deg)" },
    ],
    { duration: TIMING.stamp, easing: "ease-in-out" },
  );
}

/**
 * Switch mode. `origin` is where the reveal circle starts (the toggle or a "View declassified"
 * link); `onSwitch` runs right after the mode changes (open a row, move focus, scroll).
 */
export function switchMode(next: Mode, origin?: Element | null, onSwitch?: () => void): void {
  // Never on top of the entry gate's aperture (ROADMAP 26.4): the page is inert until it ends,
  // and this also stops a scripted click.
  if (document.documentElement.dataset["vt"] === "gate") return;
  const apply = (): void => {
    setMode(next);
    onSwitch?.();
  };
  if (next === currentMode() || reducedMotion()) {
    apply();
    return;
  }

  if (!document.startViewTransition) {
    flipStamp();
    // Fallback: plain crossfade, no clip or bar effects.
    const half = TIMING.fallback / 2;
    document.body
      .animate([{ opacity: 1 }, { opacity: 0 }], { duration: half, easing: "ease-in" })
      .finished.then(() => {
        apply();
        document.body.animate([{ opacity: 0 }, { opacity: 1 }], { duration: half, easing: "ease-out" });
      });
    return;
  }

  const root = document.documentElement;
  const opening = next === "giai-mat";
  const box = (origin ?? document.querySelector("[data-mode-toggle]"))?.getBoundingClientRect();
  const x = box ? box.left + box.width / 2 : innerWidth / 2;
  const y = box ? box.top + box.height / 2 : 0;
  root.style.setProperty("--vt-x", `${x}px`);
  root.style.setProperty("--vt-y", `${y}px`);
  root.style.setProperty("--vt-r", `${Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))}px`);
  root.dataset["vt"] = opening ? "open" : "close";
  // motion.css reads every time from here, so TIMING stays the single source.
  const vars: Record<string, number> = {
    "reveal-dur": TIMING.reveal,
    "portrait-at": TIMING.portraitAt,
    "portrait-dur": TIMING.portrait,
    "banner-at": TIMING.bannerAt,
    "banner-dur": TIMING.banner,
    "chart-at": TIMING.chartAt,
    "chart-dur": TIMING.chart,
    "bars-at": TIMING.barsAt,
    "bar-dur": TIMING.bar,
  };
  for (const [name, ms] of Object.entries(vars)) root.style.setProperty(`--${name}`, `${ms}ms`);
  // The scene ends with the last bar, after the View Transition itself has finished.
  const sceneEnd = TIMING.barsAt + (TIMING.maxBars - 1) * TIMING.barStagger + TIMING.bar;
  let started = performance.now();

  // Opening: the bars on screen now (Mat) shrink away in the new state. Closing: the bars that
  // appear on screen in the new state grow back.
  const leaving = opening ? visibleBars() : [];
  const transition = document.startViewTransition(() => {
    apply();
    markBars(opening ? leaving : visibleBars(), TIMING.barStagger);
  });
  // One clock for the whole scene: it starts with the reveal. At that moment the circle has no
  // size yet, so nothing of the new state shows before its effects are in place.
  transition.ready
    .then(() => {
      started = performance.now();
      root.dataset["scene"] = opening ? "declassify" : "classify";
      flipStamp();
    })
    .catch(() => {});
  transition.finished.finally(() => {
    delete root.dataset["vt"];
    setTimeout(() => {
      delete root.dataset["scene"];
      clearBars();
    }, Math.max(0, sceneEnd - (performance.now() - started)));
  });
}

export function initModeToggle(): void {
  const button = document.querySelector<HTMLButtonElement>("[data-mode-toggle]");
  if (!button) return;
  button.addEventListener("click", () => switchMode(currentMode() === "mat" ? "giai-mat" : "mat", button));
  button.setAttribute("aria-pressed", String(currentMode() === "giai-mat"));
  button.hidden = false;
}
