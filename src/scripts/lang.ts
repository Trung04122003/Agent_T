// Language switch, option (b) chosen at ROADMAP 5.0: fetch the other locale's page and swap the
// classification strips, control bar, main and footer in place. <html> keeps the reader's mode;
// history and Back work.
import { initModeToggle } from "./declassify";
import { revealGate } from "./decode";
import { initLedger } from "./ledger";
import { initLens } from "./lens";
import { initChart } from "./chart";
import { initMap } from "./map-reveal";
import { initMapView } from "./map-view";
import { initEntry } from "./entry";
import { LANG_KEY } from "../lib/locales";

const REGIONS = ["[data-banner=\"top\"]", "header.controls", "main", "footer", "[data-banner=\"bottom\"]", "[data-entry]"];
const FADE_MS = 200;

async function show(url: string, push: boolean): Promise<void> {
  let html: string;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(String(res.status));
    html = await res.text();
  } catch {
    location.href = url; // fall back to a normal page load
    return;
  }
  const next = new DOMParser().parseFromString(html, "text/html");
  const root = document.documentElement;
  root.lang = next.documentElement.lang;
  root.dir = next.documentElement.dir;
  document.title = next.title;
  for (const selector of REGIONS) {
    const current = document.querySelector(selector);
    const incoming = next.querySelector(selector);
    if (!current || !incoming) continue;
    // The open entry gate replays only its lenses (and decodes): the strip and question sweeps would
    // make a third effect next to the cursor lock on the flag just clicked (UX-v2 budget).
    if (selector === "[data-entry]") incoming.classList.add("is-relang");
    current.replaceWith(document.importNode(incoming, true));
  }
  if (push) history.pushState(null, "", url);
  try {
    localStorage.setItem(LANG_KEY, root.lang);
  } catch {
    // storage blocked: nothing to remember
  }
  shownPath = new URL(url, location.href).pathname;

  initModeToggle();
  initLedger();
  initLens();
  // Everything inside the swapped regions needs its listeners again (the map was missed in P12).
  initMap();
  initMapView();
  initChart();
  // Chosen inside the open entry gate (ROADMAP 25.2): the gate stays, now in the new language; the
  // page behind it is inert and hidden, so it gets no fade or decode of its own.
  if (root.dataset["gate"] === "show") return initEntry(true);
  // Focus the language just chosen (now the current one) so keyboard users stay in place.
  document.querySelector<HTMLElement>("[data-lang-switch][aria-current=\"page\"]")?.focus({ preventScroll: true });

  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!reduce) {
    for (const el of document.querySelectorAll<HTMLElement>("main, footer")) {
      el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: FADE_MS, easing: "ease-out" });
    }
  }
  const codename = document.querySelector<HTMLElement>("#gate-codename");
  const live = document.querySelector<HTMLElement>("[data-lang-live]");
  if (codename && live) live.textContent = codename.textContent ?? ""; // announce only the new name
  await revealGate(root.dir);
}

let ready = false;
let shownPath = location.pathname;
export function initLangSwitch(): void {
  if (ready) return;
  ready = true;
  document.addEventListener("click", (event) => {
    const link = (event.target as Element | null)?.closest<HTMLAnchorElement>("[data-lang-switch], [data-entry-lang]");
    if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (link.getAttribute("aria-current") === "page") return; // already in this language
    // Keep the query (?lens=) when switching language.
    void show(link.href.split("?")[0] + location.search, true);
  });
  addEventListener("popstate", () => {
    if (location.pathname !== shownPath) void show(location.href, false); // query-only changes are not ours
  });
}
