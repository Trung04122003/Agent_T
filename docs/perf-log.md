# Performance log

Measured on the owner's machine (Windows 11, Playwright Chromium), on `build:prod` + `astro preview`,
never on `pnpm dev`. Median of 3 runs. Thresholds: `docs/performance-playbook.md` section 1.

## 2026-11-01 (2) · Map: 3D zoom/pan, terrace ripple, land borders and neighbours' names; gate on every load

Owner requests (2026-11-01). Zoom and pan moved into `map-zoom.ts`, shared by both maps; the 3D view
gets its own buttons. The province under the pointer in 3D rises a step and settles back (a copy of
its stack, moved by transform only, 180 ms up and 160 ms down, nothing while the pointer rests). Land
borders (dash-dot) and six neighbours' names on both maps. The entry gate now shows on every load
(no size change: the head script is about as long). Same method as the entry below (1280 px,
`/vi/`, system cursors, median of 3; the hover sweep now crosses provinces that rise).

| Item | Before (cf8f66e) | After |
|---|---|---|
| `/vi/` HTML | 162 799 B (30 342 B gzip) | 168 334 B (31 563 B gzip, +1 221) |
| `/en/` HTML | 155 151 B (28 759 B gzip) | 160 637 B (29 972 B gzip, +1 213) |
| CSS total (gzip) | 13 824 B | 13 940 B (+116) |
| `map-view` JS (gzip) | 1 784 B | 1 835 B (+51) |
| `map-3d` JS (gzip, on demand) | 1 770 B | 2 648 B (+878) |
| Lighthouse `/vi/` (2 runs) | 97 / 99, LCP 1.9 / 2.0 s, TBT 160 / 90 ms | 98 / 99, LCP 2.4 / 1.9 s, TBT 20 / 20 ms |
| Lighthouse `/en/` (2 runs) | 81 (cold start, TBT 760 ms) / 99, LCP 1.7 / 1.8 s | 99 / 99, LCP 2.0 / 1.9 s |
| Building the 3D view: longest task | none > 50 ms | none > 50 ms |
| Mode switch 63 ↔ 34, click to paint, 1x | 21.4 ms (Mat), 17.6 ms (Giai mat) | 18.6 ms, 21.2 ms |
| Mode switch, 4x CPU | 71.9 ms, 73.3 ms | 78.6 ms, 77.8 ms |
| 3D hover sweep p95, 1x | 16.7 / 16.8 ms | 16.7 / 16.8 ms |
| 3D hover sweep p95, 4x | 16.8 / 16.7 ms | 33.4 / 33.4 ms |

**Reading.** Within the playbook: at 4x CPU the ripple costs a frame now and then (p95 33.4 ms, limit
40 ms), at 1x none. The first Lighthouse run of each audit swings (known P30 item: cold start).

## 2026-11-01 · Map: terraced 3D view beside the flat map

Owner request (2026-11-01). `map-3d.ts` builds a tilted SVG from the 2D drawing in the browser
(no extra HTML, no library), fetched only once its frame is on screen (from 1280 px beside the flat
map; narrower, behind a 2D/3D button). About 730 SVG nodes. Sizes from `build:prod` (gzip -9);
interactions at 1280 px, `/vi/`, system cursors, median of 3 runs.

| Item | Before | After |
|---|---|---|
| `/vi/` HTML | 161 224 B (30 085 B gzip) | 162 871 B (30 346 B gzip, +261) |
| `/en/` HTML | 153 595 B (28 548 B gzip) | 155 223 B (28 769 B gzip, +221) |
| CSS total (gzip) | 13 414 B | 13 824 B (+410) |
| `map-view` JS (gzip) | 1 594 B | 1 784 B (+190) |
| `map-3d` JS (gzip, on demand) | — | 1 770 B |
| Lighthouse `/vi/` (2 runs) | 98 / 99, LCP 2.0 / 1.9 s, TBT 100 / 50 ms | 99 / 99, LCP 2.0 / 1.9 s, TBT 30 / 0 ms |
| Lighthouse `/en/` (2 runs) | 99 / 98, LCP 1.9 / 2.3 s | 99 / 100, LCP 1.9 / 1.7 s |
| Building the 3D view: longest task | — | no long task (> 50 ms) at 1x or 4x |
| Mode switch 63 ↔ 34, click to paint, 1x | 6.8 ms (Mat), 5.9 ms (Giai mat) | 16.5 ms, 16.0 ms |
| Mode switch, 4x CPU | 21.0 ms, 18.8 ms | 61.0 ms, 75.2 ms |
| Hover sweep p95, 1x | 16.8 ms (2D) | 16.8 ms (3D) |
| Hover sweep p95, 4x | 33.2 ms Mat, 16.8 ms Giai mat (2D) | 16.8 ms both (3D) |

