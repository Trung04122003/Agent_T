// Districts, missions and briefings (ROADMAP-v4 P37, UX-v4 sections 4 and 7). Everything here is DOM
// so it is read, reached and announced: the HUD (nameplate and mode, light level, mission log, the
// compass to the next objective, the door prompt) and the briefing dialogs the route renders (each
// one the entry's own ledger row; the Vault's type label; the Dead Drop's request). District states
// are cosmetic: they light the city and fill the log, and never decide what can be opened.
import { switchMode } from "../scripts/declassify";
import type { AtlasConsts } from "./atlas-view";

export type DistrictState = "sealed" | "scouted" | "briefed" | "declassified";
export const RANK: Record<DistrictState, number> = { sealed: 0, scouted: 1, briefed: 2, declassified: 3 };

/** Words the page hands to the script (route.astro), in the page's language. */
export type CityText = {
  /** District codename per entry id (and "dead-drop"). */
  names: Record<string, string>;
  states: Record<DistrictState, string>;
  near: string;
  prompt: string;
  promptDrop: string;
  /** At the Atlas (P41). */
  promptAtlas: string;
  light: string;
  allLit: string;
  quietSealed: string;
  quietLit: string;
  /** Entry ids in ledger order (the objective order without a lens). */
  order: string[];
  /** Each lens's order of the same ids (lib/lens orderByLens, run at build time). */
  lenses: Record<string, string[]>;
  /** The dossier's redaction stir timing (src/scripts/stir.ts). */
  stir: { ms: number; step: number };
  /** The 3D map's heights and ripple (src/scripts/map-3d.ts) and the page's language, for the Atlas. */
  atlas: AtlasConsts;
};

/** Where the states live: per tab, cosmetic (UX-v4 section 4). */
export const STATE_KEY = "city:districts";

export type States = {
  get(id: string): DistrictState;
  /** Raises a district's state (never lowers it); true if it changed. */
  raise(id: string, to: DistrictState): boolean;
  /** Districts with their lights on (briefed or declassified). */
  readonly lit: number;
};

/** District states, kept in sessionStorage when it works and in memory when it does not. */
export function createStates(ids: readonly string[], storage: () => Storage | null): States {
  const state = new Map<string, DistrictState>(ids.map((id) => [id, "sealed"]));
  try {
    const saved = JSON.parse(storage()?.getItem(STATE_KEY) ?? "{}") as Record<string, string>;
    for (const [id, s] of Object.entries(saved)) if (state.has(id) && s in RANK) state.set(id, s as DistrictState);
  } catch {
    // blocked or broken storage: start sealed, nothing lost but the cosmetics
  }
  const save = (): void => {
    try {
      storage()?.setItem(STATE_KEY, JSON.stringify(Object.fromEntries(state)));
    } catch {
      // storage blocked: the states last for this page only
    }
  };
  return {
    get: (id) => state.get(id) ?? "sealed",
    raise(id, to) {
      const now = state.get(id);
      if (!now || RANK[to] <= RANK[now]) return false;
      state.set(id, to);
      save();
      return true;
    },
    get lit() {
      let n = 0;
      for (const s of state.values()) if (RANK[s] >= RANK.briefed) n++;
      return n;
    },
  };
}

/**
 * The next objective (UX-v4 section 7): in the active lens's order (ledger order without one), the
 * first district not yet briefed; once all are briefed, the first not yet declassified (the Vault
 * stays at briefed: its text is never shown). A hint, never a gate. Null when all are done.
 */
export function nextObjective(text: Pick<CityText, "order" | "lenses">, lens: string | null, states: States, classified: ReadonlySet<string>): string | null {
  const order = (lens && text.lenses[lens]) || text.order;
  return order.find((id) => RANK[states.get(id)] < RANK.briefed) ?? order.find((id) => !classified.has(id) && states.get(id) !== "declassified") ?? null;
}

/** The reader's lens: the page's ?lens= (shell.ts carries it here), else the one the dossier saved. */
export function activeLens(search: string, known: Record<string, unknown>): string | null {
  let id = new URLSearchParams(search).get("lens");
  if (!id) {
    try {
      id = localStorage.getItem("lens");
    } catch {
      id = null;
    }
  }
  return id && id in known ? id : null;
}

export type Hud = {
  /** Light level, log and compass after a state change. */
  refresh(objective: string | null): void;
  /** Compass arrow, as a screen angle in radians (only rewritten when it turns). */
  point(angle: number): void;
  /** The door prompt: the district at hand, or null. */
  prompt(id: string | null): void;
  /** Opens a district's briefing (or the Dead Drop); returns false if there is none. */
  open(id: string): boolean;
  readonly openId: string | null;
  dispose(): void;
};

/**
 * Wires the HUD and the briefing dialogs. `onOpen(id)` is called when a briefing opens (the caller
 * raises the district's state); `stage` gets the focus back when a dialog closes.
 */
