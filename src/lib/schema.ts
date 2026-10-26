// Content schemas for content/*.json (SPEC section 6).
// Kept free of `astro:content` so Vitest and Node scripts can import them.
import { z } from "astro/zod";

const text = z.string().trim().min(1);

/** Every displayed string needs both vi and en. Other locales are not accepted yet. */
/** vi and en are required; other candidate languages are optional until complete (ROADMAP 10.3). */
export const localized = z.strictObject({
  vi: text,
  en: text,
  es: text.optional(),
  ar: text.optional(),
  ja: text.optional(),
});

/** Praise the owner asked to keep out of BLUF lines (ROADMAP 11.1). Lower case, matched as substrings. */
const PRAISE = [
  "xuất sắc",
  "tuyệt vời",
  "vượt trội",
  "hàng đầu",
  "đột phá",
  "ấn tượng",
  "excellent",
  "outstanding",
  "exceptional",
  "amazing",
  "world-class",
  "innovative",
  "best-in-class",
];

/** One line of a BLUF: at most 90 characters, a single sentence, no praise. */
const blufLine = text
  .max(90, "BLUF: at most 90 characters")
  .refine((s) => !/[.!?…]\s/.test(s.trim().replace(/[.!?…]+$/, "")), "BLUF: one sentence only")
  .refine((s) => !PRAISE.some((w) => s.toLowerCase().includes(w)), "BLUF: no praising adjectives");

/**
 * Bottom line up front (ROADMAP 11.1): one optional sentence per row, written by the owner.
 * "Has a verb" cannot be checked reliably by a machine; the owner checks it when writing.
 */
export const bluf = z.strictObject({
  vi: blufLine,
  en: blufLine,
  es: blufLine.optional(),
  ar: blufLine.optional(),
  ja: blufLine.optional(),
});

const yearMonth = z.string().regex(/^\d{4}(-(0[1-9]|1[0-2]))?$/, "Expected YYYY or YYYY-MM");

/** True when a YYYY or YYYY-MM end lies after the month (or year) of `now`. */
export function endsInFuture(end: string, now: Date = new Date()): boolean {
  const [y, m] = end.split("-").map(Number) as [number, number | undefined];
  const ny = now.getFullYear();
  const nm = now.getMonth() + 1;
  return m === undefined ? y > ny : y > ny || (y === ny && m > nm);
}

/**
 * A period never states a future end as fact (ROADMAP 9.5): something still going on uses
 * `ongoing: true` (shown as "present") and has no end; otherwise the end must not be after the build.
 */
export const period = z
  .strictObject({
    start: yearMonth,
    end: yearMonth.nullable(),
    ongoing: z.literal(true).optional(),
  })
  .superRefine((p, ctx) => {
    if (p.ongoing && p.end !== null) {
      ctx.addIssue({ code: "custom", path: ["end"], message: "an ongoing period has no end" });
    }
    if (p.end !== null && endsInFuture(p.end)) {
      ctx.addIssue({ code: "custom", path: ["end"], message: "end is in the future: use ongoing: true" });
    }
  });

/** `confirmed`: the owner confirms the content (ROADMAP 9.7). How strong the proof is shows as a tier. */
export const status = z.enum(["confirmed", "needs-evidence", "needs-decision", "needs-approval"]);

export const evidence = z
  .strictObject({
    type: z.enum(["link", "document-on-request", "reference"]),
    url: z.url().optional(),
    // Shown on the page, so vi and en like every displayed string (SPEC section 7; section 6 lists
    // it as a plain string, which contradicts section 7).
    note: localized,
    /** reference only: the referee agreed to be named (makes the entry T3). */
    consent: z.boolean().optional(),
  })
  .superRefine((e, ctx) => {
    if (e.consent !== undefined && e.type !== "reference") {
      ctx.addIssue({ code: "custom", path: ["consent"], message: "consent applies to a reference only" });
    }
  });

