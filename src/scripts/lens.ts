// Reading directions (P7): reorder ledger rows, keep the choice in ?lens=, animate with FLIP.
import { orderByLens, type Lens } from "../lib/lens";

export const FLIP = { duration: 350, stagger: 30, maxBlocks: 12, titleFade: 150 } as const;

function lensFromUrl(): string | null {
  return new URLSearchParams(location.search).get("lens");
}

function reducedMotion(): boolean {
  return matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Put rows in `ids` order. FLIP: measure, move, then play each moved row back from its old spot. */
function reorder(list: HTMLElement, ids: string[], animate: boolean): void {
  const rows = new Map([...list.querySelectorAll<HTMLElement>(":scope > [data-claim]")].map((li) => [li.dataset["claim"]!, li]));
  const before = new Map([...rows].map(([id, li]) => [id, li.getBoundingClientRect().top]));
  for (const id of ids) {
    const li = rows.get(id);
    if (li) list.append(li);
  }
  if (!animate || reducedMotion()) return;
  let moved = 0;
  for (const id of ids) {
    const li = rows.get(id);
    if (!li || moved >= FLIP.maxBlocks) continue; // beyond the cap rows just jump
    const dy = before.get(id)! - li.getBoundingClientRect().top;
    if (Math.abs(dy) < 1) continue;
    li.animate([{ transform: `translateY(${dy}px)` }, { transform: "none" }], {
      duration: FLIP.duration,
      delay: moved * FLIP.stagger,
      easing: "cubic-bezier(0.2, 0, 0, 1)",
      fill: "backwards",
    });
    moved++;
  }
}

let popstateReady = false;

export function initLens(): void {
  const nav = document.querySelector<HTMLElement>("[data-lens-nav]");
  const list = document.querySelector<HTMLElement>(".ledger__list");
  if (!nav || !list) return;
  const lenses = JSON.parse(nav.dataset["weights"] ?? "[]") as Lens[];
  const defaultIds = [...list.querySelectorAll<HTMLElement>(":scope > [data-claim]")].map((li) => li.dataset["claim"]!);
  const buttons = [...nav.querySelectorAll<HTMLButtonElement>("[data-lens]")];
  const title = document.querySelector<HTMLElement>("[data-lens-title]");

  const apply = (id: string | null, animate: boolean): void => {
    const lens = lenses.find((l) => l.id === id);
    const current = document.querySelector<HTMLElement>(".ledger__list");
    if (!current) return;
    reorder(current, orderByLens(defaultIds, lens), animate);
    for (const b of buttons) b.setAttribute("aria-pressed", String(b.dataset["lens"] === lens?.id));
    if (title) {
      title.textContent = lens ? (buttons.find((b) => b.dataset["lens"] === lens.id)?.textContent?.trim() ?? "") : "";
      if (animate && !reducedMotion()) title.animate([{ opacity: 0 }, { opacity: 1 }], { duration: FLIP.titleFade });
    }
  };

  for (const b of buttons) {
    b.addEventListener("click", () => {
      const next = b.getAttribute("aria-pressed") === "true" ? null : b.dataset["lens"]!;
      const url = new URL(location.href);
      if (next) url.searchParams.set("lens", next);
      else url.searchParams.delete("lens");
      history.pushState(null, "", url);
      apply(next, true);
    });
  }
  if (!popstateReady) {
    popstateReady = true;
    addEventListener("popstate", () => {
      // The language switch handles path changes; this only reacts to ?lens= on the same page.
      document.querySelector<HTMLElement>("[data-lens-nav]")?.dispatchEvent(new CustomEvent("lens:sync"));
    });
  }
  nav.addEventListener("lens:sync", () => apply(lensFromUrl(), true));

  apply(lensFromUrl(), false);
  nav.hidden = false;
}
