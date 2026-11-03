# UX v4 — Agent T City (2.5D)

Companion to `ROADMAP-v4.md`. Where this file says "must", it is a rule. Where it says "suggested", Claude Code may do better if it measures better (log it in `docs/city/creative-log.md`).

## 0. Idea in one paragraph
A night city that you explore as Agent T. Darkness is what is still sealed; light is what is declassified. Every dossier entry is a building. Walking to it, opening its briefing and declassifying it turns its lights on. In the middle of the city stands the Atlas: a holographic relief table of Viet Nam with a beam of light over Da Nang that can be seen from anywhere. Flipping Mat to Giai mat is a sunrise that sweeps across the whole city. The city is a different way into the **same facts**: it never adds a claim, never hides one behind a game, and the plain dossier is one key press away.

Principles: (1) the dossier is the truth, the city is a lens; (2) fewer things, done with intent; (3) everything is generated from code and the same tokens as the dossier; (4) cheap by design (the i3 laptop is the floor); (5) the site must still work with no JS, with a keyboard only, and in print.

## 1. Flows
Entry points (all plain links, no new JS on dossier pages):
- Gate: a small secondary link under the lens choice, "Enter Agent T's city / Vao thanh pho Agent T".
- Dossier header: same link. Carries `?lens=` and language; mode follows the saved mode.
Exit: "Back to dossier" button always visible in the HUD, `Esc` opens the exit prompt (one press, no confirm dialog needed if nothing was entered), browser Back works, `Tab`-reachable skip link at the very top of the page.
No-JS: the page shows the district list as real links to the briefings (static HTML). Print: a single line pointing to the dossier, and the dossier print view.
Route is `noindex`, canonical points to the dossier.
Deep links: `/city/#d-<claim-id>` opens that briefing directly (also what the DOM district list links to).

## 2. City plan
Suggested layout (Claude Code may refine, keep the logic):
```
                N
      [Signal Room]      [Archive Tower]
   [Academy]   \   avenue   /   [Foundry]
        \       \         /        /
  west ===  [   ATLAS PLAZA  ]  === east
        /       /         \        \
   [Market Hall] /   avenue  \   [Glass Tower]
      [Observatory]        [Embassy Row]
                S        [ Vault ] (sealed monolith)
```
- **One plot per open claim**, generated from the filtered content (7 open entries as of 02/11/2026) plus one **Vault** for `classified` (a sealed monolith, label type only, no text).
- Building archetype is picked from `kind` and `domain` (from `content/domains.json`), never from the person: education = stepped campus hall; technology = antenna tower or server hall; business = market hall; finance-insurance = glass tower (no logo, plain org text on the sign); external relations = low pavilion with a mast (abstract, **no national symbols, no flags, no emblems**); project = observatory or sensor mast.
- Landmarks for existing dossier components: Archive Tower (ledger), Debrief Room (AAR), Risk Registry (risks), Lab (capability matrix and evidence trace), **Dead Drop** (contact: a phone-booth/mailbox kiosk that opens "Request declassification", the only thing that touches email). A landmark appears only if its content exists and is not null.
- A river or canal and a few bridges are allowed for silhouette variety. No coastline claims inside the city (the Atlas has the real coast).
- **Alleys:** at least three narrow alleys, one visible from the plaza (see section 6b). They are where Agent T enters the city.
- Skyline rule: the tallest building is not the "most important" claim. Height comes from archetype, never from tier, metrics or lens weight.

## 3. Projection, camera, controls
- 2:1 isometric. One projection module for the whole city. The Atlas reuses the same geometry strings as the 2D/3D maps; the DOM Map overlay keeps its own `TILT`.
- Camera follows Agent T with easing; pan limits at the city edge; 3 zoom steps (far, mid, close), `+`/`-` and wheel, pinch on touch. Zoom changes redraw only once the gesture settles.
- Keyboard: arrows or WASD move; `Shift` walks faster; `E` or `Enter` interacts (open briefing, use the Dead Drop); `M` toggles Mat/Giai mat; `F` jump to the next objective (camera glide, not teleport); `H` shows the controls; `Esc` exits panels, then the city. Every action has a keyboard path.
- Pointer: click or tap a point to walk there (A* on the road graph); click a building to walk to its door and open it. Cursor: reuse the dossier cursor per mode on desktop; no custom cursor on touch.
- Collision against building footprints; the player can never get stuck (nearest free tile fallback).
- Reduced motion: no camera easing, no weather, no ambient motion, walking becomes stepwise or instant jump between points of interest.

