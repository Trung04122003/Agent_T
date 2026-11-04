# Agent T City — engine (P32)

The core every later phase builds on. No art yet: the scene is cleared and empty. All modules are plain TypeScript under `src/city/engine/`, each with a unit test next to it.

| Module | What it does | Rules it enforces |
|---|---|---|
| `iso.ts` | 2:1 isometric projection (tile 64 x 32 px, 32 px per unit of height), inverse projection for picking, painter's-order depth keys | One projection for the whole city (UX-v4 section 3). Round trip exact within 1e-6. |
| `loop.ts` | The single `requestAnimationFrame` loop | One frame in flight; step clamped to 100 ms; nothing scheduled while `document.hidden`; ~20 fps after 20 s without input, full speed on the next input. |
| `layers.ts` | Plans the canvases: dynamic (full), darkness (half resolution), baked static chunks (512 CSS px, LRU cache covering the view plus one ring); HUD stays DOM | Device pixel ratio lowered in 0.25 steps (max 2) until the whole backing store fits 64 MB. |
| `quality.ts` | High / Medium / Low controller | Rolling average of 90 frames (each sample capped at 50 ms, so one stall does not count as sustained slowness); steps down one tier when over 18 ms (High) or 20 ms (Medium); 120 frames ignored after a start or a change; never steps up by itself; a manual choice stands and turns the automatic step-down off. |
| `input.ts` | Keyboard, mouse and touch through one path (pointer events) | Pointer listeners passive; only the stage's keydown is not (arrows must not scroll the page); the stage rectangle is read only in `measure()` (start, resize, scroll), never in the loop; `dispose()` removes every listener. A test greps the city code for layout reads. |
| `capabilities.ts` | Starting tier: High, Medium, Low or Lite | Lite with no 2D canvas, `?lite`, save-data, or under 2 GB; Low under 4 GB or under 4 cores; High at 8 GB and 8 cores without reduced motion; Medium otherwise (the reference i3: 8 GB, 4 threads). |
| `../main.ts` | Wires them on the city route's stage | Sizes come from a `ResizeObserver` entry, not from the layout. |

## Diagnostics
- `pnpm dev` shows a frames-per-second counter and the tier in the stage's corner (dev server only, never in a build).
- `?burn=<ms>` (any city build): busy-waits that long every frame, to see the automatic step-down on a real build. Capped at 100 ms. To be removed or kept dev-only before release (P52).
- `performance.mark("city:first-frame")` marks the first rendered frame.

## The flag
The route `/[lang]/city/` is injected by `astro.config.mjs` only in `pnpm dev` or with `PUBLIC_CITY=1`. With the flag off, nothing of the city is bundled (a build test checks that no city code is in `dist/`).

## The shell (P33)
`src/city/route.astro` holds everything that works without the canvas; `src/city/shell.ts` is its small script.
- Top: a skip link (first Tab stop) and "Back to dossier", both to `/<lang>/#gate-codename` (any hash skips the gate).
- Views: the stage when JS picked a tier (`data-view="world"`); the Lite plan (`data-view="lite"`, `?lite` or a weak device); neither without JS.
- The district list (`#d-<id>`, one per ledger entry, the Vault last with its type label only) links each entry to `/<lang>/#claim-<id>`. It is what no-JS readers, screen readers and the Lite plan's links reach.
- Print: one line pointing to the dossier.
- Entry: plain links in the gate (under the lenses) and the dossier header, only with the flag on, so dossier pages carry no city JS. The lens travels on the city's `?lens=`, else from the same-origin referrer, and goes back on every link to the dossier; language is the path, mode the saved one.
- Not yet: `Esc` opening the exit prompt (UX-v4 section 1) needs the world's own key handling (later phase; P34 adds the camera only).

