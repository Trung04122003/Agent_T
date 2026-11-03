// The city route's shell (ROADMAP-v4 P33): carries the reader's lens both ways and picks the view.
// Dossier pages stay at +0 B of JS for the city, so the entry links there are plain anchors and the
// lens comes over here instead: the city's own ?lens=, else the one on the same-origin page that
// linked here. Language is in the path; mode is the saved one (Base.astro applies it).

/** The lens to keep: this page's ?lens=, else the referring dossier page's. */
export function lensFrom(search: string, referrer: string, origin: string): string | null {
  const own = new URLSearchParams(search).get("lens");
  if (own) return own;
  try {
    const ref = new URL(referrer);
    return ref.origin === origin ? ref.searchParams.get("lens") : null;
  } catch {
    return null; // no referrer (typed URL, bookmark) or one the browser withheld
  }
}

/** Puts the lens on this page's URL (so a reload keeps it) and on every link back to the dossier. */
export function carryLens(doc: Document): void {
  const lens = lensFrom(location.search, doc.referrer, location.origin);
  if (!lens) return;
  const here = new URL(location.href);
  if (here.searchParams.get("lens") !== lens) {
    here.searchParams.set("lens", lens);
    history.replaceState(history.state, "", here);
  }
  for (const a of doc.querySelectorAll<HTMLAnchorElement>("[data-city-back], [data-city-dossier-link], [data-city-lite-link]")) {
    const url = new URL(a.href);
    url.searchParams.set("lens", lens);
    a.href = url.pathname + url.search + url.hash;
  }
}

/** Lite (?lite, or a device the capability check sends there): the static plan instead of the stage. */
export function showView(section: HTMLElement, tier: string): void {
  section.dataset["view"] = tier === "lite" ? "lite" : "world";
}
