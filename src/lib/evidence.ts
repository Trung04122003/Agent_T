// Evidence tiers (ROADMAP 9.7), computed from `evidence`, never typed by hand:
// T3 a public link, or a referee who agreed to be named; T2 a document on request; T1 self-declared.
export type Tier = "T1" | "T2" | "T3";
type Evidence = { type: "link" | "document-on-request" | "reference"; url?: string | undefined; consent?: boolean | undefined };

export function tierOf(evidence: readonly Evidence[]): Tier {
  if (evidence.some((e) => (e.type === "link" && e.url) || (e.type === "reference" && e.consent === true))) return "T3";
  if (evidence.some((e) => e.type === "document-on-request")) return "T2";
  return "T1";
}

/**
 * The evidence's name for the Giai mat "Source" line (ROADMAP 28.6): its note from content/, less
 * a trailing "available on request", which the tier already says.
 */
export function evidenceName(note: string): string {
  return note.replace(/,\s*(cung cấp khi có yêu cầu|available on request)\s*$/iu, "").trim();
}
