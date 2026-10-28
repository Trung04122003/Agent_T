# Performance log

Measured on the owner's machine (Windows 11, Playwright Chromium), on `build:prod` + `astro preview`,
never on `pnpm dev`. Median of 3 runs. Thresholds: `docs/performance-playbook.md` section 1.

## 2026-10-28 · P22 (owner idea) · Brighter sight lines on the Mat ring

The four lines now use the map crosshair's dash (6px on, 4px off, was 2 on, 4 off) at opacity 0.75
(was 0.55). Each line is still its own layer: only its texture changed, nothing moves differently.
"Before" is the "after" of the entry below.

| Mode | CPU | Before, run 1 | Before, run 2 | After, run 1 | After, run 2 |
|---|---|---|---|---|---|
| Mat | 1x | 16.8 / 50 / 4 | 33.3 / 50 / 4 | 16.8 / 50.1 / 1 | 33.3 / 50 / 8 |
| Mat | 4x | 33.2 / 33.5 / 8 | 33.3 / 33.4 / 3 | 33.3 / 50 / 8 | 33.3 / 50 / 5 |
| Giai mat | 1x | 16.8 / 33.4 / 0 | 16.8 / 33.3 / 0 | 16.8 / 33.4 / 2 | 16.8 / 33.3 / 0 |
| Giai mat | 4x | 16.8 / 33.4 / 1 | 16.8 / 33.4 / 2 | 16.8 / 33.4 / 1 | 16.8 / 49.9 / 3 |

(p95 / max / frames > 33 ms.) No change beyond run-to-run noise. Mat 1x keeps flipping across the
5% edge described below, so it still does not reliably meet p95 ≤ 20 ms. Giai mat passes.

## 2026-10-28 · P22 (owner idea) · Mat map as a tactical display, Giai mat "financial lock"

Map in Mat: brass frame and ruler, a 32px plotting grid (CSS backgrounds on the frame, not on the
zoomed drawing), Viet Nam filled with a brass tint, bright crosshair and labels. Static CSS, no
animation added. Giai mat: the frame no longer slides between targets; on each target its corners
open out from inside (180 ms, same transition as before, other start point). Same tool and
protocol; "before" is the kept row of the entry below.

| Mode | CPU | Before (p95 / max / >33 ms) | After, run 1 | After, run 2 |
|---|---|---|---|---|
| Mat | 1x | 16.8 / 50 / 2, then 33.3 / 50.1 / 5 | 16.8 / 50 / 4 | 33.3 / 50 / 4 |
| Mat | 4x | 33.4 / 50.1 / 10 | 33.2 / 33.5 / 8 | 33.3 / 33.4 / 3 |
| Giai mat | 1x | 16.8 / 33.4 / 0 | 16.8 / 33.4 / 0 | 16.8 / 33.3 / 0 |
| Giai mat | 4x | 16.8 / 50 / 1 | 16.8 / 33.4 / 1 | 16.8 / 33.4 / 2 |

No change beyond run-to-run noise. Mat 1x still flips across the 5% edge described below
(the sight lines' compositing cost), so it still does not reliably meet p95 ≤ 20 ms. Giai mat passes.

## 2026-10-28 · P22 (owner idea) · "Target locked" corners in Mat, chart sight frame

In Mat the selection frame's four corners now appear wide around a target, close in (180 ms) and
blink twice (200 ms). The chart band in Mat got 2px sides, corner caps and a tint (static CSS).
Same tool and protocol (`node tools/perf/cursor-frames.mjs`), plus a 9-run comparison of the share
of frames over 20 ms (a temporary copy of the tool, Mat 1x only, deleted afterwards).

| Version | Mat 1x p95 / max / >33 ms | Mat 4x | Giai mat 1x | Giai mat 4x |
|---|---|---|---|---|
| Before (sight lines, 2026-10-27) | 16.8 / 33.4 / 1 | 33.3 / 99.9 / 11 | 16.8 / 33.4 / 0 | 16.8 / 50 / 2 |
| Corners, close-in after a forced style flush | **33.3** / 33.4 / 4, then **33.2** / 50 / 5 | 33.3 / 50 / 5 | 16.8 / 33.4 / 2 | 16.8 / 50 / 2 |
| Corners, close-in two frames later (kept) | 16.8 / 50 / 2, then **33.3** / 50.1 / 5 | 33.4 / 50.1 / 10, then 33.3 / 66.6 / 9 | 16.8 / 33.4 / 0 | 16.8 / 50 / 1 |

**Reading.** The Mat 1x p95 flips between 16.8 and 33.3 ms from run to run. It is quantised to
display frames, so it jumps as soon as more than 5% of frames take two. The 9-run comparison
shows where both versions sit:

| Mat 1x, median of 9 runs | Frames over 20 ms | p95 |
|---|---|---|
| Corners hidden (the approved ring with sight lines) | 4.8% | 16.8 ms |
| Corners shown (kept version) | 5.0% | 33.3 ms |

The approved sight lines already sit on that 5% edge: 3 runs of the corners-hidden build gave
16.8, 33.3 and 16.8 ms. The corners add about 0.2 points. No long animation frame (> 50 ms) was
recorded on the main thread, so the cost is compositing, not script or layout. Ruled out by
experiment: the blink (no change without it) and the corners' motion (no change with transitions
off). Likely cause: while locked, the turned sight lines cover the whole screen, which software
compositing in headless Chromium redraws every frame. The forced style flush was a real cost and is
gone. **Status: Mat 1x does not reliably meet p95 ≤ 20 ms on this machine, before or after this
change.** Owner decision in P30: keep the sight lines, or drop them while locked.

## 2026-10-27 · P22 (owner idea) · Sight lines on the Mat ring

