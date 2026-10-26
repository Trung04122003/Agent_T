// Language switch, option (b) chosen at ROADMAP 5.0: fetch the other locale's page and swap the
// control bar, main and footer in place. <html> keeps the reader's mode; history and Back work.
import { initModeToggle } from "./declassify";
import { revealName } from "./decode";
import { initLedger } from "./ledger";
import { initLens } from "./lens";

const REGIONS = ["header.controls", "main", "footer"];
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
    if (current && incoming) current.replaceWith(document.importNode(incoming, true));
  }
  if (push) history.pushState(null, "", url);
  shownPath = new URL(url, location.href).pathname;

  initModeToggle();
  initLedger();
  initLens();
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
  if (codename) {
    const name = codename.textContent ?? "";
    if (live) live.textContent = name; // announce only the new name, not the page
    await revealName(codename, name, root.dir);
  }
}

let ready = false;
let shownPath = location.pathname;
export function initLangSwitch(): void {
  if (ready) return;
  ready = true;
  document.addEventListener("click", (event) => {
    const link = (event.target as Element | null)?.closest<HTMLAnchorElement>("[data-lang-switch]");
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
