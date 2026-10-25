// Content schemas for content/*.json (SPEC section 6).
// Kept free of `astro:content` so Vitest and Node scripts can import them.
import { z } from "astro/zod";

const text = z.string().trim().min(1);

/** Every displayed string needs both vi and en. Other locales are not accepted yet. */
export const localized = z.strictObject({ vi: text, en: text });

const yearMonth = z.string().regex(/^\d{4}(-(0[1-9]|1[0-2]))?$/, "Expected YYYY or YYYY-MM");

export const period = z.strictObject({
  start: yearMonth,
  end: z.union([yearMonth, z.literal("present")]).nullable(),
});

export const status = z.enum(["verified", "needs-evidence", "needs-decision", "needs-approval"]);

export const evidence = z.strictObject({
  type: z.enum(["link", "document-on-request", "reference"]),
  url: z.url().optional(),
  // Shown on the page, so vi and en like every displayed string (SPEC section 7; section 6 lists
  // it as a plain string, which contradicts section 7).
  note: localized,
});

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
    evidence: z.array(evidence),
    notes: z.string().optional(),
  })
  .superRefine((c, ctx) => {
    if (c.status === "verified" && c.evidence.length === 0) {
      ctx.addIssue({ code: "custom", path: ["evidence"], message: "verified requires evidence" });
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

/** content/ui.json: interface microcopy (UX section 6), one localized string per key. */
export const ui = z.record(z.string().regex(/^[a-z][A-Za-z]*$/), localized);

export const place = z.strictObject({
  id: text,
  role: z.enum(["origin", "home"]),
  label: localized,
  region: localized.nullable(),
  approx: z.strictObject({
    lat: z.number().min(-90).max(90),
    lon: z.number().min(-180).max(180),
  }),
  notes: z.string().optional(),
});