export function createHud(stage: HTMLElement, text: CityText, states: States, onOpen: (id: string) => void): Hud {
  const q = <T extends Element>(sel: string): T | null => stage.querySelector<T>(sel);
  const light = q<HTMLElement>("[data-hud-light]");
  const next = q<HTMLElement>("[data-hud-next]");
  const arrow = q<HTMLElement>("[data-hud-arrow]");
  const promptBtn = q<HTMLButtonElement>("[data-hud-prompt]");
  const near = q<HTMLElement>("[data-hud-near]");
  const logs = new Map([...stage.querySelectorAll<HTMLElement>("[data-log]")].map((li) => [li.dataset["log"]!, li]));
  const dialogs = new Map([...document.querySelectorAll<HTMLDialogElement>("dialog[data-brief]")].map((d) => [d.dataset["brief"]!, d]));
  const total = text.order.length;
  let shownPrompt: string | null = null;
  let shownAngle = NaN;
  let openId: string | null = null;
  const listeners: [EventTarget, string, EventListener][] = [];
  const on = (t: EventTarget, type: string, fn: EventListener): void => {
    t.addEventListener(type, fn);
    listeners.push([t, type, fn]);
  };

  const open = (id: string): boolean => {
    const d = dialogs.get(id);
    if (!d) return false;
    if (!d.open) d.showModal();
    openId = id;
    onOpen(id);
    return true;
  };
  for (const [id, d] of dialogs) {
    on(d, "close", () => {
      if (openId === id) openId = null;
      stage.focus({ preventScroll: true });
    });
    for (const b of d.querySelectorAll("[data-brief-close]")) on(b, "click", () => d.close());
    // "View declassified" does what it does in the dossier: the same switch to Giai mat.
    for (const a of d.querySelectorAll<HTMLAnchorElement>("[data-declassify]")) {
      on(a, "click", (e) => {
        e.preventDefault();
        switchMode("giai-mat", a);
      });
    }
    // The map lives in the dossier: its link goes there.
    for (const a of d.querySelectorAll<HTMLAnchorElement>("[data-goto-place]")) a.href = `/${document.documentElement.lang}/#map-title`;
    // The row's own toggle (the ledger's script is not on this page): open and close in place.
    for (const t of d.querySelectorAll<HTMLButtonElement>("[data-row-toggle]")) {
      on(t, "click", () => {
        const row = t.closest(".row");
        const isOpen = row?.classList.toggle("is-open") ?? false;
        t.setAttribute("aria-expanded", String(isOpen));
      });
    }
  }
  if (promptBtn) on(promptBtn, "click", () => shownPrompt && open(shownPrompt));
  // Full screen (owner request, 03/11/2026): offered where the browser allows it, with a mouse.
  const full = q<HTMLButtonElement>("[data-hud-full]");
  if (full && document.fullscreenEnabled && matchMedia("(pointer: fine)").matches) {
    full.hidden = false;
    const label = (): void => {
      const isFull = document.fullscreenElement === stage;
      full.textContent = (isFull ? full.dataset["off"] : full.dataset["on"]) ?? "";
      full.setAttribute("aria-pressed", String(isFull));
    };
    on(full, "click", () => {
      if (document.fullscreenElement === stage) void document.exitFullscreen();
      else void stage.requestFullscreen().then(() => stage.focus({ preventScroll: true }), () => {});
    });
    on(document, "fullscreenchange", label);
    label();
  }
  const renderPrompt = (): void => {
    if (!promptBtn || !near) return;
    const id = shownPrompt;
    if (!id) {
      promptBtn.hidden = true;
      near.textContent = "";
      return;
    }
    const name = text.names[id] ?? "";
    promptBtn.textContent = `E · ${(id === "dead-drop" ? text.promptDrop : id === "atlas" ? text.promptAtlas : text.prompt).replace("{name}", name)}`;
    promptBtn.hidden = false;
    const quiet = id === "dead-drop" || id === "atlas" ? "" : ` ${RANK[states.get(id)] >= RANK.briefed ? text.quietLit : text.quietSealed}`;
    near.textContent = `${text.near.replace("{name}", name)}${quiet}`;
  };

  return {
    refresh(objective) {
      if (light) light.textContent = text.light.replace("{n}", String(states.lit)).replace("{total}", String(total));
      for (const [id, li] of logs) {
        const s = states.get(id);
        if (li.dataset["state"] === s) continue;
        li.dataset["state"] = s;
        const el = li.querySelector("[data-log-state]");
        if (el) el.textContent = text.states[s];
      }
      if (next) next.textContent = objective ? text.names[objective] ?? "" : text.allLit;
      if (arrow) arrow.hidden = !objective;
      renderPrompt(); // its flavor line follows the district's lights
    },
    point(angle) {
      if (!arrow || Math.abs(angle - shownAngle) < 0.03) return;
      shownAngle = angle;
      arrow.style.transform = `rotate(${angle.toFixed(3)}rad)`;
    },
    prompt(id) {
      if (id === shownPrompt) return;
      shownPrompt = id;
      renderPrompt();
    },
    open,
    get openId() {
      return openId;
    },
    dispose() {
      for (const [t, type, fn] of listeners.splice(0)) t.removeEventListener(type, fn);
    },
  };
}