**Reading.** All within the playbook (INP ≤ 200 ms, p95 ≤ 20 ms at 1x and ≤ 40 ms at 4x). The mode
switch now rebuilds the 3D view, so it costs about 3–4 times more, still far under 200 ms at 4x.

## 2026-10-29 · Map: provinces before/after the 2025 merger, terraced steps, capital star

Owner request (2026-10-29). Adds 63 province fills and two border meshes to the inline map SVG, a
mode switch and a hover readout (in `map-view`). Sizes from `build:prod` (gzip -9); Lighthouse from
`node scripts/lighthouse.mjs` (mobile, default throttling).

| Item | Before | After |
|---|---|---|
| `/vi/` HTML | 122 969 B (24 049 B gzip) | 153 640 B (29 491 B gzip, +5 442) |
| `/en/` HTML | 116 527 B (22 729 B gzip) | 146 883 B (28 041 B gzip, +5 312) |
| CSS total (gzip) | 12 837 B | 13 415 B (+578) |
| `map-view` JS (gzip) | 1 305 B | 1 594 B (+289) |
| Lighthouse `/vi/` | 99, LCP 2.0 s, TBT 0 ms | 99, LCP 2.0 / 1.9 s, TBT 30 / 40 ms (2 runs) |
| Lighthouse `/en/` | 99, LCP 2.0 s, TBT 0 ms | 99 / 100, LCP 2.0 / 1.7 s, TBT 10 ms |

Hover sweep (1280 px, `/vi/`, mode "before", 121 mouse moves down Viet Nam and back, rAF frame
times; 3 runs each). Giai mat, same sweep, after: p95 16.8 ms at 1x and 4x in both modes of the layer.

| Mat | CPU | Before (no provinces) p95 / max | After p95 / max |
|---|---|---|---|
| JS cursor layer on | 1x | 33.4 / 50.0–83.3 ms (3 of 3) | 33.4–50.0 / 50.0–66.7 ms |
| JS cursor layer on | 4x | 33.4–50.1 / 50.0–83.3 ms | 49.9–50.0 / 50.0–66.7 ms |
| system cursors | 1x | 16.8 / 16.8 ms | 16.8 / 33.3–33.4 ms |
| system cursors | 4x | 16.7–16.8 / 16.8 ms | 16.8–33.3 / 33.3–33.4 ms |

**Reading.** The province layer alone stays within the playbook (p95 ≤ 20 ms at 1x, ≤ 40 ms at 4x).
Mat with the JS cursor layer was already over the 1x threshold before this change (known P30 item:
the sight lines repaint the page under them); over the map the larger drawing makes those repaints
dearer, 1x p95 rising from 33 to 50 ms in 2 of 3 runs. Left for the P30 trim with the existing
sight-line item; not fixed here.

## 2026-10-29 · P29 · The real portrait

The Mat photo is now the page's LCP element (before P29 it was text, next to the placeholder).
Lighthouse mobile (`node scripts/lighthouse.mjs`), `/vi/`, run by run:

| Build | Performance | LCP | Note |
|---|---|---|---|
| Before (P28, placeholder) | 74, 99 | 2.2, 1.7 s | first run cold, as usual |
| Photos, 480 + 960 wide | 98, 96, 95 | 2.1, **2.6**, **2.9** s | median over the 2.5 s target |
| Photos, 480 + 720 + 960 wide, `decoding="async"` (kept) | 86, 99, 99 | 2.0, 1.8, 2.0 s | 86: cold first run, TBT 510 ms |

Why the first build missed: Lighthouse's phone shows the 380 px frame at DPR 1.75, which needs
about 665 px, so it fetched the 960 px AVIF (33 KB). A 720 px variant (20.7 KB AVIF) now serves
most phones. The report confirms the photo is found in the first HTML with `fetchpriority=high`,
starts loading at 70 ms, and is not lazy. The Giai mat photo loads at about 420 ms, at low
priority, after the LCP. A `<link rel=preload>` was not needed.

`/en/` with the first photo build: 95–98, LCP 2.3–2.5 s.

