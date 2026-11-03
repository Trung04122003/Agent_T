// Input for Agent T City (ROADMAP-v4 P32.5, UX-v4 section 3): keyboard, mouse and touch through one
// path. Touch arrives as pointer events (one listener set for both); pointer listeners are passive.
// The stage's position is measured here only (on start, resize and scroll) and kept: the frame loop
// reads `state`, never the layout. Keys are keyboard actions, so every action has a keyboard path.

/** Continuous moves (held) and one-shot commands (queued until the loop takes them). */
export type Move = "up" | "down" | "left" | "right" | "fast";
export type Command = "interact" | "mode" | "next" | "help" | "exit" | "zoom-in" | "zoom-out";

const MOVES: Record<string, Move> = {
  arrowup: "up",
  w: "up",
  arrowdown: "down",
  s: "down",
  arrowleft: "left",
  a: "left",
  arrowright: "right",
  d: "right",
  shift: "fast",
};
const COMMANDS: Record<string, Command> = {
  e: "interact",
  enter: "interact",
  m: "mode",
  f: "next",
  h: "help",
  escape: "exit",
  "+": "zoom-in",
  "=": "zoom-in",
  "-": "zoom-out",
};

export type InputState = {
  held: Set<Move>;
  /** Taken (and emptied) by the loop each frame. */
  commands: Command[];
  /** Pointer position in stage pixels (CSS px from the stage's top left), when over it. */
  pointer: { x: number; y: number; over: boolean; down: boolean; kind: string };
  /** Taps and clicks on the stage, in stage pixels; taken by the loop. */
  taps: { x: number; y: number }[];
};

type Listener = { target: EventTarget; type: string; fn: (e: Event) => void; opts: AddEventListenerOptions };

export type Input = {
  readonly state: InputState;
  /** Re-reads the stage's rectangle (only here). */
  measure(): void;
  dispose(): void;
  /** How many listeners are attached (a dispose test checks it returns to 0). */
  readonly listeners: number;
};

/**
 * `stage`: the element holding the canvases (focusable, so keys go to the city and not the page).
 * `win`: the window (resize, scroll, blur). `onAny`: every input, to wake the loop from idle pace.
 */
export function createInput(stage: HTMLElement, win: Window, onAny: () => void = () => {}): Input {
  const state: InputState = { held: new Set(), commands: [], pointer: { x: 0, y: 0, over: false, down: false, kind: "mouse" }, taps: [] };
  let left = 0;
  let top = 0;
  const attached: Listener[] = [];
  const on = (target: EventTarget, type: string, fn: (e: Event) => void, opts: AddEventListenerOptions = { passive: true }): void => {
    target.addEventListener(type, fn, opts);
    attached.push({ target, type, fn, opts });
  };
  const measure = (): void => {
    const r = stage.getBoundingClientRect();
    left = r.left;
    top = r.top;
  };
  const at = (e: PointerEvent): { x: number; y: number } => ({ x: e.clientX - left, y: e.clientY - top });
  /** Writes the pointer in place (no object per event: pointermove fires every frame while moving). */
  const track = (e: PointerEvent, down: boolean | null): void => {
    const s = state.pointer;
    s.x = e.clientX - left;
    s.y = e.clientY - top;
    s.over = true;
    s.kind = e.pointerType;
    if (down !== null) s.down = down;
  };

  // Keys: not passive on the stage, because arrows and space would otherwise scroll the page.
  on(
    stage,
    "keydown",
    (e) => {
      const k = e as KeyboardEvent;
      if (k.ctrlKey || k.metaKey || k.altKey) return; // browser shortcuts stay the browser's
      const key = k.key.toLowerCase();
      const move = MOVES[key];
      const command = COMMANDS[key];
      if (!move && !command) return;
      if (move) state.held.add(move);
      if (command && !k.repeat) state.commands.push(command);
      if (move || key === "enter" || key === "escape") k.preventDefault();
      onAny();
    },
    { passive: false },
  );
  on(stage, "keyup", (e) => {
    const move = MOVES[(e as KeyboardEvent).key.toLowerCase()];
    if (move) state.held.delete(move);
  });
  // Leaving the window (alt-tab) must not leave a key stuck down.
  on(win, "blur", () => state.held.clear());

  on(stage, "pointermove", (e) => {
    track(e as PointerEvent, null);
    onAny();
  });
  on(stage, "pointerdown", (e) => {
    track(e as PointerEvent, true);
    onAny();
  });
  on(stage, "pointerup", (e) => {
    const p = e as PointerEvent;
    state.pointer.down = false;
    state.taps.push(at(p));
    onAny();
  });
  on(stage, "pointercancel", () => (state.pointer.down = false));
  on(stage, "pointerleave", () => {
    state.pointer.over = false;
    state.pointer.down = false;
  });
  on(win, "resize", measure);
  on(win, "scroll", measure);
  measure();

  return {
    state,
    measure,
    dispose() {
      for (const l of attached.splice(0)) l.target.removeEventListener(l.type, l.fn, l.opts);
      state.held.clear();
    },
    get listeners() {
      return attached.length;
    },
  };
}
