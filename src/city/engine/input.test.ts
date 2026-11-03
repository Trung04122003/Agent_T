import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createInput } from "./input";

// Node has EventTarget and Event; the stage and window are stand-ins with the parts input.ts uses.
function fakes() {
  let rectReads = 0;
  const added: AddEventListenerOptions[] = [];
  class Target extends EventTarget {
    override addEventListener(type: string, fn: EventListenerOrEventListenerObject | null, opts?: AddEventListenerOptions | boolean): void {
      added.push(typeof opts === "object" ? opts : {});
      super.addEventListener(type, fn, opts);
    }
  }
  const stage = Object.assign(new Target(), {
    getBoundingClientRect: () => (rectReads++, { left: 100, top: 50 }),
  }) as unknown as HTMLElement;
  const win = new Target() as unknown as Window;
  const key = (type: string, key: string, extra: object = {}) => {
    const e = Object.assign(new Event(type, { cancelable: true }), { key, repeat: false, ctrlKey: false, metaKey: false, altKey: false }, extra);
    stage.dispatchEvent(e);
    return e;
  };
  const pointer = (type: string, clientX: number, clientY: number, pointerType = "mouse") =>
    stage.dispatchEvent(Object.assign(new Event(type), { clientX, clientY, pointerType }));
  return { stage, win, key, pointer, added, rectReads: () => rectReads };
}

describe("city input (ROADMAP-v4 P32.5)", () => {
  it("keys: held moves, queued commands, arrows do not scroll the page, shortcuts are left alone", () => {
    const f = fakes();
    let pokes = 0;
    const input = createInput(f.stage, f.win, () => pokes++);
    const down = f.key("keydown", "ArrowUp");
    expect(down.defaultPrevented).toBe(true);
    f.key("keydown", "Shift");
    expect([...input.state.held].sort()).toEqual(["fast", "up"]);
    f.key("keyup", "ArrowUp");
    expect([...input.state.held]).toEqual(["fast"]);
    f.key("keydown", "e");
    f.key("keydown", "M");
    f.key("keydown", "Escape");
    f.key("keydown", "e", { repeat: true }); // auto-repeat does not queue twice
    expect(input.state.commands).toEqual(["interact", "mode", "exit"]);
    const copy = f.key("keydown", "c", { ctrlKey: true });
    expect(copy.defaultPrevented).toBe(false);
    expect(pokes).toBeGreaterThan(0);
  });

  it("mouse and touch share one path; positions are in stage pixels from the cached rectangle", () => {
    const f = fakes();
    const input = createInput(f.stage, f.win);
    const reads = f.rectReads();
    f.pointer("pointermove", 160, 90);
    f.pointer("pointerdown", 300, 250, "touch");
    f.pointer("pointerup", 300, 250, "touch");
    expect(input.state.pointer).toMatchObject({ x: 200, y: 200, kind: "touch", down: false });
    expect(input.state.taps).toEqual([{ x: 200, y: 200 }]);
    expect(f.rectReads()).toBe(reads); // no layout read per event
    f.win.dispatchEvent(new Event("resize"));
    expect(f.rectReads()).toBe(reads + 1);
  });

  it("pointer listeners are passive; only the stage's keydown is not (it stops page scrolling)", () => {
    const f = fakes();
    createInput(f.stage, f.win);
    const notPassive = f.added.filter((o) => o.passive === false);
    expect(notPassive).toHaveLength(1);
  });

  it("a blur clears held keys; dispose removes every listener", () => {
    const f = fakes();
    const input = createInput(f.stage, f.win);
    f.key("keydown", "d");
    f.win.dispatchEvent(new Event("blur"));
    expect(input.state.held.size).toBe(0);
    expect(input.listeners).toBeGreaterThan(0);
    input.dispose();
    expect(input.listeners).toBe(0);
    f.key("keydown", "d");
    expect(input.state.held.size).toBe(0); // nothing listens any more
  });

  it("no layout read anywhere in the city engine but input.ts's measure()", () => {
    const dir = "src/city";
    const files: string[] = [];
    const walk = (d: string): void => {
      for (const e of readdirSync(d, { withFileTypes: true })) {
        const p = join(d, e.name);
        if (e.isDirectory()) walk(p);
        else if (/\.ts$/.test(e.name) && !/\.test\.ts$/.test(e.name)) files.push(p);
      }
    };
    walk(dir);
    const layout = /getBoundingClientRect|getClientRects|offset(Width|Height|Top|Left)|client(Width|Height)|scroll(Top|Left|Width|Height)|getComputedStyle/;
    for (const f of files) {
      const text = readFileSync(f, "utf8");
      if (f.endsWith(join("engine", "input.ts"))) {
        expect(text.match(new RegExp(layout.source, "g"))).toEqual(["getBoundingClientRect"]);
      } else {
        expect(layout.test(text), f).toBe(false);
      }
    }
  });
});