Files (`public/portrait/`, from `tools/portrait/build.mjs`): 18 files, 2 variants × 3 widths × 3
formats. The largest is `high-b-960.jpg` at 67.6 KB (budget 120 KB). The AVIF a browser normally
gets weighs 11–35 KB.

## 2026-10-29 · P28 · Night vision, grain, stirring bars, Giai mat sheet

Tool: `node tools/perf/cursor-frames.mjs` (the P22 pointer sweep over ledger, chart and map, then a
scroll). "Before" is the P27 commit. Each cell is p95 / max / frames > 33 ms.

| Mode | CPU | Before (P27) | First build | Final (grain in background), run 1 | Final, run 2 |
|---|---|---|---|---|---|
| Mat | 1x | 33.3 / 50 / 5 | 33.4 / 66.7 / 13–15 | 33.3 / 49.9 / 3 | 33.2 / 50 / 6 |
| Mat | 4x | 33.3 / 50 / 7 | **49.9** / 83.3 / 25–35 | 33.3 / 66.6 / 11 | 33.4 / 66.6 / 9 |
| Giai mat | 1x | 16.7 / 33.3 / 0 | 16.8 / 33.4 / 1 | unchanged | unchanged |
| Giai mat | 4x | 16.8 / 33.4 / 1 | 16.8 / 50 / 3 | unchanged | unchanged |

The first build failed at Mat 4x: p95 49.9 ms against a 40 ms limit, and long frames tripled.
Isolated by experiment, with temporary copies of the tool that turned one part off:

| Mat, long frames (1x / 4x) | |
|---|---|
| Night vision off (grain on) | 5 / 7, back to P27 |
| Grain off (night vision on) | 4 / 13 |

So night vision was the main cost and the grain made it worse. The grain was a fixed full-screen
overlay at 3% opacity, re-composited under the moving dim and on every scroll. It is now a plain
background layer of `body`. Its 3% lives in the PNG's alpha (grey + alpha, 8/255), so it needs no
layer and no opacity.

What remains is night vision itself. It is a 512 px tile with a fixed gradient, scaled by the GPU
and moved in the ring's own frame, which leaves 2–4 extra long frames per sweep at 4x. Mat 1x p95
still flips at 33.3 ms, as since P22 (the sight lines).

Night vision dims by **12%**, not the 25% the roadmap allows. At 15%, muted text on a grid line
falls to 4.44:1; 12% keeps every Mat text pair AA (worst 4.68:1). `scripts/check-contrast.mjs` now
checks the dimmed pairs too.

Size (`build:prod`, gzip, P27 → P28): `/vi/` HTML 23 680 → 23 971 B (+291: balance, source lines,
seal); all JS 13 496 → 14 237 B (+741); all CSS 12 505 → 12 973 B (+468). New file
`public/noise.png`: 5 386 B (budget 8 KB).

## 2026-10-28 · P27 · Reading profiles, "Aa" panel

**Fonts fetched by `/vi/`** (woff2 files as served, 400 + 700, measured by `e2e/reading.e2e.ts` in
a fresh browser context; budget 70 KB per profile):

