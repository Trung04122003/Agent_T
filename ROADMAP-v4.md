# ROADMAP v4 — Agent T City (P31–P52)

Read first: `DECISIONS-v4.md` (what the owner decided and the hard limits), `UX-v4.md` (what it should feel like), `docs/performance-playbook.md` (how to measure), `CLAUDE.md` (privacy rules). Talk to the owner in Vietnamese; everything else in English.

## Rules for every phase
1. **One phase per session**, step by step as `step -> verify`, then stop at the Checkpoint and wait for the owner. Report with dev-discipline section 6.
2. **The dossier is canonical.** The city reads only the filtered build data the ledger uses. Never read raw `content/claims.json` in city code. No new claims, dates, figures or titles.
3. **Measure first.** Use `pnpm build:prod` + `pnpm preview`, never `pnpm dev`, for any performance number. Log before/after numbers in `docs/perf-log.md`. The reference floor machine is the owner's Intel i3-1115G4 / 8 GB / integrated graphics. Close other heavy apps, run one heavy tool at a time, median of 3 runs.
4. **Budgets (do not lower, ask to change):**
   - City route JS <= 80 KB gzip total (lazy, only on `/city/`). Atlas data <= 60 KB gzip. City CSS <= 8 KB gzip. Zero image assets (everything procedural). No new fonts.
   - Dossier pages: +0 B JS and no network request caused by the city. Entry points are plain anchors. Gate JS ceiling stays 3.2 KB.
   - Frame time p95 <= 20 ms on the i3 at the **Medium** tier; <= 40 ms at 4x CPU throttle after auto-downgrade. First rendered frame <= 1.5 s after DOM ready (build:prod, preview) and <= 4 s at 4x throttle.
   - Memory: total canvas backing store <= 64 MB; JS heap growth <= 15 MB after 10 minutes of walking and idling; no growth in listener count.
   - One `requestAnimationFrame` loop. Pause when `document.hidden`. Idle ambient <= ~20 fps after 20 s without input. No `backdrop-filter`, no canvas `filter`, no per-frame large gradients.
5. **No new dependency, font, colour family or network request without asking.** Plain Canvas 2D and TypeScript. If something seems to need a library, write the measurement that proves it and ask.
6. **Creative license** (see DECISIONS-v4): decide freely on look and feel, log every invention in `docs/city/creative-log.md` with a screenshot and how to switch it off.
7. **Every phase ends with:** `pnpm typecheck`, `pnpm test`, `pnpm check:contrast`, `pnpm build`, `pnpm check:leaks` (plus `pnpm e2e` where the phase adds flows), and the numbers for the phase's budget. Read the output, do not assume.
8. **Signature moment:** each Act must leave at least one moment from UX-v4 section 11 working and screenshot-ready for the owner.
9. Owner-review images: from P35 on, produce screenshots in `docs/city/review/<phase>/` (fixed camera, both modes) so the owner can judge without running anything. If a design call is a matter of taste, show two options instead of asking in the abstract.
10. If a feature fails its budget after reasonable optimisation, cut it using the order in UX-v4 section 14. Never lower the budget.

## Act 0 — Charter and foundations

### P31 — Charter, content map, budget harness
Goal: make the rules executable before any pixel exists.
- 31.1 Create `docs/city/CHARTER.md`: scope, non-goals (no multiplayer, no backend, no storage of visitors, no analytics, no 3D engine), the hard limits copied verbatim from DECISIONS-v4. -> verify: file exists, owner can read it in two minutes.
- 31.2 Create `docs/city/content-map.md` by reading the **filtered** dossier data (same loader as the ledger): one row per open entry (id, kind, domain, tier, place), plus the `classified` entry as the Vault, plus which dossier components exist (ledger, AAR, risks, capability matrix, evidence trace, request-declassify). Do not hard-code entries in city code. -> verify: a unit test fails if an entry present in the ledger has no plot, or if a `hold` id appears anywhere in the city data.
- 31.3 Add the build flag `PUBLIC_CITY` (default off in `build:prod`, on in dev). When off, `/[lang]/city/` is not emitted and no dossier page links to it. -> verify: test that `dist/` has no `city` route and no city link when the flag is off.
- 31.4 Baseline: run the performance playbook on the current dossier on the i3 and log the numbers (size report, Lighthouse, frames). -> verify: numbers in `docs/perf-log.md`.
- 31.5 `pnpm city:budget` script: fails when city JS, atlas data or CSS exceed the budgets above, and when any file in the city bundle is an image or font. -> verify: run it against a deliberately oversized stub, then remove the stub.
- 31.6 Extend `check:leaks`: scan the city route output for forbidden strings (the existing list), emails other than the allowlisted one, hold ids, phone patterns. -> verify: seeded failure is caught.
Checkpoint: owner reads the charter. (The Atlas interpretation was confirmed on 02/11/2026: the map is a plaza relief table plus a beacon, not the city laid out on the S-shape.)