## 4. Light and shadow system
Per-district state (cosmetic only, kept in `sessionStorage`, never gating content):
| State | Look (Mat / night) | Meaning |
|---|---|---|
| sealed | Dark mass, sign shows redaction bars | not visited |
| scouted | Rim light, sign partly readable | seen from within light range |
| briefed | Windows on, teaser text readable | briefing opened |
| declassified | Fully lit, bars slid off, summary + evidence preview readable | summary opened with Declassify |
Progress counter "light level n of N" in the HUD, never a percent bar, never a score.
- **Fog of war:** a half-resolution darkness layer; Agent T's lantern cuts a cone (occluded by building footprints) and a small ambient circle; streetlamps leave pools; lit districts stay lit. Cursor-aware light only on desktop.
- **Beacon:** a vertical light column at the Atlas over Da Nang, visible from the whole city, pulsing slowly. It is the compass of last resort.
- **Shadows:** long cast shadows from one fixed light direction in Mat; short and soft in Giai mat.
- Do not use `backdrop-filter`, canvas `filter`, large blurred shadows or per-frame gradients on big areas. Pre-bake gradients into small sprites and stamp them.
- Palette: read `src/styles/tokens.css`; city tokens live in `src/styles/city-tokens.css` and derive from the existing ones. No new hue family without asking. Mat = ink black + brass; Giai mat = warm light + finance gold. HUD text must pass `check:contrast` in both modes.

## 5. The Atlas
- A relief table in the central plaza: provinces are extruded as the same terrace steps as the 3D map (`home`, `near`, `base`), drawn from the build-time `d` path strings with `Path2D` and one affine lift; the sea is a faint scan grid with a slow sweeping line (paused when hidden).
- Pins come only from `content/places.json`. Da Nang is marked as HQ and has the beacon.
- **Hoang Sa and Truong Sa**: drawn as island clusters at their true positions, labelled "(Viet Nam)" via the same label source as the 2D map. They are exempt from fog, redaction, fading, zoom culling and simplification. No dashed or solid lines in the sea. Land borders and the six neighbour labels follow the existing 2D map exactly.
- Hover or focus on a pin or province lifts it one terrace step (same 180/160 ms ripple as the 3D map, `transform` only).
- **Dive:** at the Atlas press `E`: the camera dives into the table, then cross-fades to the existing accessible DOM Map (zoom, pan, legend, list) in an overlay. `Esc` returns the camera. Reduced motion: instant.
- Before/after the 2025 provincial merger: follow whatever `Map.astro` does for each mode. Do not invent a new rule.

## 6. Agent T: character bible
Goal: unusual, memorable, unmistakably a spy, and 100% original. The owner described the character himself; no existing film, game or comic character is a model for it, and none may be used as one. Built procedurally from polygons (no sprites, no images), 8 directions, readable at 48 px tall.

**Personality (it drives every animation and every line of copy):** cold in the dark, funny in the light, mysterious in both.
- Mat (dark): still, economical, no wasted motion. Idles are stillness and a coat settling. No jokes. Copy is terse.
- Giai mat (light): the same man, but with dry, deadpan humour: small gestures that undercut his own seriousness. Two jokes at most (below). Copy may be wry, never silly.
- Both: you never see a face. The hat brim and the visor keep it dark. The briefcase is never shown open with its contents. He never explains himself.