| Profile | Before | After |
|---|---|---|
| Hồ sơ (default, Be Vietnam Pro) | 94 228 B, 6 files | **67 320 B, 4 files** |
| Biên bản (Source Serif 4) | none | 54 508 B, 4 files |
| Dễ đọc (Lexend) | none | 66 912 B, 6 files |
| Máy chữ (IBM Plex Mono) | loads with every page (the labels' face) | same, plus its 700 weight |

The default face was over budget before P27, and it was not alone. Fontsource's latin-ext range
overlaps its vietnamese one (Ă, Ỳ...), so a Vietnamese page fetches latin-ext as well. The default
and Source Serif 4 are now declared with latin + vietnamese only, which is everything content/
uses (checked). Lexend fits within budget with Fontsource's own CSS. The three extra faces load
only when a profile is chosen, or when the "Aa" panel shows their names.

**Lighthouse, mobile** (`node scripts/lighthouse.mjs`), before the default-face change → after:

| Page | Before | After, run 1 | After, run 2 |
|---|---|---|---|
| `/vi/` | 100, LCP 1.4 s, TBT 40 ms | 100, LCP 1.4 s, TBT 0 ms | 99, LCP 1.6 s, TBT 30 ms |
| `/en/` | 98, LCP 2.2 s, TBT 30 ms | 99, LCP 2.2 s, TBT 0 ms | 98, LCP 2.2 s, TBT 10 ms |

No measurable change; CLS 0 throughout. Switching profile moves nothing: the face loads first, and
the test counts every layout shift, including those CLS would forgive.

**Size** (`build:prod`, gzip, P26 → P27): `/vi/` HTML 23 072 → 23 691 B (+619, the panel); all JS
12 421 → 13 496 B (+1 075); all CSS 11 528 → 12 505 B (+977). The gate's JS is unchanged.

## 2026-10-28 · P26 · Into the file: aperture, fade, guards

Tool: `node tools/perf/gate-inp.mjs` (new; raw results in `.perf/gate-inp-*.json`). It measures INP
from the browser's Event Timing API, the same source the `web-vitals` library reads; that
library is not installed, and adding it would need the owner's approval. Each run is a first
view of `/vi/`: wait for the gate to settle, click "Client". The tool also reports:
- close: from the click to the gate gone and focus on `<h1>` (the `gate:entered` mark);
- ready: from the click until the View Transition has captured the page.

3 runs, median.

| Screen | CPU | INP before (P25, instant close) | INP after | Close before | Close after | Ready (after) |
|---|---|---|---|---|---|---|
| Desktop 1280 (aperture) | 1x | 48 ms | 120 ms | 102 ms | 713 ms | 127 ms |
| Desktop 1280 (aperture) | 4x | 144 ms | 144 ms | 249 ms | 803 ms | 229 ms |
| Phone Pixel 5 (fade) | 1x | 40 ms | 48 ms | 78 ms | 329 ms | none |
| Phone Pixel 5 (fade) | 4x | **200 ms** | 88 ms | 339 ms | 447 ms | none |

How it got there. The first aperture build was 600 ms long and gave INP 216 ms at 4x, with the
gate closing at 790–947 ms. Two causes, both fixed:
- **The lens reorder read every row's position even without FLIP**, inside the View Transition's
  update. `reorder()` now reads layout only when it animates.
- **The gate's bookkeeping ran inside the click handler** (the event log and the remembered lens,
  both in localStorage). It now runs right after.

The "ready" column shows what is left. Before a View Transition can animate, the browser needs
100–230 ms to capture the page. A 600 ms aperture could therefore never close within 700 ms, so
the aperture is 520 ms ("~600 ms" in UX-v3). `e2e/aperture.e2e.ts` checks two things:
- **On screen** (aperture start to gate gone), the target is ≤ 700 ms, and it holds.
- **From the press**, the check is only the 1200 ms guard. The capture time depends on the
  machine's load, and the full parallel suite pushed the total past 700 ms.

