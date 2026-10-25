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
