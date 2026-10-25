// Ledger rows: open/close (aria-expanded) and "View declassified" links (UX section 3).
import { switchMode } from "./declassify";

function setOpen(row: HTMLElement, open: boolean): void {
  row.classList.toggle("is-open", open);
  row.querySelector("[data-row-toggle]")?.setAttribute("aria-expanded", String(open));
}

export function initLedger(): void {
  const rows = document.querySelectorAll<HTMLElement>("[data-claim]");
  for (const row of rows) {
    const toggle = row.querySelector<HTMLButtonElement>("[data-row-toggle]");
    if (!toggle) continue;
    setOpen(row, false); // rendered open so the page reads fine without JS
    toggle.addEventListener("click", () => setOpen(row, !row.classList.contains("is-open")));
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
