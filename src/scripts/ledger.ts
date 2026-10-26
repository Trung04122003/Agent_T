// Ledger rows: open/close (aria-expanded) and "View declassified" links (UX section 3).
import { switchMode } from "./declassify";

/** Stamp on opening (ROADMAP 13.3): lands once the panel is under way; transform + opacity. */
export const STAMP = { duration: 220, delay: 120 } as const;

function setOpen(row: HTMLElement, open: boolean): void {
  row.classList.toggle("is-open", open);
  row.querySelector("[data-row-toggle]")?.setAttribute("aria-expanded", String(open));
}

function stampRow(row: HTMLElement): void {
  const stamp = row.querySelector<HTMLElement>("[data-stamp]");
  if (!stamp || document.documentElement.dataset["mode"] !== "mat") return;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  stamp.animate(
    [
      { opacity: 0, transform: "scale(1.8)" },
      { opacity: 1, transform: "scale(1)" },
    ],
    { ...STAMP, easing: "cubic-bezier(0.2, 0.9, 0.3, 1)", fill: "backwards" },
  );
}

export function initLedger(): void {
  const rows = document.querySelectorAll<HTMLElement>("[data-claim]");
  for (const row of rows) {
    const toggle = row.querySelector<HTMLButtonElement>("[data-row-toggle]");
    if (!toggle) continue;
    setOpen(row, false); // rendered open so the page reads fine without JS
    toggle.addEventListener("click", () => {
      const open = !row.classList.contains("is-open");
      setOpen(row, open);
      if (open) stampRow(row);
    });
  }

  for (const link of document.querySelectorAll<HTMLAnchorElement>("[data-declassify]")) {
    link.addEventListener("click", (event) => {
      const row = document.getElementById(`claim-${link.dataset["declassify"]}`);
      if (!row) return;
      event.preventDefault();
      switchMode("giai-mat", link, () => {
        setOpen(row, true);
        history.replaceState(null, "", `#${row.id}`);
        row.scrollIntoView({ block: "start" });
        // The link disappears in Giai mat: keep focus on the same row instead of losing it.
        row.querySelector<HTMLElement>("[data-row-toggle]")?.focus({ preventScroll: true });
      });
    });
  }
}
