/** "File updated" stamp (UX section 2): month/year of the build, in Viet Nam time. */
export function updatedStamp(date: Date, timeZone = "Asia/Ho_Chi_Minh"): { text: string; iso: string } {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit" }).formatToParts(date);
  const year = parts.find((p) => p.type === "year")!.value;
  const month = parts.find((p) => p.type === "month")!.value;
  return { text: `${month}/${year}`, iso: `${year}-${month}` };
}
