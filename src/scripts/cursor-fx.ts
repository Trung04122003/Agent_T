// JS cursor layer (ROADMAP P22, UX-v3 section 1), on top of the CSS cursors of P21. Loaded only by
// cursor-loader.ts when the device and settings allow it.
//   Mat: a brass reticle ring follows the mouse with a light lag; over a target it grows 1.4x and
//        turns 45 degrees in 180 ms ("target locked"), a CSS transition on transform only, while
//        four corners close in on the target and blink twice to confirm (acquire() below).
//   Giai mat: no ring. A single selection frame (four corners) opens out around the element under
//        the mouse ("financial lock"); ledger rows also get a brass underline swept by clip-path (CSS).
// Performance (22.3): one rAF loop, for the ring only; pointermove is passive and only records
// coordinates; no layout read in the loop: a target's rect is measured once on entry (again when a
// ResizeObserver reports a change); the loop stops after 600 ms without movement; everything hides
// on tab hide, window blur, the mouse leaving the window, and keyboard navigation (so the focus
// ring is never covered). Mouse input only (pointerType "mouse").
import { cursorFxAllowed, CURSOR_FX_QUERY } from "./cursor-loader";

export const CFX = { lerp: 0.3, idleMs: 600, settle: 0.5, ring: 36, corner: 10, pad: 4, spread: 28, inset: 14 } as const;
export const TARGETS = 'a[href], button, [role="button"], summary, [data-cursor-target], [data-chart-plot]';

const RING_SVG =
  '<svg viewBox="0 0 36 36" width="36" height="36" focusable="false">' +
  '<circle class="cfx__halo" cx="18" cy="18" r="15"/><circle cx="18" cy="18" r="15"/>' +
  '<path class="cfx__halo" d="M18 1v6M18 29v6M1 18h6M29 18h6"/><path d="M18 1v6M18 29v6M1 18h6M29 18h6"/></svg>';

