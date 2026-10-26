// Mode change with motion (UX section 3, signature 1 "Declassify"). All timings live here and in
// src/styles/motion.css, so the effect layer can be cut without touching behaviour (mode.ts).
import { currentMode, setMode, type Mode } from "./mode";

/**
 * One sequence, at most 2 effects at a time and each <= 600 ms (UX-v2 section 1), ms from the click:
 *   open:  stamp 0-220 + reveal 0-500 | portrait 220-520 (+ reveal) | bars + text 540-1010
 *   close: stamp 0-220 + reveal 0-350 | portrait 220-520 | bars 370-710 (+ portrait until 520)
 */
export const TIMING = {
  open: 500, // reveal, Mat -> Giai mat
  close: 350, // reveal, Giai mat -> Mat
  fallback: 250, // crossfade when View Transitions are missing
  stamp: 220, // toggle stamp flip, runs with the reveal
  portraitAt: 220, // portrait crossfade starts once the stamp is done
  barsAtOpen: 540, // bars shrink (and text fades in) after the reveal and portrait
  barsAtClose: 370, // bars cover again after the (shorter) closing reveal
  barOpen: 260,
  barClose: 200,
  barStaggerOpen: 30,
  barStaggerClose: 20,
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
  const apply = (): void => {
    setMode(next);
    onSwitch?.();
  };
  if (next === currentMode() || reducedMotion()) {
    apply();
    return;
  }

  flipStamp();

  if (!document.startViewTransition) {
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
  const barsAt = opening ? TIMING.barsAtOpen : TIMING.barsAtClose;
  root.style.setProperty("--portrait-at", `${TIMING.portraitAt}ms`);
  root.style.setProperty("--bars-at", `${barsAt}ms`);
  // The scene ends with the last bar, after the View Transition itself has finished.
  const sceneEnd =
    barsAt +
    (TIMING.maxBars - 1) * (opening ? TIMING.barStaggerOpen : TIMING.barStaggerClose) +
    (opening ? TIMING.barOpen : TIMING.barClose);
  const started = performance.now();

  // Opening: the bars on screen now (Mat) shrink away in the new state. Closing: the bars that
  // appear on screen in the new state grow back.
  const leaving = opening ? visibleBars() : [];
  const transition = document.startViewTransition(() => {
    apply();
    root.dataset["scene"] = opening ? "declassify" : "classify";
    markBars(opening ? leaving : visibleBars(), opening ? TIMING.barStaggerOpen : TIMING.barStaggerClose);
  });
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
