import { getEntry } from "astro:content";
import type { Locale } from "./i18n";

export async function getIdentity() {
  const entry = await getEntry("identity", "identity");
  if (!entry) throw new Error("content/identity.json: missing");
  return entry.data;
}

type Identity = Awaited<ReturnType<typeof getIdentity>>;

/**
 * Codename for a locale. Only reviewed codenames are published (SPEC section 7); a locale
 * without one (vi today) falls back to the English codename.
 */
export function codenameFor(identity: Identity, locale: Locale) {
  const reviewed = identity.codenames.filter((c) => c.reviewed);
  const codename = reviewed.find((c) => c.locale === locale) ?? reviewed.find((c) => c.locale === "en");
  if (!codename) throw new Error(`content/identity.json: no reviewed codename for "${locale}" or "en"`);
  return codename;
}