export function startCursorFx(): void {
  const root = document.documentElement;
  const layer = document.createElement("div");
  layer.className = "cfx";
  layer.dataset["cfx"] = "";
  layer.setAttribute("aria-hidden", "true");
  layer.innerHTML =
    // Four dashed hairlines run from the ring to the screen edges, like the map's sight lines; they
    // sit inside the lock, so locking turns them 45 degrees with the ring (owner idea, P22).
    `<div class="cfx__ring" data-cfx-ring><div class="cfx__lock" data-cfx-lock>${RING_SVG}` +
    '<i class="cfx__hair cfx__hair--l"></i><i class="cfx__hair cfx__hair--r"></i>' +
    '<i class="cfx__hair cfx__hair--u"></i><i class="cfx__hair cfx__hair--d"></i></div></div>' +
    '<div class="cfx__frame" data-cfx-frame><i data-c="tl"></i><i data-c="tr"></i><i data-c="bl"></i><i data-c="br"></i></div>';
  document.body.append(layer);
  const ring = layer.querySelector<HTMLElement>("[data-cfx-ring]")!;
  const lock = layer.querySelector<HTMLElement>("[data-cfx-lock]")!;
  const frame = layer.querySelector<HTMLElement>("[data-cfx-frame]")!;
  const corners = [...frame.querySelectorAll<HTMLElement>("i")];

  const aim = { x: 0, y: 0 };
  const pos = { x: 0, y: 0 };
  let lastMove = 0;
  let raf = 0;
  let current: Element | null = null;
  // A target that changes size (a lens turning bold) gets its frame refitted at once, since that is
  // not an aim. The first report, on observe(), is the size enter() already measured.
  let sized = false;
  const resize = new ResizeObserver(() => {
    if (!sized) return void (sized = true);
    if (!current) return;
    frame.classList.add("is-jump");
    placeFrame(current);
    requestAnimationFrame(() => frame.classList.remove("is-jump"));
  });

  const mat = (): boolean => root.dataset["mode"] !== "giai-mat";
  const show = (on: boolean): void => {
    layer.classList.toggle("is-on", on);
    if (!on) stop();
  };

  // --- Mat ring: the only loop ---
  const tick = (now: number): void => {
    pos.x += (aim.x - pos.x) * CFX.lerp;
    pos.y += (aim.y - pos.y) * CFX.lerp;
    ring.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0)`;
    const settled = Math.abs(aim.x - pos.x) < CFX.settle && Math.abs(aim.y - pos.y) < CFX.settle;
    raf = settled && now - lastMove > CFX.idleMs ? 0 : requestAnimationFrame(tick);
  };
  const run = (): void => {
    if (!raf) raf = requestAnimationFrame(tick);
  };
  function stop(): void {
    cancelAnimationFrame(raf);
    raf = 0;
  }

  // --- Selection frame: moves only when the target changes ---
  function placeFrame(el: Element | DOMRect, spread = 0): void {
    const r = el instanceof DOMRect ? el : el.getBoundingClientRect(); // once per target (and per reported resize)
    const c = CFX.corner;
    const p = CFX.pad + spread;
    const spots = [
      [r.left - p, r.top - p],
      [r.right + p - c, r.top - p],
      [r.left - p, r.bottom + p - c],
      [r.right + p - c, r.bottom + p - c],
    ];
    corners.forEach((el2, i) => (el2.style.transform = `translate3d(${spots[i]![0]}px, ${spots[i]![1]}px, 0)`));
  }
  // Each mode locks the target its own way (owner ideas, P22), one effect, transform and opacity:
  //   Mat "target locked", the way a targeting display acquires: the corners appear wide around the
  //   target, close in on it (180 ms) while the ring turns, then blink twice to confirm the lock
  //   (CSS, 200 ms from 200 ms): 400 ms in all.
  //   Giai mat "financial lock": the corners appear inside the target and open out to frame it
  //   (180 ms, a slight overshoot in CSS), like a figure being highlighted. No blink.
  // The start is set now and the move two frames later, once the start is on screen; a forced
  // style flush instead cost a dropped frame per target on a fast sweep (docs/perf-log.md).
  let closing = 0;
  function acquire(el: Element): void {
    cancelAnimationFrame(closing);
    frame.classList.remove("is-on", "is-confirm");
    frame.classList.add("is-jump");
    const r = el.getBoundingClientRect();
    const locked = mat();
    placeFrame(r, locked ? CFX.spread : -CFX.inset);
    closing = requestAnimationFrame(() => {
      closing = requestAnimationFrame(() => {
        if (current !== el) return;
        frame.classList.remove("is-jump");
        frame.classList.add("is-on");
        frame.classList.toggle("is-confirm", locked);
        placeFrame(r);
      });
    });
  }

  // While a scene runs (mode change, ROADMAP 16), the layer follows without motion of its own, so
  // it never adds a third effect (UX-v2 budget). The hover state changes when the scene ends, too.
  const inScene = (): boolean => root.dataset["scene"] !== undefined || root.dataset["vt"] !== undefined;
  // Not aimed: the page moved under a still mouse (lens reorder, language swap). Then the layer
  // follows without motion too; only aiming acquires a lock.
  const enter = (el: Element | null, aimed = true): void => {
    if (el === current) return;
    resize.disconnect();
    current = el;
    const still = inScene() || !aimed;
    lock.classList.toggle("is-snap", still);
    frame.classList.toggle("is-jump", still);
    lock.classList.toggle("is-locked", !!el && mat());
    if (el) {
      if (!still) acquire(el);
      else (placeFrame(el), frame.classList.add("is-on")); // in place, no motion (is-jump is on)
      sized = false;
      resize.observe(el);
    } else frame.classList.remove("is-on", "is-confirm");
    if (still) requestAnimationFrame(() => (lock.classList.remove("is-snap"), frame.classList.remove("is-jump")));
  };

  const enabled = (): boolean => cursorFxAllowed();

  addEventListener(
    "pointermove",
    (e) => {
      if (e.pointerType !== "mouse" || !enabled()) return;
      aim.x = e.clientX;
      aim.y = e.clientY;
      lastMove = e.timeStamp;
      if (!layer.classList.contains("is-on")) {
        pos.x = aim.x;
        pos.y = aim.y;
        show(true);
      }
      if (mat()) run();
    },
    { passive: true },
  );
  addEventListener(
    "pointerover",
    (e) => {
      if (e.pointerType !== "mouse" || !enabled()) return;
      // pointerover comes before the pointermove of the same motion: a still mouse is one whose
      // position is the last one recorded.
      enter((e.target as Element).closest(TARGETS), e.clientX !== aim.x || e.clientY !== aim.y);
    },
    { passive: true },
  );
  document.addEventListener("pointerout", (e) => !e.relatedTarget && (show(false), enter(null)), { passive: true });
  addEventListener("blur", () => show(false));
  document.addEventListener("visibilitychange", () => document.hidden && show(false));
  // Keyboard navigation: get out of the way of the focus ring until the mouse moves again.
  addEventListener("keydown", (e) => e.key === "Tab" && (show(false), enter(null)));
  // The frame was measured in the viewport: after a scroll it would point at the wrong place.
  addEventListener("scroll", () => (cancelAnimationFrame(closing), frame.classList.remove("is-on")), { passive: true });

  // Mode or preference changes: start over clean; switched off means hidden and idle. The ring is
  // released at once: an unlock transition here would run on top of the mode-change scene.
  const reset = (): void => {
    enter(null);
    // After enter(), which sets these from the scene state; same task, so no transition starts.
    lock.classList.add("is-snap");
    frame.classList.add("is-jump");
    show(false);
    requestAnimationFrame(() => (lock.classList.remove("is-snap"), frame.classList.remove("is-jump")));
  };
  new MutationObserver(reset).observe(root, { attributes: true, attributeFilter: ["data-mode", "data-cursor"] });
  matchMedia(CURSOR_FX_QUERY).addEventListener("change", reset);
}
