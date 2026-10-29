// Reading settings, the "Aa" panel (ROADMAP P27, UX-v3 section 4): one of four fixed reading
// profiles (no free font choice), text size 90/100/115%, the custom cursor on or off (P21), and
// "Default". Kept in localStorage (may be blocked: the page then simply forgets); the head script
// in Base.astro applies them before the first paint, so nothing flashes. Print ignores them (CSS).
import { readCursorFx, setCursorFx } from "./cursor";

export const FONT_KEY = "fontProfile";
export const SIZE_KEY = "fontSize";
/** Mat night vision (ROADMAP 28.1): "off" when the reader turned it off; on by default. */
export const NIGHT_KEY = "nightFx";
export const PROFILES = ["ho-so", "bien-ban", "de-doc", "may-chu"] as const;
export const SIZES = ["sm", "md", "lg"] as const;
export type Profile = (typeof PROFILES)[number];
export type Size = (typeof SIZES)[number];
/** The face each profile loads; "ho-so" is the dossier's own, always there. */
const FACE: Partial<Record<Profile, string>> = { "bien-ban": "Source Serif 4", "de-doc": "Lexend", "may-chu": "IBM Plex Mono" };
/** Enough text to fetch both subsets a page needs (latin, vietnamese). */
const SAMPLE = "Aa Ăă Đđ Ơơ Ưư Ếế Ộộ";

/** <html>, read when used: this module is also imported at build time for its keys. */
const html = (): HTMLElement => document.documentElement;

function store(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // storage blocked: this page follows the choice, the next visit will not
  }
}

export function currentProfile(): Profile {
  const f = html().dataset["font"];
  return (PROFILES as readonly string[]).includes(f ?? "") ? (f as Profile) : "ho-so";
}
export function currentSize(): Size {
  const size = html().dataset["size"];
  return size === "sm" || size === "lg" ? size : "md";
}

/**
 * Switch profile. The face is loaded first and only then applied, so the text changes face once,
 * with no swap from a fallback afterwards (ROADMAP 27.3: CLS 0 on a change). Gives up waiting
 * after 3 s (slow network): the fallback, sized to match, shows until the face arrives.
 */
export async function setProfile(id: Profile): Promise<void> {
  store(FONT_KEY, id === "ho-so" ? null : id);
  const face = FACE[id];
  if (face && document.fonts?.load) {
    const load = Promise.all([document.fonts.load(`400 1em "${face}"`, SAMPLE), document.fonts.load(`700 1em "${face}"`, SAMPLE)]);
    await Promise.race([load, new Promise((r) => setTimeout(r, 3000))]).catch(() => {});
  }
  if (id === "ho-so") delete html().dataset["font"];
  else html().dataset["font"] = id;
}

export function nightOn(): boolean {
  return html().dataset["night"] !== "off";
}
export function setNight(on: boolean): void {
  store(NIGHT_KEY, on ? null : "off");
  if (on) delete html().dataset["night"];
  else html().dataset["night"] = "off";
}

export function setSize(size: Size): void {
  store(SIZE_KEY, size === "md" ? null : size);
  if (size === "md") delete html().dataset["size"];
  else html().dataset["size"] = size;
}

/** Wires the panel; runs again after a language swap replaces the control bar. */
export function initReading(): void {
  const toggle = document.querySelector<HTMLButtonElement>("[data-reading-toggle]");
  const panel = document.querySelector<HTMLElement>("[data-reading-panel]");
  if (!toggle || !panel) return;
  const radios = (name: string) => [...panel.querySelectorAll<HTMLInputElement>(`input[name="${name}"]`)];
  const cursor = panel.querySelector<HTMLInputElement>("[data-reading-cursor]")!;
  const night = panel.querySelector<HTMLInputElement>("[data-reading-night]")!;
  const sync = (): void => {
    for (const r of radios("reading-font")) r.checked = r.value === currentProfile();
    for (const r of radios("reading-size")) r.checked = r.value === currentSize();
    cursor.checked = readCursorFx() === "custom";
    night.checked = nightOn();
  };
  const open = (on: boolean, focusBack = false): void => {
    panel.hidden = !on;
    toggle.setAttribute("aria-expanded", String(on));
    if (on) sync();
    if (!on && focusBack) toggle.focus();
  };

  toggle.addEventListener("click", () => open(toggle.getAttribute("aria-expanded") !== "true"));
  for (const r of radios("reading-font")) r.addEventListener("change", () => void setProfile(r.value as Profile));
  for (const r of radios("reading-size")) r.addEventListener("change", () => setSize(r.value as Size));
  cursor.addEventListener("change", () => setCursorFx(cursor.checked ? "custom" : "system"));
  night.addEventListener("change", () => setNight(night.checked));
  panel.querySelector("[data-reading-reset]")?.addEventListener("click", () => {
    void setProfile("ho-so");
    setSize("md");
    setCursorFx("custom");
    setNight(true);
    sync();
  });
  // Esc closes and gives focus back to "Aa"; so does a click outside the panel.
  panel.addEventListener("keydown", (e) => e.key === "Escape" && (e.stopPropagation(), open(false, true)));
  toggle.addEventListener("keydown", (e) => e.key === "Escape" && !panel.hidden && open(false, true));
  document.addEventListener("pointerdown", (e) => {
    if (!panel.hidden && !panel.contains(e.target as Node) && !toggle.contains(e.target as Node)) open(false);
  });
  toggle.hidden = false;
}