From the press, the total is about 713 ms at CPU 1x on an idle machine (the table above,
counted from just before Playwright's click). On a 4x slower CPU it is 803 ms, where the capture
alone takes about 230 ms. Phones never pay for the capture: below 768 px the gate fades.

Size (`build:prod`, gzip, P25 → P26): all JS 11 908 → 12 421 B (+513); CSS 11 512 → 11 528 B
(+16); `/vi/` HTML unchanged (23 076 / 23 063 B). The gate JS (head decision, script and chunk) is
**2 914 B against its 3 KB cap (25.6)**, so there is little room left for P27+ to add to it.

## 2026-10-28 · P25 (owner revision) · Gate opening in CSS, lens lines, local measurement

Changes on top of the first P25 build below:
- The opening (strip sweep, question sweep, lenses one by one) moved to CSS, so it starts with the
  first paint. The first build started it from the module script, about 200 ms after the first
  paint, which made the lens buttons flash: drawn, hidden, then animated in.
- Every short label decodes on opening and on a language change.
- The reader's line types out when a lens is pointed at.
- New `gate-metrics.ts` keeps the gate's events in local storage only.

| Item | First P25 build | This revision |
|---|---|---|
| `/vi/` HTML (gzip) | 22 045 B | 22 641 B (+596: lens lines, sight SVG) |
| All JS (gzip) | 11 181 B | 11 841 B (+660) |
| All CSS (gzip) | 11 152 B | 11 446 B (+294) |
| Gate JS (head + script + chunk, gzip; cap 3 KB) | 1 714 B | 2 373 B |
| Lighthouse `/vi/` Performance, 3 runs | see below (56–100) | 100, 100, 100 (TBT 40, 30, 80 ms) |

Three clean runs do not prove the earlier swings are gone, since that noise was there before P25
too. They do show that the revision adds no blocking time. Lab timings for the gate are in
`docs/gate-evaluation.md` (`node tools/gate-eval.mjs`).

## 2026-10-28 · P25 · Entry gate

**Size** (`build:prod`, gzip, P24 → P25):

| Item | Before | After |
|---|---|---|
| `/vi/` HTML | 21 145 B | 22 045 B (+900: gate markup, head decision) |
| All JS | 10 144 B | 11 181 B (+1 037) |
| All CSS | 10 807 B | 11 152 B (+345) |

Gate JS (ROADMAP 25.6 cap: 3 KB): 1 714 B gzip in all. That is the head decision (188 B), the
EntryGate script (64 B) and its chunk `entry.*.js` (1 462 B, which bundles the Decode module).
Checked by `e2e/entry.e2e.ts`. There are no extra requests: a first view and a `?skip=1` view load
the same files.

**Lighthouse, mobile, `/vi/`** (`node scripts/lighthouse.mjs`; P25 is a first view, so the gate is
shown). `/vi/` is always audited first and has varied run to run since P20 (cold start):

| Build | Performance by run | TBT by run |
|---|---|---|
| P24 (before) | 99, 71, 73, 99 | 0*, 2 450, 1 560, 120 ms |
| P25 (after) | 75, 100, 66, 56, 100 | 1 280, 0, 7 080, 4 540, 40 ms |

\* first P24 run, logged before the change; TBT 0 ms.

`/en/` (audited second, no gate in the same tab): 99–100 in every run of both builds.

**Reading.** Both builds swing between about 55 and 100 on `/vi/` alone. P25's low runs are lower,
but five runs cannot separate that from the noise. A direct probe of the main thread does not show
the gate costing more. The probe used long animation frames, Pixel 5 size, CPU 4x, 3 runs each;
the probe script was temporary and has been deleted.
- With the gate shown, blocking time was 530 / 606 / 716 ms, and the gate's own script took
  35–87 ms of it.
- With `?skip=1`, blocking time was 611 / 578 / 556 ms.

**Status:** the Performance ≥ 90 budget is not met reliably on `/vi/`, before or after P25. This
is to settle before release (P30): find the cold-start cost, and re-measure with the gate once it
is understood.

## 2026-10-28 · P24 · "Request declassified documents" buttons

Size only. P24 adds no animation, no frame work and no request: links built at build time and
one delegated click handler for "Copy address". Measured on `build:prod` output, gzip. "Before" is
the P23 commit.

| Item | Before | After |
|---|---|---|
| `/vi/` HTML | 19 688 B | 21 139 B (+1 451) |
| All JS | 9 933 B | 10 144 B (+211) |
| All CSS | 10 594 B | 10 807 B (+213) |

The HTML growth is the mail template, percent-encoded, in two links (mailto: and Gmail) for each
of the 6 entries with documents on request, plus the page-end request. That is the price of "no
JS needed to write the mail". If it matters at P30, the links could be built on click instead.

## 2026-10-28 · P23 · Chart crosshair

Tool: `node tools/perf/chart-frames.mjs` (new; raw results in `.perf/chart-frames-*.json`).
1280×900, `/vi/`. The mouse scrubs the chart plot left to right and back four times (244 small
moves). Median of 3 runs. "Before" is the P22 build (band and readout only), "after" adds the
crosshair. Its updates are batched into one `requestAnimationFrame`, it reads the cached plot box,
and it writes `transform`/`textContent` only.

| Mode | CPU | Before (p95 / max / >33 ms) | After, run 1 | After, run 2 |
|---|---|---|---|---|
| Mat | 1x | 16.7 / 33.3 / 0 | 16.7 / 16.8 / 0 | 16.7 / 16.8 / 0 |
| Mat | 4x | 16.8 / 16.8 / 0 | 16.7 / 33.4 / 1 | 16.8 / 16.8 / 0 |
| Giai mat | 1x | 16.8 / 16.8 / 0 | 16.8 / 16.8 / 0 | 16.8 / 16.8 / 0 |
| Giai mat | 4x | 16.8 / 16.8 / 0 | 16.8 / 16.8 / 0 | 16.8 / 16.8 / 0 |

All within thresholds; no change beyond noise. The earlier per-move `getBoundingClientRect` of the
P15 readout is gone too: the box is measured on pointer entry and after a resize.

Size (`build:prod`, gzip, before → after): `/vi/` HTML 19 547 → 19 686 B (+139: the crosshair group,
two readouts, the counts); all JS 9 369 → 9 933 B (+564); all CSS 10 456 → 10 594 B (+138).

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
