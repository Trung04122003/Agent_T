// Language switch, option (b) chosen at ROADMAP 5.0: fetch the other locale's page and swap the
// control bar, main and footer in place. <html> keeps the reader's mode; history and Back work.
import { initModeToggle } from "./declassify";
import { revealName } from "./decode";
import { initLedger } from "./ledger";

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

  initModeToggle();
  initLedger();
  document.querySelector<HTMLElement>("[data-lang-switch]")?.focus({ preventScroll: true });

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
export function initLangSwitch(): void {
  if (ready) return;
  ready = true;
  document.addEventListener("click", (event) => {
    const link = (event.target as Element | null)?.closest<HTMLAnchorElement>("[data-lang-switch]");
    if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    void show(link.href, true);
  });
  addEventListener("popstate", () => void show(location.href, false));
}
