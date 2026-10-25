// Published locales (SPEC section 7). One list for astro.config, routes and the language switch.
export const LOCALES = ["vi", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "vi";

const RTL = new Set(["ar", "fa", "he", "ur"]);

/** Text direction for a locale code; RTL is supported from the start (Arabic later). */
export function dirFor(locale: string): "ltr" | "rtl" {
  return RTL.has(locale.split("-")[0]!) ? "rtl" : "ltr";
}
