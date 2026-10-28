// Locales (SPEC section 7, ROADMAP 10.3).
/** Routed locales: pages exist for these. vi and en are always complete (the schema requires them). */
export const LOCALES = ["vi", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "vi";

/** Every language content may carry: vi, en and the languages that have a codename (identity.json). */
export const CANDIDATE_LOCALES = ["vi", "en", "es", "ar", "ja"] as const;
const REQUIRED = new Set<string>(["vi", "en"]);

const RTL = new Set(["ar", "fa", "he", "ur"]);

/** Text direction for a locale code; RTL is supported from the start (Arabic later). */
export function dirFor(locale: string): "ltr" | "rtl" {
  return RTL.has(locale.split("-")[0]!) ? "rtl" : "ltr";
}

export type LocaleReport = { locale: string; available: boolean; missing: number; reviewed: boolean };

/**
 * Which languages are complete. vi and en always are; any other language needs a translation of
 * every displayed string and a reviewed codename (SPEC section 7). Unlisted languages never show.
 */
export function localeReport(strings: Record<string, unknown>[], reviewed: string[]): LocaleReport[] {
  return CANDIDATE_LOCALES.map((locale) => {
    const missing = strings.filter((s) => typeof s[locale] !== "string" || !(s[locale] as string).trim()).length;
    const isReviewed = REQUIRED.has(locale) || reviewed.includes(locale);
    return { locale, missing, reviewed: isReviewed, available: REQUIRED.has(locale) || (missing === 0 && isReviewed) };
  });
}

/** localStorage key of the reader's language (ROADMAP 25.4): "/" goes straight to it next time. */
export const LANG_KEY = "lang";
