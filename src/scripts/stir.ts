// Mat redaction "stir" (ROADMAP 28.2, UX-v3 section 5): pointing at a redaction bar, or focusing
// the row that holds one, makes it seethe for 200 ms: random block characters (▓▒░), redrawn
// every 50 ms, over the bars. Made here from those three characters only, so there is never any
// real or content-related text, in the page or in its source. Mat only; skipped with reduced
// motion. Delegated from the document: survives the language swap. Timers, not rAF (it is text).
export const STIR = { ms: 200, step: 50, blocks: "▓▒░" } as const;
const BARS = ".redaction, .redact";

function noise(cols: number, rows: number): string {
  const line = () => Array.from({ length: cols }, () => STIR.blocks[Math.floor(Math.random() * STIR.blocks.length)]).join("");
  return Array.from({ length: rows }, line).join("\n");
}

function stir(el: HTMLElement): void {
  const root = document.documentElement;
  if (root.dataset["mode"] === "giai-mat" || el.dataset["stirring"] !== undefined) return;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const rows = Math.max(1, el.querySelectorAll("rect").length);
  // Over the bars only (a ledger redaction also holds its category label below them).
  const box = (el.querySelector("svg") ?? el).getBoundingClientRect(); // one read per stir
  const cols = Math.max(4, Math.round(box.width / 8));
  const cover = document.createElement("span");
  cover.className = "stir";
  cover.setAttribute("aria-hidden", "true");
  cover.style.height = `${box.height}px`;
  cover.style.lineHeight = `${box.height / rows}px`;
  el.dataset["stirring"] = "";
  el.append(cover);
  const start = performance.now();
  const draw = (): void => {
    if (performance.now() - start >= STIR.ms) {
      cover.remove();
      delete el.dataset["stirring"];
      return;
    }
    cover.textContent = noise(cols, rows);
    setTimeout(draw, STIR.step);
  };
  draw();
}

let ready = false;
export function initStir(): void {
  if (ready) return;
  ready = true;
  document.addEventListener(
    "pointerover",
    (e) => {
      const el = (e.target as Element).closest<HTMLElement>(BARS);
      if (el && !el.contains(e.relatedTarget as Node | null)) stir(el);
    },
    { passive: true },
  );
  // Keyboard: the row toggle holding a redaction, or the "View declassified" link beside one.
  document.addEventListener("focusin", (e) => {
    const target = e.target as Element;
    const el = target.querySelector<HTMLElement>(BARS) ?? target.closest(".row__redacted")?.querySelector<HTMLElement>(BARS);
    if (el) stir(el);
  });
}