### P32 — World engine core (no art yet)
- 32.1 `src/city/engine/iso.ts`: 2:1 isometric projection, inverse projection for picking, depth sorting helpers. -> verify: unit tests, round trip within 1e-6 over a grid of points.
- 32.2 Loop: single rAF, delta clamp, pause on hidden, idle throttle, visible fps counter in a dev-only overlay. -> verify: test with fake timers; manual: no rAF activity in a hidden tab (Performance trace).
- 32.3 Layer stack: baked static layer (offscreen canvas, chunked), darkness layer (half resolution), dynamic layer, DOM HUD layer. DPR capped so total backing store stays under 64 MB. -> verify: log of canvas sizes at 1366x768 and 1920x1080.
- 32.4 Quality tiers with a rolling-average auto-downgrade (never auto-upgrade in a session) and a manual control. -> verify: unit test of the controller; throttle the CPU 4x and watch it downgrade once.
- 32.5 Input abstraction: keyboard, pointer, touch, with a single event path and passive listeners; cached rects, no layout reads in the loop. -> verify: no `getBoundingClientRect` inside the loop (lint rule or test grep).
- 32.6 Capability checks (`canvas 2d`, `matchMedia(prefers-reduced-motion)`, `navigator.deviceMemory` when present, `saveData`) deciding High/Medium/Low/Lite. -> verify: table-driven unit test.
Checkpoint: empty scene holds 60 fps on the i3; owner sees nothing yet and that is fine.

### P33 — Route, entry, exit, fallback shell
- 33.1 Route `/[lang]/city/` (flag-gated), `noindex`, canonical to the dossier. -> verify: HTML test.
- 33.2 Entry links (plain anchors) in the gate and the dossier header, carrying `?lens=` and language. -> verify: gate JS size unchanged (byte-for-byte test against the 3.2 KB ceiling); e2e from gate to city and back keeps lens, language and mode.
- 33.3 Static shell: top skip link, "Back to dossier", the district list as real links (from the content map), noscript and print variants. -> verify: e2e with JS disabled lists every open entry; print shows a pointer to the dossier.
- 33.4 Lite view scaffold (static SVG placeholder grid with the district list) so the fallback exists from day one. -> verify: forced via `?lite`, usable with keyboard only.
- 33.5 Lazy loading: the city chunk loads only on the city route; nothing preloads from dossier pages. -> verify: network log on a dossier page shows no city file.
Checkpoint: owner clicks through the empty shell and the fallback.

## Act I — Build the city

### P34 — City plan and procedural buildings
- 34.1 Authored layout data `src/city/plan.ts` (grid positions for plazas, avenues, canal, bridges, plots) plus a deterministic generator for building geometry from archetype parameters (footprint, height, setbacks, roof kit). A fixed layout, not random: the owner's story needs a stable city. -> verify: invariants test (no overlapping footprints, road graph connected, every plot reachable, every entry in the content map has exactly one plot, Vault exists).
- 34.2 Archetypes: stepped campus hall, antenna tower / server hall, market hall, glass tower, low pavilion with mast (abstract, no flags or emblems), observatory, vault monolith, landmark kiosks (Dead Drop, Debrief Room, Archive Tower, Risk Registry, Lab). Picked from `kind` and domain, never from tier, metrics or lens weights. -> verify: snapshot of archetype per entry; test that skyline height does not correlate with tier.
- 34.3 Face shading from one fixed light direction, window grids, roof clutter, edge highlights; static layer baked once per zoom bucket. -> verify: bake time logged; memory logged.
- 34.4 Dev page `/dev/city-sheet` showing all archetypes side by side in both palettes. -> verify: screenshots in `docs/city/review/P34/`.
Checkpoint (taste): owner picks between two skyline directions if Claude Code produced two.

