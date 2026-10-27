// Cursor preference (ROADMAP 21.4): "custom" (the dossier's CSS cursors) or "system". Stored in
// localStorage, mirrored on <html data-cursor>, which the head script sets before first paint so
// the cursor never flashes. Storage may be blocked (private mode, policies): reading then falls
// back to "custom" and saving is skipped, the page works either way. The switch lives in the
// "Aa" panel from P27; for now only on the dev page.
export type CursorFx = "custom" | "system";
export const CURSOR_KEY = "cursorFx";

export function readCursorFx(): CursorFx {
  try {
    return localStorage.getItem(CURSOR_KEY) === "system" ? "system" : "custom";
  } catch {
    return "custom";
  }
}

export function setCursorFx(fx: CursorFx): void {
  document.documentElement.dataset["cursor"] = fx;
  try {
    localStorage.setItem(CURSOR_KEY, fx);
  } catch {
    // Not kept for the next visit; the current page already follows the choice.
  }
}