## City plan and buildings (P34)
| Module | What it does | Rules it enforces |
|---|---|---|
| `plan.ts` | The authored plan on a 44 x 44 grid: ring road, two avenues crossing at the Atlas plaza, a canal with three bridges, 14 plot lots (7 drawn for an archetype, 7 generic), 5 landmark lots, the Vault lot, 4 alleys. `assignLots()` puts the content map's entries on lots in ledger order. | Fixed, not random. `plan.test.ts`: lots on land and disjoint, one connected street graph, every door a street tile touching its lot, every entry exactly one plot, the Vault present, the plan's limit reported by name. |
| `archetypes.ts` | Archetype per entry from `kind` and first domain; `building()` turns an archetype and a lot into solids (boxes, n-gon frustums, ridge roofs, masts), seeded by the lot's id. | Never reads the tier, metrics or lens weights: the page only receives `id`, `kind`, `domains` (`CityData`); a test shuffles tiers and gets the same skyline. Solids stay inside their lot. |
| `palette.ts` | Mat and Giai mat colours: the dossier's tokens and sRGB mixes of two tokens. | No new hue family; a test compares the tokens with `tokens.css`. |
| `render.ts` | Ground (streets, plaza paving, canal banks, bridges, alleys), then buildings far to near; faces shaded from one fixed light, window grids on walls, glass mullions, rim light on top edges and the near vertical edge. | Back faces culled exactly (view axis (1, 1, 1) of the 2:1 projection). Drawn only into baked chunks, never per frame. |
| `bake.ts` | The static layer: 512 px chunks per zoom step (0.32, 0.6, 1) and mode, LRU-cached to the layer plan's chunk count; copied to the stage only when the view changed. | At most 2 chunk bakes per frame after the first; bake counters on the stage (`data-bake-chunks`, `data-bake-ms`, `data-bake-max`). |

Camera: since P36 it follows Agent T (below); `+` and `-` change the zoom step; the view's centre stays over the city. The dossier's mode switch repaints the city in the other palette.

Dev page: `/dev/city-sheet` (dev server only) draws every archetype in both palettes. Review images: `node tools/city-review.mjs <phase> <preview-url> [dev-url]`. Frame times: `node tools/perf/city-frames.mjs [preview-url]`.

## Night engine, the Mat look (P35)
| Module | What it does | Rules it enforces |
|---|---|---|
| `src/styles/city-tokens.css` | HUD, signage and night tokens, each an alias of a dossier token (`--city-hud-bg: var(--surface)`...). | No new hue. `pnpm check:contrast` resolves the aliases in both modes and checks the HUD pairs (text 4.5:1, redaction bars 3:1). |
| `night.ts` | Two half-resolution canvases: an offscreen light mask (the lantern's cone, its shadows behind building footprints, building faces relit inside the cone, streetlamp pools, sign glows) and the visible darkness (night colour at 80%, three haze bands and a static grain, both fixed to the city, minus the mask, then the mask again at 20% as the light's tint). | Lights are sprites baked once at start (radial gradients made once, stamped with `drawImage`); no `filter`, no blur, no gradient per frame. The mask is rebuilt only when the view or the lantern moves. Whole-pixel arguments on the hot path. |
| `signs.ts` | One sign per entry building: a dark panel on its lit wall, framed by a brass tube, three redaction bars. | The bars stir with the dossier's own `STIR` timing (`src/scripts/stir.ts`: 200 ms, redrawn every 50 ms), one sign at a time every 2.5 to 6.5 s; Mat only; frozen with reduced motion. No text, real or invented. |
| `rain.ts` | Slanted streaks over the view and drops running down the glass tower's walls, drawn over the darkness. | High tier only, Mat only, none with reduced motion; at most 120 particles (18 on the glass); switching tier sets the count to the new tier's cap (0 below High). Preallocated typed arrays. |
| `plan.ts` (`LAMPS`) | Streetlamps every 6 tiles along each street, one at each plaza corner; baked as masts with a lit head. | Always on a street tile (test). |

