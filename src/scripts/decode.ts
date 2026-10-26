// Codename "Decode" (UX section 3, signature 2): each character runs through characters of the
// same script, then locks in, 25 ms apart; the whole effect takes 420 ms (up to 16 characters).
const LATIN = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
export const DECODE_MS = 420;
export const DECODE_STAGGER = 25;
const TICK = 40;

export function decode(el: HTMLElement, text: string): Promise<void> {
  const chars = [...text];
  if (matchMedia("(prefers-reduced-motion: reduce)").matches || chars.length > 16) {
    el.textContent = text;
    return Promise.resolve();
  }
  const lockAt = chars.map((_, i) => DECODE_MS - (chars.length - 1 - i) * DECODE_STAGGER);
  const start = performance.now();
  return new Promise((resolve) => {
    const step = () => {
      const t = performance.now() - start;
      el.textContent = chars
        .map((c, i) => (t >= lockAt[i]! || c.trim() === "" ? c : LATIN[Math.floor(Math.random() * LATIN.length)]))
        .join("");
      if (t < DECODE_MS) setTimeout(step, TICK);
      else {
        el.textContent = text;
        resolve();
      }
    };
    step();
  });
}

export const MASK_MS = 300;
const NON_LATIN = /[^\p{Script=Latin}\p{Script=Common}\p{Script=Inherited}]/u;

/**
 * Show a new codename. Latin names decode; right-to-left or non-Latin names (ar, ja) get a
 * clip-path mask sweep instead, because shuffling their characters does not read as decoding.
 * Screen readers get the final name at once through aria-label.
 */
export async function revealName(el: HTMLElement, text: string, dir: string): Promise<void> {
  el.setAttribute("aria-label", text);
  if (dir === "rtl" || NON_LATIN.test(text)) {
    el.textContent = text;
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const hidden = dir === "rtl" ? "inset(0 0 0 100%)" : "inset(0 100% 0 0)";
      await el.animate([{ clipPath: hidden }, { clipPath: "inset(0 0 0 0)" }], { duration: MASK_MS, easing: "ease-out" })
        .finished;
    }
  } else {
    await decode(el, text);
  }
  el.removeAttribute("aria-label");
}

/** Words of a sentence appear one by one (opacity only), each 240 ms, 70 ms apart. */
export const WORDS = { duration: 240, stagger: 70 } as const;

/**
 * Reveal a sentence word by word after `delay` ms. Long text never shuffles (UX section 3), it
 * only fades in. The words are wrapped in spans for the effect, then the plain text comes back.
 */
export function revealWords(el: HTMLElement, delay: number): Promise<void> {
  const text = el.textContent ?? "";
  if (matchMedia("(prefers-reduced-motion: reduce)").matches || !text.trim()) return Promise.resolve();
  el.textContent = "";
  const words: HTMLSpanElement[] = [];
  for (const part of text.split(/(\s+)/)) {
    if (!part.trim()) {
      el.append(part);
      continue;
    }
    const span = document.createElement("span");
    span.textContent = part;
    el.append(span);
    words.push(span);
  }
  const done = words.map(
    (w, i) =>
      w.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: WORDS.duration,
        delay: delay + i * WORDS.stagger,
        easing: "ease-out",
        fill: "backwards",
      }).finished,
  );
  const restore = (): void => {
    el.textContent = text;
  };
  return Promise.all(done).then(restore, restore);
}

/**
 * Language change on the Gate (owner request, P12): the short lines of the identity card and the
 * mode button decode together, then the positioning sentence appears word by word.
 */
export async function revealGate(dir: string): Promise<void> {
  const short = [".gate__label", "#gate-codename", ".gate__legal-name", "[data-mode-toggle]"];
  const long = [".gate__codename-line", ".gate__positioning"];
  const pick = (sels: string[]) => sels.map((s) => document.querySelector<HTMLElement>(s)).filter((el) => el !== null);
  const sentences = pick(long);
  // Hide the sentences from the start: they wait for the decode to finish.
  const words = Promise.all(sentences.map((el) => revealWords(el, DECODE_MS)));
  await Promise.all(pick(short).map((el) => revealName(el, el.textContent?.trim() ?? "", dir)));
  await words;
}
