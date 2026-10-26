// Organisations whose name may only be published with their approval (ROADMAP 9.6, DECISIONS.md).
// Matched against the org label in any language.
export const APPROVAL_REQUIRED = [
  { name: "Prudential", match: /prudential/i },
  { name: "DFL24", match: /dfl24|danang fintech lab/i },
] as const;

type WithOrg = { org?: { vi: string; en: string } | null };

/** The organisation that must approve this entry before it is published, if any. */
export function approvalFor(c: WithOrg): string | null {
  if (!c.org) return null;
  const hit = APPROVAL_REQUIRED.find((a) => a.match.test(c.org!.vi) || a.match.test(c.org!.en));
  return hit ? hit.name : null;
}
