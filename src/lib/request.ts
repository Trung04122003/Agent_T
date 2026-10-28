// "Request declassified documents" (ROADMAP 24.3-24.4, UX-v3 section 6): the mail a visitor sends
// to ask for evidence given on request. Pure, built at build time: no form, no backend, nothing
// about the visitor goes in (the blanks are theirs to fill). The address is not obfuscated (24.5).
import type { Claim } from "./schema";
import type { Locale } from "./locales";

type Evidence = Extract<Claim, { evidence: unknown }>["evidence"][number];

export type MailParts = { subject: string; body: string };

/** Longest mailto: URL allowed (24.3): some mail clients cut longer ones. */
export const MAX_MAILTO = 1800;

/**
 * Names of the documents an entry gives on request, from its evidence notes in content/. The
 * trailing "available on request" is the evidence type itself, so it is dropped from the name.
 */
export function requestDocs(evidence: Evidence[], locale: Locale): string[] {
  return evidence
    .filter((e) => e.type === "document-on-request")
    .map((e) => e.note[locale].replace(/,\s*(cung cấp khi có yêu cầu|available on request)\s*$/iu, "").trim());
}

/** Subject "[CUPID-2610-02] ..." and the body template with the file reference and documents. */
export function requestMail(ref: string, docs: string[], subject: string, body: string): MailParts {
  return {
    subject: `[${ref}] ${subject}`,
    body: body.replaceAll("{ref}", ref).replaceAll("{docs}", docs.join("; ")),
  };
}

// RFC 6068: percent-encoded UTF-8, line breaks as CRLF.
const enc = (s: string): string => encodeURIComponent(s.normalize("NFC"));
const crlf = (s: string): string => s.replace(/\r?\n/g, "\r\n");

export function mailtoHref(email: string, { subject, body }: MailParts): string {
  return `mailto:${email}?subject=${enc(subject)}&body=${enc(crlf(body))}`;
}

/** Gmail's compose page with the same mail (opened in a new tab). */
export function gmailHref(email: string, { subject, body }: MailParts): string {
  return `https://mail.google.com/mail/?view=cm&fs=1&to=${enc(email)}&su=${enc(subject)}&body=${enc(body)}`;
}
