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
