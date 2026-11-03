# Agent T City — Charter

A two-minute read. Source of truth for every city phase (P31–P52), together with `DECISIONS-v4.md`, `UX-v4.md` and `ROADMAP-v4.md`. If this file and `DECISIONS-v4.md` ever differ, `DECISIONS-v4.md` wins.

## Two-minute version
1. The city is an optional way into the dossier's own facts; it adds none and hides none.
2. It reads only the filtered ledger data: `hold` never, `classified` as a label only.
3. Hoang Sa and Truong Sa always read "(Viet Nam)", from the 2D map's own labels; nothing drawn in the sea.
4. No new dependency, font, colour family or network request without the owner; no backend, no tracking.
5. It stays behind `PUBLIC_CITY` until the owner switches it on, and never blocks the dossier's release.

## What the city is
- An optional 2.5D "spy city" leading into the **same facts** as the dossier, which stays canonical.
- One building per open entry, the sealed Vault for the `classified` one, landmarks only for dossier parts that exist (`content-map.md`).
- Dark = sealed, light = declassified; night = Mat, dawn = Giai mat, from the dossier's own mode.
- At the centre, the Atlas: the real map of Viet Nam as a relief table, a beacon over Da Nang, same geometry as the 2D/3D maps.
- Agent T: an original character built from code, no images, no likeness of anyone.

## Scope
- One route, `/[lang]/city/`, behind the build flag `PUBLIC_CITY` (off in `build:prod`, on in `pnpm dev`) until the owner approves it (P52).
- Plain Canvas 2D and TypeScript; geometry produced at build time and shipped as data; DOM for the HUD and panels so everything stays accessible.
- A Lite view (no canvas world) and a no-JS district list carry the whole story.

## Non-goals
- No multiplayer, no accounts, no backend, no server code.
- No storage of visitors: nothing sent anywhere; only cosmetic district states in `sessionStorage`, inside try/catch.
- No analytics beyond the local-only gate measurement already approved; no cookies.
- No 3D engine, no game or animation library, no new dependency, font, colour family or network request without asking the owner first.
- No new facts: the city never adds a claim, date, figure or title, and never hides content behind a game state.
- It does not block the dossier's own release (v3 P30): the dossier can ship without the city.

## Budgets
The numbers are in ROADMAP-v4, "Rules for every phase", item 4: never lowered, only changed by the owner. In short: city JS <= 80 KB gzip (city route only), atlas data <= 60 KB, city CSS <= 8 KB, no images, no new fonts, +0 B on dossier pages, p95 frame <= 20 ms at Medium on the reference i3. `pnpm city:budget` enforces the sizes; `docs/perf-log.md` holds every measured number.

## Hard limits (copied verbatim from DECISIONS-v4.md, "Hard limits (unchanged, they win over creativity)")
- Nothing about the confidential assistant role described in DECISIONS-v3, in any form (no building, no redaction bar, no hint).
- No politics or geopolitics, except the approved sovereignty map: **Hoang Sa and Truong Sa are labelled "(Viet Nam)" exactly as the existing map does**, exempt from fog, redaction and fading. No lines of any kind drawn in the sea. Do not re-type these labels: take them from the same source as the 2D map and add a test that fails if they differ or disappear.
- No real organisation logos or badges (Prudential included), no fake figures, no wording that implies investment performance, no handwritten signature, no military-looking clothing on the character.
- The pipe is a silhouette prop with an ember glow only (no smoking animation). The Intruder event (UX-v4 section 6b) stays abstract and non-violent: it never represents a real person, group, nationality, profession, client or organisation, never names a crime, and has no weapons, chase or arrest imagery.
- `hold` items are never compiled. The city reads **only the filtered build data** that the ledger uses. As of 02/11/2026: DFL24 IC role is deleted; Prudential is approved and shown; `classified` items show their type label only.
- Only addresses in the leak allowlist may appear (the work email for "Request declassification"). No new contact methods, no form, no backend, no analytics beyond the local-only measurement already approved, no cookies.
- No private places: the atlas shows only the places already in `content/places.json`.
- Music: no licensed-less audio ships. Procedural sound effects (Web Audio synthesis, no sample files) are fine. Default muted.
- Claude Code never commits, pushes or deploys unless the owner asks.

## Creative license
Claude Code may decide alone on architecture, shapes, lighting, animation, particles, procedural sound, HUD style, building names, district codenames and atmosphere microcopy, provided each invention is logged in `creative-log.md` (what, why, screenshot, how to switch it off) and every flavor line is listed in `copy-review.md` for the owner's approval. Flavor copy states no fact about the owner and nothing absent from `content/`. The owner can veto anything.

## How the rules are enforced (P31)
| Rule | Enforced by |
|---|---|
| City data comes only from the filtered ledger data; every ledger entry has exactly one plot; no `hold` id in city data | `src/city/content-map.ts` + `src/city/content-map.test.ts` |
| The city route is not built, and not linked, unless `PUBLIC_CITY` is on | `src/lib/flags.ts` + `scripts/build-prod.test.mjs` |
| Size budgets; no image or font in the city bundle; no city file referenced by dossier pages | `pnpm city:budget` (`scripts/city-budget.mjs`) + its test |
| No forbidden strings, foreign emails, phone numbers or `hold` ids in the city output | `pnpm check:leaks` (city route rules) + its test |
| Hoang Sa / Truong Sa labels from the 2D map's source | P39 (atlas export) and P40 tests |