/** Compare labels loosely: Unicode NFC, case, punctuation and spacing do not count. */
export function sameLabel(a: string, b: string): boolean {
  const norm = (s: string) =>
    s
      .normalize("NFC")
      .toLowerCase()
      .replace(/[\p{P}\p{S}]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
  return norm(a) === norm(b);
}

const openClaim = z
  .strictObject({
    id: text,
    kind: z.enum(["role", "education", "project"]),
    visibility: z.enum(["open", "hold"]),
    status,
    org: localized.nullable(),
    title: localized.nullable(),
    period: period.nullable(),
    teaser: localized.nullable(),
    summary: localized.nullable(),
    bluf: bluf.nullable().optional(),
    evidence: z.array(evidence),
    /** Internal record that the organisation agreed to publication (ROADMAP 9.6). Never rendered. */
    approval: z.strictObject({ by: text, on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD") }).optional(),
    notes: z.string().optional(),
  })
  .superRefine((c, ctx) => {
    // A row must not repeat itself (ROADMAP 9.4).
    for (const l of ["vi", "en"] as const) {
      if (c.org && c.title && sameLabel(c.org[l], c.title[l])) {
        ctx.addIssue({ code: "custom", path: ["title", l], message: "title repeats org" });
      }
    }
  });

// No empty row may be published. Enforced by the production ledger gate only, so local builds
// still work while the owner fills in missing data (decision 2026-10-24).
const publishedOpenClaim = openClaim.superRefine((c, ctx) => {
  if (c.visibility === "open" && c.org === null && c.title === null) {
    ctx.addIssue({ code: "custom", path: ["org"], message: "open entry needs org or title" });
  }
  if (c.visibility === "open" && c.period === null) {
    ctx.addIssue({ code: "custom", path: ["period"], message: "open entry needs period" });
  }
});

// Classified entries carry only a category label: no free text may exist in the source.
const classifiedClaim = z.strictObject({
  id: text,
  kind: z.literal("classified"),
  label: localized,
  status,
  period: period.optional(),
});

export const claim = z.discriminatedUnion("kind", [openClaim, classifiedClaim]);
export const publishedClaim = z.discriminatedUnion("kind", [publishedOpenClaim, classifiedClaim]);
export type Claim = z.infer<typeof claim>;

/** Whole claims.json file: every entry valid and ids unique. */
export const claims = z.array(claim).superRefine((list, ctx) => {
  const seen = new Set<string>();
  list.forEach((c, i) => {
    if (seen.has(c.id)) ctx.addIssue({ code: "custom", path: [i, "id"], message: `duplicate id "${c.id}"` });
    seen.add(c.id);
  });
});

/** Internal notes must never reach the build: drop them when loading into collections. */
export function withoutNotes<T extends { notes?: unknown }>(entry: T): Omit<T, "notes"> {
  const { notes: _notes, ...rest } = entry;
  return rest;
}

/** Internal fields (notes, approval) never reach the build. */
export function withoutInternal<T extends { notes?: unknown; approval?: unknown }>(entry: T): Omit<T, "notes" | "approval"> {
  const { notes: _notes, approval: _approval, ...rest } = entry;
  return rest;
}

export const identity = z.strictObject({
  legalName: text,
  codenames: z.array(
    z.strictObject({
      locale: text,
      name: text,
      positioning: text.nullable(),
      reviewed: z.boolean(),
    }),
  ),
  positioning: z.strictObject({ vi: text, en: text, notes: z.string().optional() }),
  contact: z.strictObject({ email: z.email() }).nullable(),
});

/**
 * content/lenses.json (P7): reading directions. Higher weight comes first; entries without a weight
 * keep their claims.json order after the weighted ones. claims.json itself is never changed.
 */
export const lenses = z.strictObject({
  lenses: z
    .array(
      z.strictObject({
        id: z.string().regex(/^[a-z]+$/),
        label: localized,
        weights: z.record(text, z.number().int()),
      }),
    )
    .min(1),
});

/** content/ui.json: interface microcopy (UX section 6), one localized string per key. */
export const ui = z.record(z.string().regex(/^[a-z][A-Za-z0-9]*$/), localized);

export const place = z.strictObject({
  id: text,
  /** origin: family hometown; current: born, raised and living there now; home: lived there. */
  role: z.enum(["origin", "current", "home"]),
  label: localized,
  region: localized.nullable(),
  approx: z.strictObject({
    lat: z.number().min(-90).max(90),
    lon: z.number().min(-180).max(180),
  }),
  notes: z.string().optional(),
});
