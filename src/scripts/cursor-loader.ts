// Gate for the JS cursor layer (ROADMAP 22.4): a mouse that hovers, no reduced motion, and the
// cursor preference not "system". Only then is cursor-fx.ts imported, so devices that do not
// qualify never download it. If the preference is switched on later (dev switch now, "Aa" panel
// in P27), the layer starts then; cursor-fx.ts itself goes quiet when conditions stop holding.
export const CURSOR_FX_QUERY = "(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)";

export function cursorFxAllowed(): boolean {
  return matchMedia(CURSOR_FX_QUERY).matches && document.documentElement.dataset["cursor"] !== "system";
}

let started = false;

export function initCursorFx(): void {
  const tryStart = (): void => {
    if (started || !cursorFxAllowed()) return;
    started = true;
    void import("./cursor-fx").then((m) => m.startCursorFx());
  };
  tryStart();
  if (started) return;
  new MutationObserver(tryStart).observe(document.documentElement, { attributes: true, attributeFilter: ["data-cursor"] });
  matchMedia(CURSOR_FX_QUERY).addEventListener("change", tryStart);
}