Four dashed hairlines from the ring to the screen edges, turning 45° with the ring when it locks.
Same tool and protocol as the P22 entry below (`.perf/cursor-frames-*.json`).

| Mode | CPU | P22 ring (p95 / max / >33 ms) | Lines in the ring's layer | Lines as their own layers (kept) |
|---|---|---|---|---|
| Mat | 1x | 16.8 / 50 / 4 | **33.3** / 50 / 8 (fails ≤ 20) | 16.8 / 33.4 / 1 |
| Mat | 4x | 16.8 / 50 / 2 | 33.4 / 133.4 / 12 | 33.3 / 99.9 / 11 |
| Giai mat | 1x | 16.8 / 33.4 / 1 | 16.8 / 33.4 / 1 | 16.8 / 33.4 / 0 |
| Giai mat | 4x | 16.8 / 33.4 / 1 | 16.8 / 66.6 / 4 | 16.8 / 50 / 2 |

Cause of the first failure: the lines were drawn inside the ring's compositor layer, which grew to
a ~6000 px square re-rasterised on every lock. Fix: `will-change: transform` on the lock and each
line, so each line is a 1 px strip the GPU moves and turns. Result: within thresholds everywhere,
but on a 4x slower CPU the Mat sweep now has a p95 of 33.3 ms (limit 40) and more long frames than
the plain ring. Candidate for the P30 trim if a real low-end device shows it.

## 2026-10-27 · P22 · JS cursor layer (ring, selection frame, row underline)

Tool: `node tools/perf/cursor-frames.mjs` (raw results in `.perf/cursor-frames-before.json` and
`-after.json`). 1280×900, `/vi/`, the mouse sweeps the ledger, chart and map (~3 s), then the page
scrolls. Median of 3 runs. "Before" is the P21 build (CSS cursors only), "after" adds the layer.

| Mode | CPU | p95 before | p95 after | Max before | Max after | Frames > 33 ms before | after |
|---|---|---|---|---|---|---|---|
| Mat | 1x | 16.8 ms | 16.8 ms | 50 ms | 50 ms | 1 | 4 |
| Mat | 4x | 16.8 ms | 16.8 ms | 50 ms | 50 ms | 2 | 2 |
| Giai mat | 1x | 16.7 ms | 16.8 ms | 33.4 ms | 33.4 ms | 0 | 1 |
| Giai mat | 4x | 16.8 ms | 16.8 ms | 33.4 ms | 33.4 ms | 0 | 1 |

All under the thresholds (p95 ≤ 20 ms at 1x, ≤ 40 ms at 4x). Long frames went from 0–2 to 1–4 per
~400 frames, with no new worst case; to watch in P30.

Size (`build:prod`, gzip): the gate script that decides whether to load the layer, 1 083 B, on
every page; the layer itself (`cursor-fx`), 1 394 B, fetched only on a hovering mouse, without
reduced motion and with custom cursors on. CSS total 9 505 → 9 925 B. HTML `/vi/` 19 526 → 19 550 B.

## 2026-10-27 · P21 · CSS cursors

Size only: P21 adds no JavaScript at runtime beyond a few bytes in the existing head script, and
CSS cursors are drawn by the operating system (no frame cost). Measured on `build:prod` output.

| Item | Before | After |
|---|---|---|
| `/vi/` HTML (gzip) | 19 486 B | 19 526 B (+40) |
| `/en/` HTML (gzip) | 18 605 B | 18 640 B (+35) |
| CSS total (gzip) | 9 264 B | 9 505 B (+241) |
| Cursor images | — | 4 SVG, 305–339 B gzip each, fetched by the browser only when a cursor is shown |

## 2026-10-27 · P20.7 · Ledger row open/close (`grid-template-rows` transition)

Tool: `node tools/perf/ledger-frames.mjs` (raw results in `.perf/ledger-frames.json`). Each run opens
and closes every toggleable row once (14 toggles), page `/vi/`, Mat. "Off" is the same page with
`.row__panel { transition: none }`, to isolate the transition's own cost.

| Viewport | CPU | Transition | p95 frame | Max frame | Frames > 33 ms | Layouts | Layout time | Style time |
|---|---|---|---|---|---|---|---|---|
| 1280px | 1x | on | 16.7 ms | 16.8 ms | 0 | 215 | 50.8 ms | 35.9 ms |
| 1280px | 1x | off | 16.8 ms | 16.8 ms | 0 | 14 | 3.0 ms | 13.3 ms |
| 1280px | 4x | on | 16.7 ms | 33.3 ms | 0 | 219 | 176.9 ms | 98.6 ms |
| 1280px | 4x | off | 16.7 ms | 49.9 ms | 1 | 14 | 10.7 ms | 64.3 ms |
| 375px | 1x | on | 16.8 ms | 250.0 ms | 9 | 199 | 60.0 ms | 30.3 ms |
| 375px | 1x | off | 16.8 ms | 33.2 ms | 0 | 14 | 3.7 ms | 20.2 ms |
| 375px | 4x | on | 33.3 ms | 433.3 ms | 16 | 187 | 110.0 ms | 66.1 ms |
| 375px | 4x | off | 16.8 ms | 16.8 ms | 0 | 14 | 10.8 ms | 49.0 ms |

**Reading.** The playbook threshold is on p95 frame time (≤ 20 ms at 1x, ≤ 40 ms at 4x): every
configuration passes, so ROADMAP 20.7 does not require replacing the transition. The cost is real
though: the transition multiplies layout passes by about 14, and on a 375 px viewport it produces
long frames (up to 250 ms at 1x, 433 ms at 4x CPU) that the p95 does not show. Decision left to the
owner (candidate for the P30 trim, `UX-v3.md` section 8): keep it, or open rows without a height
animation (e.g. instant open with an opacity/clip-path reveal of the content).