**The outfit and kit (the owner's list):**
1. **The pardessus.** A long dark overcoat. The hem is split into five trailing shards that lag behind movement on a spring chain, like torn dossier pages. The collar is asymmetric: the left side high and stiff like a file tab, the right side low.
2. **The hat.** A shallow-crown hat with a flat brim in matte ink, a thin brass band, and a small notch on the left that echoes the high left collar. The brim throws the visor into shadow.
3. **Chelsea boots.** Ankle boots with the elastic side gusset readable in silhouette. They make no sound.
4. **The visor.** A smooth, matte, faceless head with one thin horizontal brass slit under the brim. The slit shifts toward the facing direction (also the facing cue). A glint sweeps across it every few seconds. No face, no photo, no real likeness.
5. **The briefcase.** Matte ink with brass corners and one latch, carried in the right hand. Never shown open with contents; when it opens, only gold light spills out.
6. **The pipe.** A silhouette prop under the visor and a tiny warm light: the only warm point in the Mat night. Show an ember glow and, rarely, one thin wisp. No puffing animation, no smoke clouds.
7. **The lantern.** A small brass cylinder in the left hand that makes the light cone. It swings with the gait and is raised when he reaches a door.
8. **The silent walk.** A soft glide with a small bob. No footstep sound, no footprints. The hem lag is the only motion that "speaks". While he walks, the ambient hum dips a little, as if the city held its breath.
9. **The shadow.** The cast shadow is a skewed copy of the silhouette. After about 8 s idle it slowly turns its head toward the nearest sealed district (a quiet hint). Nothing else about it is supernatural.
10. **The ribbon.** Behind him a thin ribbon: in Mat black bars (the path being redacted behind him, the ground behind him darkens back down); in Giai mat a gold hairline. It fades after a few seconds. Decorative only: no axis, no values, no upward-trend reading.
11. **Clearance ring** at his feet: a thin ellipse whose dash pattern shows the clearance of the zone he stands in (T1, T2, T3 glyphs, from computed evidence tiers).
12. **Gestures.** Mat: the coat settles, the wrist ring pulses, the lantern is raised at a door. Giai mat adds the only two jokes: he tips the hat to a lit building as if greeting it; the briefcase latch clicks open a finger's width, a gold glint, he closes it at once and looks away. Nothing else.
13. **Declassify transformation.** The five hem shards flip like pages, one after another from collar to hem (about 60 ms apart), revealing a **gold lining**; the visor slit opens to a lens ring with a warm glint; the lantern turns from cold white to warm gold; the briefcase latch glints; the nameplate changes from "Agent T" to "Le Thai Trung" (same two labels as the portrait frame). He keeps the hat and the mask in both modes.
14. **Originality rule.** Avoid looks tied to existing characters: dark suit with dark sunglasses and white shirt; fedora and trench coat in red; barcode on a bald head; hooded assassin; and any character from a film, series, game or comic the owner has seen. The coat is ink black with gold lining; the face is a mask; the kit is the owner's list. Write a short originality note in `docs/city/creative-log.md`. The owner will do an image search on the silhouette at the P43 checkpoint; change the design if anything matches.
15. No weapons, no uniform, no emblem, no military garment. The character is an observer who carries a light and a case.

## 6b. Alleys, the entrance and the Intruder event
- **Alleys.** The plan has at least three narrow alleys (one visible from the plaza): dark pockets with a doorway recess and a dead lamp. No brand signage, no graffiti text.
- **Opening shot.** When the city opens, Agent T is already inside the nearest alley. On the first input (or after about 1.2 s) he steps out silently into the light. Skippable; under reduced motion he starts standing at the alley mouth.
- **The Intruder event** (optional, rare, non-violent). It can start at most once every 3 minutes, only after the player has been idle for 6 s (control is never taken mid-walk), never during a briefing, the Atlas dive or Declassify, never on the Low tier or with reduced motion, and never in Quiet city. A "suspect" appears at the edge of the light: a featureless dark silhouette with no weapon, no costume and no text. A HUD line says "Movement at the edge of the light." (draft copy for review). Agent T answers: he steps into the nearest dark pocket and comes out of the alley closest to the suspect (the cut is hidden by darkness, about 400 ms). The lantern catches the suspect, who dissolves into redaction bars and is gone; the briefcase latch glints; in Giai mat he tips the hat. Control returns. Total at most 4 s, any key skips. It adds no score and gates nothing.
- **Guardrails.** The suspect never represents any real person, group, nationality, profession, client or organisation. No crime is named. No violence, no chase, no arrest imagery, no red alarm colour, no sound louder than the ambient hum. It is never tied to a claim or to an evidence tier.


## 7. HUD and panels
- HUD (DOM, not canvas, so it is accessible): top-left "AGENT T" nameplate and mode; top-right mode switch, sound toggle, quality, controls help, "Back to dossier"; bottom-left mission log (one line per dossier, state icon); bottom-right compass with next objective ordered by the **lens** weights in `content/lenses.json` (a Partner sees the Partner route first). Compass is a hint, not a gate.
- Briefing panel (DOM dialog, focus trapped, `Esc` closes): shows exactly what the ledger shows for that entry (reuse the component, do not copy markup): teaser in Mat, summary in Giai mat, evidence rows with tier. A button "Open in dossier" links to the ledger anchor `#claim-<id>`.
- Vault panel: type label only. Dead Drop panel: the existing "Request declassification" button, unchanged.
- Mission log and panels are live regions (`aria-live="polite"`) and fully usable without the canvas.

## 8. Mat and Giai mat compared
| | Mat (night) | Giai mat (dawn) |
|---|---|---|
| Light | lantern cone, lamps, rim light | sun, soft long gold light |
| Signs | redaction bars, jittering | clear text, bars slid off |
| Sky | black, haze, optional rain on high tier | pale gradient, thin haze |
| Atlas | dim scan grid, brass terraces | lit relief, gold terraces |
| Agent | black coat, brass visor, cold lantern | gold lining, lens ring, warm lantern |
| Ribbon | black redaction bars | gold hairline |
| Sound | low hum, muffled | open, brighter (same synth, filter opens) |

## 9. Declassify sequence (hero moment, skippable)
Timeline (ms, suggested): 0 hold breath (ambient dips) · 0–300 lantern flares · 300–1700 sunrise wave expands from Agent T across the city as a clip/composite sweep, buildings change palette as it passes, bars slide off signs · 400–900 coat lining flips · 1700–2100 settle, nameplate swaps · total ≤ 2.1 s on high tier, ≤ 1.2 s on low tier, instant on reduced motion. Any key or click skips to the end state. Never run two such transitions at once. Only `transform`, `opacity` and canvas compositing; no layout.

## 10. Sound
Procedural Web Audio only (no sample files): lantern click, door chime, briefcase latch, declassify sweep, distant city hum. **Agent T makes no footstep sound**: while he walks the ambient hum dips slightly. Default muted, one control, volume low, `prefers-reduced-motion` does not change audio but the toggle is always reachable. The background track stays under the existing music gate (`check:audio`, license required).

## 11. Signature moments (one per phase at least)
1. The lantern cutting a cone through the dark, occluded by buildings.
2. The beacon over Da Nang rising out of the fog.
3. Signs un-redacting as the sunrise wave passes.
4. The coat lining flipping to gold.
5. The shadow turning to look at the next sealed building.
6. The Atlas terraces rising under the cursor.
7. The dive from the plaza into the real map.
8. Rain on the glass tower (high tier only).
9. All districts lit: the city at full light, beacon steady.
10. The Dead Drop: the only place where the world touches the real inbox.
11. Agent T stepping silently out of an alley into the light.

## 12. Accessibility and fallbacks
- Whole content reachable without the canvas: static district list (links), landmarks list, same panels.
- Canvas is `aria-hidden`; a visually hidden live region announces location ("Near the Academy, briefing available").
- Focus visible, logical order, no keyboard trap, `Esc` always leaves.
- Contrast: HUD and panels pass WCAG AA in both modes. Do not rely on colour alone (states have icons and text).
- Reduced motion, `prefers-contrast`, 200% zoom, and high-contrast mode must produce a usable city or the Lite view.
- **Lite view** (no canvas world): a pre-rendered static SVG city map with clickable districts and the same panels. Used when capability checks fail, on very low memory, on `saveData`, or by user choice.

## 13. Quality tiers
| Tier | Features | Target |
|---|---|---|
| High | rain, fog at 0.5 scale, up to ~120 particles, reflections (fake) | modern laptops |
| Medium | no rain, ~40 particles, fog at 0.5 scale | the i3 reference must hold this |
| Low | baked ground only, ambient off, fog at 0.35, 30 fps cap | weak phones |
| Lite | no canvas world | fallback |
Auto-downgrade on a rolling frame average (never auto-upgrade in the same session); manual "Quality" control in the HUD. Pause everything when `document.hidden`; drop ambient to ~20 fps after 20 s without input.

## 14. Cut list and kill criteria
If a feature misses its budget after reasonable optimisation, it is cut in this order: rain, reflections, ambient traffic, searchlights, fog smoothness, idle emotes, camera zoom steps. Never lower the budgets. Stretch items (stealth mode, time of day, photo mode) are off by default and are removed if they cost more than 2 ms per frame on the i3. The Intruder event is never cut without the owner's say.

## 15. Acceptance (the owner's eyes)
1. In five seconds a stranger says "spy city" without being told.
2. Agent T is recognisable as a silhouette alone and does not look like another character.
3. Declassify gives a small gasp, once, and can be skipped.
4. The Atlas shows the real Viet Nam with Hoang Sa and Truong Sa labelled "(Viet Nam)" in every state.
5. Every claim reachable by keyboard only, and every panel equals the ledger text.
6. The i3 holds the Medium tier at p95 frame time under 20 ms.
7. Turning JS off or choosing Lite still gives the whole story.
8. Agent T reads as cold in the dark, dry and funny in the light, and mysterious in both, without a single line explaining him.

## 16. Copy rules
Short, concrete, quiet. No exclamation marks, no gamer slang, no percent bars, no "mission accomplished" scores. Flavor lines may set mood ("The lights on this block are still off") but must state nothing the content does not state. All new strings in a `city` namespace in `content/ui.json` for vi and en, listed in `docs/city/copy-review.md`.
