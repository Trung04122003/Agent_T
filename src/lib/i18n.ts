import { getEntry } from "astro:content";
import type { Locale } from "./locales";

export type { Locale };

/** Interface string from content/ui.json. A missing key fails the build. */
export async function t(key: string, locale: Locale): Promise<string> {
  const entry = await getEntry("ui", key);
  if (!entry) throw new Error(`content/ui.json: missing key "${key}"`);
  return entry.data[locale];
}