### P35 — Night engine (the Mat look)
- 35.1 `city-tokens.css` derived from `tokens.css`; HUD contrast check wired into `check:contrast`. -> verify: script output.
- 35.2 Darkness layer at half resolution with stamped light sprites (pre-baked gradients), streetlamp pools, rim light on edges, brass accent tubes for signage (stamped sprites, no blur filter), thin haze bands. -> verify: frame time under budget; screenshots.
- 35.3 Redaction-bar signage that jitters (reuse the dossier's redaction behaviour and its reduced-motion rule). -> verify: reduced motion freezes the bars.
- 35.4 Optional rain (High tier only), capped particles. -> verify: toggling tier removes rain and the particle count drops to the cap.
- 35.5 Static grain (no per-frame noise). -> verify: no per-frame allocation in a trace.
Checkpoint: **signature moments 1 and 8** screenshot-ready; owner reviews the night look.

### P36 — Agent T v1: moving, seeing
- 36.1 Procedural figure: body, coat, visor, lantern as polygon sets, 8 facing directions, a 6-frame walk cycle by transform (placeholder styling is fine, the final look is P43). -> verify: dev sprite sheet page.
- 36.2 Movement: keyboard walk, pointer click-to-move via A* on the road graph, building-door targets, collision with footprints, never-stuck fallback. -> verify: unit tests for A*, collision and fallback; e2e walking to a door.
- 36.3 Lantern cone with occlusion by building footprints (2D visibility polygon, ray casting against footprint edges, cached per position cell). -> verify: unit test on a known layout; frame time with the cone on.
- 36.4 Camera follow with easing, bounds, three zoom steps. -> verify: no jitter at zoom edges; reduced motion removes easing.
- 36.5 Long cast shadow from the fixed light direction. -> verify: screenshot.
Checkpoint: **signature moment 1** live; owner walks the city.

### P37 — Districts, missions, briefings
- 37.1 Proximity and door prompts; interaction on `E`/`Enter`/click. -> verify: e2e.
- 37.2 District states sealed/scouted/briefed/declassified, kept in `sessionStorage` inside try/catch, cosmetic only. -> verify: works with storage blocked; content never gated by state.
- 37.3 Briefing dialog (DOM, focus trap, `Esc`), reusing the ledger entry component (extract a shared component if needed, do not copy markup). -> verify: test that dialog text equals ledger text for every entry in both languages and both modes.
- 37.4 HUD: nameplate, mission log (live region), compass ordered by the active lens weights, "light level n of N" (no percent bar). -> verify: a Partner, Client and Curious lens each produce the expected first objective.
- 37.5 Vault (type label only) and the Dead Drop (existing request button, unchanged, allowlisted email only). -> verify: e2e shows no other address; `check:leaks` clean.
- 37.6 Codenames and atmosphere microcopy drafted into `docs/city/copy-review.md` (humanizer skill), strings in the `city` namespace of `content/ui.json` (vi, en). -> verify: `check:locales` passes; no string states a fact absent from content.
Checkpoint: owner approves district codenames and flavor lines.

### P38 — Day engine (the Giai mat look)
- 38.1 Dawn palette and soft low sun, short soft shadows, clear signage, glass reflections as pre-baked gradient stamps. -> verify: contrast check in both modes; screenshots.
- 38.2 Mode wiring to the existing mode state (`mode.ts`) as the single source of truth; the city never keeps its own mode. -> verify: toggling in the city updates the dossier and vice versa after navigation.
- 38.3 Per-district lighting state works in both modes. -> verify: screenshots, 4 states x 2 modes for one building.
Checkpoint: owner compares night and dawn side by side.

## Act II — The Atlas

### P39 — Atlas data export (no new geometry)
- 39.1 Build-time export from the existing `buildMap` output into `atlas.json` (province `d` strings per mode, tiers, places from `content/places.json`, archipelago islands and their labels, six neighbour labels, land borders as in the 2D map). No new geometry source. -> verify: size <= 60 KB gzip, else simplify further at build time with a minimum-area rule that **exempts Hoang Sa and Truong Sa islands**.
- 39.2 Sovereignty test: Hoang Sa and Truong Sa labels in atlas data equal the labels produced for the 2D map in vi and en, both contain "(Viet Nam)"/"(Việt Nam)" as the 2D map does, and the build fails if either is missing. -> verify: deliberately remove one in a scratch run, see the test fail, restore.
- 39.3 No lines of any kind in the sea in the export. -> verify: test over the exported paths.
- 39.4 Hold/privacy: only places already in `content/places.json`. -> verify: test.
Checkpoint: owner reads the data sizes and the sovereignty test output.

### P40 — The Atlas table
- 40.1 Draw provinces with `Path2D(d)` and one affine lift; terraces by tier using the 3D map heights; scan grid sea with a slow sweep line (paused when hidden). -> verify: frame budget with the Atlas on screen; screenshots both modes.
- 40.2 Pins from places; Da Nang as HQ; vertical beacon visible across the whole city. -> verify: beacon visible at all three zoom steps in fog.
- 40.3 Hoang Sa and Truong Sa clusters and labels drawn in a layer that **ignores fog, redaction, fade and zoom culling**. -> verify: e2e pixel check at the label rects in Mat with fog and at far zoom (labels still present); screenshot.
- 40.4 Hover/focus ripple (180 ms up, 160 ms down, transform only, instant under reduced motion). -> verify: trace shows no layout.
Checkpoint: **signature moments 2 and 6**; owner reviews the Atlas, the biggest "wow" of the act.

### P41 — Dive into the real map
- 41.1 Camera dive to the table, cross-fade to the existing DOM Map in an overlay (zoom, pan, legend, list unchanged), `Esc` returns. -> verify: e2e; focus moves into the overlay and back.
- 41.2 Reduced motion: instant swap. Lite view: the overlay opens directly. -> verify: e2e for both.
- 41.3 INP check for opening and closing the overlay. -> verify: web-vitals INP under 200 ms on the i3.
Checkpoint: **signature moment 7**.

### P42 — Atlas and districts talk to each other
- 42.1 Hover/focus on a district lights the Da Nang beacon (as the dossier's "⌖ Da Nang" link does for ledger rows); briefing has "View on atlas". -> verify: e2e.
- 42.2 The mission log shows the place of each entry (all in Da Nang today) without hard-coding. -> verify: change a place in a scratch copy of the content and watch the city follow, then restore.
Checkpoint: owner reviews Act II end to end.

## Act III — Agent T, the character

### P43 — Character v2: the signature
- 43.1 The Long Coat with five lagging hem shards on a spring chain; asymmetric collar. -> verify: dev sprite sheet, 8 directions x walk/idle.
- 43.2 The Visor (brass slit follows facing, periodic glint) and the Lantern (swing, raise at doors). -> verify: screenshot sheet.
- 43.3 The Shadow with the idle hint turning toward the nearest sealed district after ~8 s. -> verify: unit test picks the nearest sealed plot; reduced motion shows no turn.
- 43.4 The Ribbon (redaction bars in Mat, gold hairline in Giai mat), the clearance ring (T1/T2/T3 glyphs), two idles and two gestures. -> verify: draw cost per frame for the whole character <= 1.0 ms on the i3 at High.
- 43.5 Originality note in `docs/city/creative-log.md`: what makes the silhouette original and what was avoided (see UX-v4 section 6, rule 9). -> verify: note exists.
Checkpoint (taste and safety): owner does an image search on the silhouette and chooses between two design directions if offered. **Signature moments 4 and 5 start here.**

### P44 — Declassify sequence
- 44.1 Sunrise wave from Agent T, palette change as it passes, bars slide off, coat lining flips with a 60 ms stagger, nameplate swaps from "Agent T" to "Le Thai Trung". -> verify: frame times during the sequence, no layout in a trace.
- 44.2 Durations: <= 2.1 s High, <= 1.2 s Low, instant on reduced motion; any key or click skips to the end state; never two sequences at once. -> verify: e2e for skip and double trigger.
- 44.3 State consistency: after the sequence the HUD, panels and dossier mode agree. -> verify: e2e.
Checkpoint: **signature moments 3 and 4 complete**; the owner decides whether the sequence is too long.

### P45 — Procedural sound
- 45.1 Web Audio synthesis for footsteps, lantern click, door chime, declassify sweep, city hum. No sample files. Default muted, one control. -> verify: `dist/` has no audio file from the city; test that audio is muted at load.
- 45.2 Integrate with the music gate: the background track appears only if `check:audio` passes (licence). -> verify: with no licence, no track and no track toggle.
- 45.3 Audio never starts before a user gesture; the context is closed when the tab is hidden for long. -> verify: manual and unit test with a mocked context.
Checkpoint: owner listens with and without headphones.

## Act IV — Life and polish

### P46 — Ambient life (capped)
- 46.1 Car light trails along roads (cap 6), two tower searchlight sweeps, blinking antennas, drifting paper/ash particles (cap per tier). No people, no crowds (no depiction of real people). -> verify: counters per tier in a test.
- 46.2 All ambient motion off at Low, frozen under reduced motion, throttled at idle. -> verify: trace at idle shows <= ~20 fps.
Checkpoint: owner reviews whether the city feels alive without feeling busy.

### P47 — Finale and rewards
- 47.1 When all districts are declassified: the city at full light, beacon steady, a calm closing panel built only from content ("Open the full dossier", "Print", "Request declassification"). No score, no confetti. -> verify: e2e; panel text from content only.
- 47.2 Owner-approved easter eggs only (the owner supplies the list; default is none). -> verify: list in the creative log.
Checkpoint: **signature moment 9**.

## Act V — Hardening

### P48 — Accessibility
- 48.1 Full keyboard path to every briefing and landmark; focus order; no trap; `Esc` leaves. -> verify: Playwright keyboard-only test visiting every entry.
- 48.2 Live regions: location announcements, mission log, no spam (rate limited). -> verify: test on announcement rate.
- 48.3 axe checks on the city route in both modes and both languages. -> verify: zero violations (the project already ships `@axe-core/playwright`).
- 48.4 `prefers-reduced-motion`, `prefers-contrast`, 200% zoom, forced colours: usable or Lite. -> verify: emulated runs.
Checkpoint: owner tries it keyboard-only.

### P49 — Mobile and low-end
- 49.1 Touch controls: tap to walk, pinch zoom, a visible 'interact' button, safe areas, orientation changes. -> verify: Playwright mobile emulation tests.
- 49.2 Weak-device behaviour: auto Low or Lite from capability checks; memory warnings; `saveData`. -> verify: forced capability tests.
- 49.3 Manual checklist for in-app browsers (Zalo, Facebook, Messenger) in `docs/city/manual-checks.md`; the owner runs it on a real phone. -> verify: checklist filled by the owner.
Checkpoint: owner tests on his own phone and reports.

### P50 — Performance and memory campaign
- 50.1 `tools/perf/city-frames.spec.ts` (frames while walking, zooming, opening the Atlas, running Declassify) at normal speed and 4x CPU throttle. -> verify: p95 numbers against budgets, logged.
- 50.2 Ten-minute soak: walk, idle, switch modes, open the Atlas, repeat. Heap and listener counts sampled. -> verify: growth within budget.
- 50.3 Long-animation-frame and long-task observation in the soak. -> verify: no task > 50 ms outside the declassify sequence.
- 50.4 Apply the cut list from UX-v4 section 14 for anything over budget. -> verify: re-measure after each cut and log it.
Checkpoint: owner sees the final numbers table.

### P51 — Privacy, content and leak audit
- 51.1 Extend `check:leaks` to the whole city route and its JSON. Forbidden strings (the assistant role and anything tied to it, real org logos, unapproved places, politics beyond the approved map labels). -> verify: seeded failures are caught.
- 51.2 Network audit: Playwright aborts every external request during a full run and the city still works; no cookies set. -> verify: test.
- 51.3 Content parity: for every entry, vi and en, Mat and Giai mat, the briefing equals the ledger. -> verify: test matrix.
- 51.4 Sovereignty regression: labels present in every combination of mode, language, tier, zoom and Lite view. -> verify: test matrix.
- 51.5 Credits and licences: `docs/city/credits.md` (none expected since nothing is imported). -> verify: file states "no third-party assets".
Checkpoint: owner reads the audit.

### P52 — Review pack and release preparation
- 52.1 Capture script producing the owner review set (both modes, three zoom steps, the Atlas, the four states, the sprite sheet, the declassify sequence as a short frame strip) in `docs/city/review/final/`. -> verify: images open.
- 52.2 Copy review: `docs/city/copy-review.md` complete; every string the owner approved is marked. -> verify: no unapproved string in the build (test).
- 52.3 Release switch: city stays behind `PUBLIC_CITY`. Document the exact steps to turn it on, and how to ship the dossier without it (so the v3 P30 release is never blocked). -> verify: `build:prod` without the flag has no city; with the flag has it and passes all checks.
- 52.4 Update `SPEC.md`, `CLAUDE.md` and `README` pointers. Do not commit, push or deploy. -> verify: diff summary to the owner.
Checkpoint: the owner decides whether the city ships in the first public release or after it.

## Stretch (off by default; each is removed if it costs more than 2 ms per frame on the i3)
- S1 **Operation mode**: an optional light stealth layer where sweeping searchlights briefly dim your lantern; being "seen" has no penalty beyond the lantern flicker. Skippable, never required.
- S2 **Time of day**: a slow dusk-to-dawn cycle in the city that is separate from Mat/Giai mat (decoration only).
- S3 **Photo mode**: hides the HUD and saves a PNG of the current view for the owner's own use; no EXIF, no data.
- S4 **Quiet city**: a calm mode with weather, traffic and searchlights off for people who want just the map.

## What the owner provides
- Approve codenames and flavor copy (P37, P52).
- Choose between design options at taste checkpoints (P34, P43).
- Do the silhouette image search (P43).
- Test on a real phone and in-app browsers (P49).
- Decide when the city ships (P52).
