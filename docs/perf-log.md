# Performance log

Measured on the owner's machine (Windows 11, Playwright Chromium), on `build:prod` + `astro preview`,
never on `pnpm dev`. Median of 3 runs. Thresholds: `docs/performance-playbook.md` section 1.

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
