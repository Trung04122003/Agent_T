# DECISIONS v4 — "Agent T City" (owner decisions, 02/11/2026)

Read together with `ROADMAP-v4.md` and `UX-v4.md`. Language rules: talk to the owner in **Vietnamese**; code, identifiers, comments, commit messages, docs under `docs/city/` in **English**. Visible site copy is bilingual (vi/en) as everywhere else on the site and must pass `check:locales`.

## What the owner decided (02/11/2026)
1. **Build a second layer: a 2.5D "spy city" called Agent T City.** The finished dossier stays canonical. The city is an optional, explorable way into the same content.
2. **2.5D**, not full 3D (reference machine is an Intel i3-1115G4, 8 GB RAM, integrated graphics; the owner also draws poorly, so everything is generated from code, nothing is hand-drawn).
3. **Concept: "abstract spy city" with the real map of Viet Nam inside it.** Confirmed by the owner on 02/11/2026: the map is the **Atlas**, a large holographic relief table in the central plaza, plus a light beacon over Da Nang.
4. **Make it spectacular, make it feel like a spy world, and make the Agent T character unusual and unmistakably "agent".** The owner approves ambition here. Quality over quantity: few elements, each done well.
5. **Light and shadow = the map's progress.** Night city = Mat. Dawn city = Giai mat. Each dossier lights up as it is declassified.
6. **Creative freedom for Claude Code** inside the limits below. Every creative invention must be logged (see "Creative license").
7. **Agent T the character (02/11/2026).** Personality: cold in the dark, funny in the light, mysterious in both. Kit: pardessus (long overcoat), hat, chelsea boots, pipe, briefcase, and a soft silent walk. Signature scene: when a criminal appears in the city, Agent T steps out of an alley. The design is **original**: no existing film, game or comic character is a model for it. Colours follow the dossier (ink black, brass, gold).

## Creative license (what Claude Code may decide alone)
Architecture of buildings, shapes, lighting, animation, particles, procedural sound, HUD style, building names and district codenames, and **atmosphere microcopy** (short flavor lines).
Conditions:
- Log each invention in `docs/city/creative-log.md` (what, why, a screenshot, how to turn it off). The owner can veto anything.
- Atmosphere copy must make **no factual claim about the owner** and nothing that is not in `content/`. Facts come only from the filtered content pipeline. Draft flavor lines with the humanizer skill; list them all in `docs/city/copy-review.md` for the owner to approve before release.
- Any new dependency, new font, new colour family, or new network request: **ask first**.

## Hard limits (unchanged, they win over creativity)
- Nothing about the confidential assistant role described in DECISIONS-v3, in any form (no building, no redaction bar, no hint).
- No politics or geopolitics, except the approved sovereignty map: **Hoang Sa and Truong Sa are labelled "(Viet Nam)" exactly as the existing map does**, exempt from fog, redaction and fading. No lines of any kind drawn in the sea. Do not re-type these labels: take them from the same source as the 2D map and add a test that fails if they differ or disappear.
- No real organisation logos or badges (Prudential included), no fake figures, no wording that implies investment performance, no handwritten signature, no military-looking clothing on the character.
- The pipe is a silhouette prop with an ember glow only (no smoking animation). The Intruder event (UX-v4 section 6b) stays abstract and non-violent: it never represents a real person, group, nationality, profession, client or organisation, never names a crime, and has no weapons, chase or arrest imagery.
- `hold` items are never compiled. The city reads **only the filtered build data** that the ledger uses. As of 02/11/2026: DFL24 IC role is deleted; Prudential is approved and shown; `classified` items show their type label only.
- Only addresses in the leak allowlist may appear (the work email for "Request declassification"). No new contact methods, no form, no backend, no analytics beyond the local-only measurement already approved, no cookies.
- No private places: the atlas shows only the places already in `content/places.json`.
- Music: no licensed-less audio ships. Procedural sound effects (Web Audio synthesis, no sample files) are fine. Default muted.
- Claude Code never commits, pushes or deploys unless the owner asks.

## Constraints from the current codebase (check, do not assume)
- Entry from the gate must cost **0 B of JS** (plain `<a href>`): the gate JS ceiling was set to 3.2 KB on 01/11/2026.
- Reuse, do not rewrite: `src/lib/map.ts` (build-time geometry, labels, archipelagos), `src/scripts/map-3d.ts` (terrace tilt and heights), `src/scripts/mode.ts`, `src/scripts/declassify.ts`, lens logic in `src/lib/lens.ts` and `content/lenses.json`, evidence tiers in `src/lib/evidence.ts`.
- Build-time deps `d3-geo`, `topojson-*` are devDependencies: geometry must be produced at build time and shipped as data.
- The v3 release phase (P30) is not finished. The city must **not block it**: ship the dossier first if the owner wants. The city route is behind a build flag until the owner approves (ROADMAP-v4 P31, P52).

## Open items for the owner (not blocking P31)
- Approve district codenames and flavor copy (P37, P52).
- Do an image search on the Agent T silhouette for look-alikes (P43 checkpoint).
- Test the city on a real phone, including in-app browsers (P49).
- Decide whether the city is in the first public release or after it (P52).