Since P36 the lantern is Agent T's (below). Diagnostic: `?quality=high|medium|low` sets the tier the way the HUD's Quality control will. Allocation check: `node tools/perf/city-alloc.mjs [preview-url]`.

## Agent T v1 (P36)
| Module | What it does | Rules it enforces |
|---|---|---|
| `figure.ts` | Agent T from polygons: long coat with five hem shards, high left collar, faceless visor with a brass slit turned toward his facing, flat-brimmed hat with a brass band, chelsea boots, lantern (left hand), briefcase (right hand). 8 facings; a 6-frame walk by transforms (bob, stride, lantern swing, hem lag). `drawShadow` skews the same silhouette onto the ground. | No image, no face, no weapon, no emblem. About 47 px tall at the middle zoom. Placeholder styling: the final look is P43. Dev page `/dev/agent-sheet`. |
| `walk.ts` | Collision (footprints, the canal except its bridges, the grid's edge), sliding along walls, A* over the road graph (streets, plaza, bridges, alleys), nearest road tile, the never-stuck fallback. | Unit-tested on the real plan (`walk.test.ts`). |
| `agent.ts` | Keyboard walk in screen directions (Shift faster); click the ground to walk there, click a building to walk to its door and face it; the entrance. | Keyboard cancels a path at once; no progress for 0.8 s on a path snaps him free; any position inside a footprint snaps free. |
| `visibility.ts` | The lantern's visibility polygon: rays to every footprint corner in reach (and just either side) plus a 48-ray fan, against footprint edges. | Cached per quarter-tile cell (64 cells, LRU); turning the lantern never recomputes it. The cone sprite is clipped to it (`night.ts`). |
| `camera.ts` | The view eases toward Agent T (time constant 160 ms), clamped to the city. | Exponential easing never overshoots, so pressing against the edge holds still; reduced motion snaps. The drawn origin is rounded to whole device pixels, so the ground never shimmers under him. |

Drawing order on the dynamic layer: baked chunks, signs, his shadow, Agent T, then every scene item nearer than him that overlaps his box, redrawn over him (so buildings in front hide him).

The entrance (UX-v4 section 6b): he waits two tiles inside the alley nearest the plaza, lantern shut; on the first key press or tap, or after 1.2 s, he steps out to its mouth (about 1.2 s) while the lantern opens; the next press skips to the end. Reduced motion: he starts at the mouth, lantern open. The stage reports `data-entrance` (hidden, stepping, done), `data-walking` and `data-door` (the building whose door he reached).

## Districts, missions and briefings (P37)
| Piece | What it does | Rules it enforces |
|---|---|---|
| `src/components/LedgerRow.astro` | One ledger entry, extracted from `Ledger.astro` (markup unchanged; dossier HTML identical but for the build time). The ledger renders it per row; each city briefing renders it with `open`. | "Reuse, do not copy markup": an e2e test compares every briefing's text with its ledger row, vi and en, Mat and Giai mat. |
| `route.astro` | One `<dialog>` per entry (its row), the Vault's (the classified row: type label only), the Dead Drop's (the dossier's own request, unchanged); the HUD markup; the page's words, lens orders and stir timing as JSON. | Lens orders and the stir timing are computed here, at build time, with the dossier's modules (`orderByLens`, `STIR`): city client code imports no module dossier pages load, or those pages would fetch a split chunk (an e2e test compares the JS dossier pages load with the city on and off). |
| `hud.ts` | District states (sealed, scouted, briefed, declassified) in `sessionStorage` under `city:districts`, in try/catch; the next objective in the active lens's order; the HUD (light level, mission log as a live region, compass, door prompt and a hidden "Near ..." announcement); the dialogs. | States only rise, only light the city and fill the log; any briefing opens at any time (deep links included). Storage blocked: states live in memory for the page. The Vault never reaches "declassified". |
| `main.ts` | Door prompt within 1.3 tiles of a door; `E` / `Enter` / the prompt button open it; `F` walks to the next objective; arriving at a door by click or `F` opens it; scouted within 6 tiles; `/city/#d-<id>` opens a briefing on load and on hash change. | Opening in Giai mat (or switching to it with a briefing open) declassifies; "View declassified" inside a briefing runs the dossier's own `switchMode`. |

## Day engine, the Giai mat look (P38)
| Piece | What it does | Rules it enforces |
|---|---|---|
| `palette.ts` | Per mode: `cast` (shadow colour and length per unit of height: 1 at night, 0.4 at dawn), `sun`, `sheen`, `veil` (sealed 0.35, scouted 0.18), `gold`. | Tokens and their mixes only; HUD pairs still checked by `check:contrast` in both modes. |
| `render.ts` | Every solid casts a shadow away from the one light (a soft edge: a slightly longer pale copy under it), baked with the buildings; glass walls at dawn get a pre-made diagonal sheen stretched onto them; districts at dawn get a paper veil (sealed, scouted) or a gold wash (declassified) over their silhouette (one hull per solid). | Baked once per chunk and mode, never per frame. Moving figures redraw buildings in front without their shadows (`bare`). |
| `bake.ts` | `setRank()` bumps a version: chunks rebake a few per frame while the previous bake of each stays on screen. | No hole and no long frame when a state changes; at night nothing baked depends on the states, so nothing is rebaked. |
| `night.ts` | Dawn: the darkness layer carries only the low sun's warm wash (a small pre-made gradient, stretched). Night: district buildings glow by state (scouted 0.18, briefed 0.45, declassified 0.85) through their silhouettes in the light mask, plus the ground pools. | No gradient made per frame. |
| `signs.ts` | Once a sign's bars are off it shows the district codename (the approved copy), fitted along the panel. | Night: bars off when declassified. Dawn: bars off from briefed. A place name only, never a fact. |
| `main.ts` | `M` runs the dossier's own `switchMode` (`declassify.ts`, which writes through `mode.ts`); the city reads the mode from the page every time and keeps none. | A unit test fails if city code writes the saved mode; an e2e test switches in the city and reads it in the dossier, and the other way round. |

Review images: `district-states.png` (one district, 4 states x 2 modes) and `night-dawn.png` (side by side), made by `tools/city-review.mjs` (district id as its 4th argument, default `role-prudential`). `tools/perf/city-frames.mjs` measures dawn with `CITY_MODE=giai-mat`.

## Atlas data (P39)
| Piece | What it does | Rules it enforces |
|---|---|---|
| `src/city/atlas.ts` (`atlasFrom`) | Turns the 2D map's own `buildMap` output into the Atlas's data: provinces (`d`, unit after 2025, tier per mode), inner borders, land borders, neighbours' shapes and names, places, the capital, Hoang Sa and Truong Sa (islands, label spot, label text). | No new geometry source. The archipelago labels are the 2D map's own strings (`ui.json` `hoangSaLabel`, `truongSaLabel`); a missing label, or one without "(Viet Nam)" / "(Việt Nam)", throws, which fails the build. |
| `src/city/atlas.json.ts` | The endpoint `/city/atlas.json`, written at build time with the same inputs as `Map.astro`; injected with the city route only. | Emitted only with the city flag on (a build test checks both ways); counted by `pnpm city:budget` (atlas <= 60 KB gzip). |
| `src/city/atlas.test.ts` | 39.2 sovereignty (labels equal the 2D map's in vi and en, both say "(Viet Nam)", the export throws without them); 39.3 no line at sea (every vertex of every line path, land and province borders, lies on a land shape's outline; the check catches a line drawn between the archipelagos); 39.4 places (only `places.json`, in its order, id, role, label, position; no notes, no coordinates). | |

Size: 43 986 B raw, **10 638 B gzip** (budget 61 440 B): no simplification needed, so nothing is dropped, the islands of Hoang Sa and Truong Sa included.

## Full screen on PC and laptop (owner request, 03/11/2026)
- From 1024 px wide with a mouse, the stage spans the window's full width and nearly its full height (`max(560px, 100vh - 150px)`); the title, list and print line keep the text column. Phones keep the column layout.
- A HUD button (`Full screen` / `Exit full screen`) puts the stage in the browser's full screen (Fullscreen API; `Esc` leaves); shown only where the browser allows it and a mouse is present. Briefings still open above it (dialogs live in the top layer).
- Pixel budget per tier (`LAYERS.pixels`: Medium 1.1 Mpx, Low 0.75 Mpx, High none): a stage larger than that renders its canvases smaller and stretches them (the HUD is DOM, its text stays sharp); a tier change re-plans the canvases.

## The Atlas table (P40)
| Piece | What it does | Rules it enforces |
|---|---|---|
| `plan.ts` `ATLAS_TABLE` | The table at the plaza's heart: a square turned 45 degrees (a 2:1 rectangle on screen), pedestal r 3.5 tiles, top 0.6 up, relief projected over r 4.4. | Its tiles leave the road graph (any part within reach), so A* walks round it; both avenues still reach the plaza; the way round stays open (`walk.test.ts`). |
| `atlas-view.ts` | Draws `/city/atlas.json` on the table: one affine lift (north up the screen, the map squashed by half); provinces as terraces at the 3D map's heights (risers every `HEIGHT.riser`, low to high), neighbours' land and land borders low, inner borders on the base step, pins on the home step (Da Nang a brass diamond). Baked into a sprite per zoom step, scale and mode. | No new geometry. `HEIGHT` and `RISE` come from `src/scripts/map-3d.ts` through the route at build time (city client code imports no module dossier pages load). |
| Per frame | The sea's sweep line (6 s a pass, none with reduced motion); the province under the cursor rises `RISE.by` (180 ms up, 160 ms down, ease-out, instant with reduced motion), Da Nang's when Agent T stands at the table. Drawn before or after Agent T by depth. | Canvas only: a trace of 3 s of hovering shows no Layout and no style recalc (`tools/perf/atlas-layout.mjs`). |
| The top canvas | A full-resolution canvas above the darkness: the beacon (a column of light from Da Nang to the top of the view, a slow pulse, steady with reduced motion) and Hoang Sa and Truong Sa (islands at the near step, their labels at a fixed 11 px with a halo). | Never under fog, redaction or fade; drawn at every zoom step, never culled. The label text is the atlas's, which is the 2D map's string. e2e: pixels at the label boxes and up the beacon at all three zoom steps in Mat. |
| `main.ts` | Fetches `/city/atlas.json` (the city's own file, P39) once; the plaza glows around the hologram at night. | The stage reports `data-atlas` (ready, failed). |

## The dive into the real map (P41)
| Piece | What it does | Rules it enforces |
|---|---|---|
| `route.astro` `dialog[data-brief='atlas']` | The dossier's own `Map.astro`, unchanged (both views, zoom, pan, legend, place list, its own script), in a native modal dialog with a "Back to the city" button. | No second map: the same component, the same strings, Hoang Sa and Truong Sa from the same source. The dialog's top layer handles focus in and `Esc`. |
| `main.ts` `dive()` | A click on the table walks Agent T to its nearest side, then dives; beside the table `E` dives (prompt "Dive into the map"). The camera plunges into the table (`scale(3.2)` and fade of the dynamic, darkness and top canvases and the HUD, 520 ms, transform-origin at the table's top), then opens the dialog. Closing plays the plunge backwards (360 ms) and gives the focus back to the stage. | Transform and opacity only (compositor); no redraw of the chunks. Reduced motion: the dialog opens at once, no animation (e2e 41.2). The stage reports `data-dive` (in, open, out). |
| `[data-atlas-open]` | "The real map" in the bar under the title: opens the dialog at once, in any view. | The Lite view's way in (e2e 41.2). |

INP (Event Timing API, `node tools/perf/atlas-inp.mjs`): see `docs/perf-log.md` P41.
