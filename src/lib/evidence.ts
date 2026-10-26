// Evidence tiers (ROADMAP 9.7), computed from `evidence`, never typed by hand:
// T3 a public link, or a referee who agreed to be named; T2 a document on request; T1 self-declared.
export type Tier = "T1" | "T2" | "T3";
type Evidence = { type: "link" | "document-on-request" | "reference"; url?: string | undefined; consent?: boolean | undefined };

export function tierOf(evidence: readonly Evidence[]): Tier {
  if (evidence.some((e) => (e.type === "link" && e.url) || (e.type === "reference" && e.consent === true))) return "T3";
  if (evidence.some((e) => e.type === "document-on-request")) return "T2";
  return "T1";
}
