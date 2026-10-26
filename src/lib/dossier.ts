// File furniture of the Mat "console" (ROADMAP 13.2): file number, date-time group (DTG) and page
// marks. Surface only: everything here comes from the codename and the build time, never from
// new facts about the owner.

/** One build time for the whole build, so every banner and page mark agrees. */
export const BUILT = new Date();

const MONTHS =["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const pad = (n: number): string => String(n).padStart(2, "0");

/** File number: the codename in capitals and the build year and month, e.g. "CUPID-2610". */
export function fileNumber(codename: string, built: Date): string {
  const name = codename
    .normalize("NFD")
    .replace(/\p{Mn}/gu, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "");
  return `${name || "FILE"}-${pad(built.getUTCFullYear() % 100)}${pad(built.getUTCMonth() + 1)}`;
}

/** Date-time group of the build in UTC ("Zulu"), e.g. "261922Z OCT 26". */
export function dtg(built: Date): string {
  const day = pad(built.getUTCDate());
  const time = `${pad(built.getUTCHours())}${pad(built.getUTCMinutes())}`;
  return `${day}${time}Z ${MONTHS[built.getUTCMonth()]} ${pad(built.getUTCFullYear() % 100)}`;
}

/** Sections that carry a page mark, in reading order ("1/3"...). */
export const PAGES = ["gate", "ledger", "map"] as const;
export type PageId = (typeof PAGES)[number];
export function pageOf(id: PageId): { n: number; of: number } {
  return { n: PAGES.indexOf(id) + 1, of: PAGES.length };
}
