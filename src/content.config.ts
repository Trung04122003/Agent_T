import { defineCollection } from "astro:content";
import { file } from "astro/loaders";
import { dropHeld } from "./lib/ledger";
import { CLAIMS_FILE, METRICS_FILE, RISKS_FILE } from "./lib/paths";
import { claim, identity as identitySchema, localized, metric, place, risk, withoutInternal, withoutNotes } from "./lib/schema";

const claims = defineCollection({
  loader: file(CLAIMS_FILE, {
    // Drop `hold` entries before validation so they never reach a page. The file loader swallows
    // parser errors, so validation is left to `schema` (which fails the build).
    parser: (text) => dropHeld(JSON.parse(text) as { visibility?: string }[]),
  }),
  schema: claim.transform((c) => (c.kind === "classified" ? c : withoutInternal(c))),
});

const identity = defineCollection({
  // identity.json is a single object; expose it as one entry with id "identity".
  loader: file("content/identity.json", { parser: (text) => ({ identity: JSON.parse(text) }) }),
  schema: identitySchema.transform((i) => ({ ...i, positioning: withoutNotes(i.positioning) })),
});

const places = defineCollection({
  loader: file("content/places.json"),
  schema: place.transform(withoutNotes),
});

const ui = defineCollection({
  // Object keyed by string id: each key becomes one entry holding { vi, en }.
  loader: file("content/ui.json"),
  schema: localized,
});

const risks = defineCollection({
  loader: file(RISKS_FILE),
  schema: risk.transform(withoutNotes),
});

const metrics = defineCollection({
  loader: file(METRICS_FILE),
  schema: metric.transform(withoutNotes),
});

export const collections = { claims, identity, places, ui, risks, metrics };
