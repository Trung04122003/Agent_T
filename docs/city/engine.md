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
