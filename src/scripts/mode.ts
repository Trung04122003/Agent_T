// Mode switch (SPEC section 5). The initial data-mode is set by the inline script in Base.astro.
export type Mode = "mat" | "giai-mat";
export const MODE_KEY = "mode";

function save(mode: Mode): void {
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch {
    // Storage unavailable (private mode, blocked): the page still works, the choice is just not kept.
  }
}

export function currentMode(): Mode {
  return document.documentElement.dataset["mode"] === "giai-mat" ? "giai-mat" : "mat";
}

/** Apply, persist and announce a mode. Motion is added on top by declassify.ts. */
export function setMode(mode: Mode): void {
  document.documentElement.dataset["mode"] = mode;
  save(mode);
  const button = document.querySelector<HTMLButtonElement>("[data-mode-toggle]");
  const live = document.querySelector<HTMLElement>("[data-mode-live]");
  button?.setAttribute("aria-pressed", String(mode === "giai-mat"));
  if (button && live) {
    live.textContent = (mode === "mat" ? button.dataset["announceMat"] : button.dataset["announceGiaiMat"]) ?? "";
  }
}

