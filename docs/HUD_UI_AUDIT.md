# HUD / UI audit & fix plan

> **Superseded for the shell.** This document covers the first repair pass (structure,
> input bugs, a11y). A second pass replaced the visual language itself — tokens, type,
> icons, HUD layout and all screens — and fixed the engine-side issues found while doing
> it. See "Second pass" at the bottom.

_Audit of the React HUD (`src/components/Hud.tsx`), the overlays (`src/components/Screens.tsx`),
the touch pad (`src/components/TouchControls.tsx`) and their wiring in `src/App.tsx`._

Everything below is **fixed** in this branch; the fix is described next to each finding.

## P1 — broken layout / invisible UI

| # | Issue | Cause | Fix |
|---|-------|-------|-----|
| 1 | The **hull bar cut through the top-right buttons** (mute / pause / tug / horn). | The bar was pinned with `style={{ top: 88 }}`, but the right column is ~100 px tall (score card 47 px + 6 px gap + 36 px button row + 12 px padding). Being later in the DOM, the bar painted **over** the buttons. | The HUD top region is now a **flow column**: row 1 = level / timer / score + actions, row 2 = hull bar, row 3 = tutorial banner. No magic offsets left. |
| 2 | The **tutorial banner overlapped the hull bar** (`top: 106` vs a bar ending at ~111 px) and on short screens slid under the top bar. | Same hardcoded offsets. | The banner is a centred row in the new column. |
| 3 | The **HUD ignored the notch / status bar**. | `paddingTop: env(safe-area-inset-top)` was set on the root, but every child is `absolute top-0` — padding does not offset absolutely positioned children. | The safe-area inset is now applied to the top column itself (`pt-[calc(8px_+_env(safe-area-inset-top))]`, 12 px on `sm`). |
| 4 | The **timer was not centred** (it drifted with the level-name/button widths) and on phones the level card was crushed: four 36 px buttons + gaps = 162 px of a 360 px screen. | Flex `justify-between` with unequal side widths. | `grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]` with `min-w-0` side cards; the tug/horn buttons are hidden below `sm` (they are duplicated, larger, in the touch pad), leaving mute + pause. |
| 5 | The **"Certified!" academy clear screen was invisible** — it flashed for one frame and jumped straight to level 1. | `clearTutorial()` built the breakdown but never set `levelClearTimer`, so `step()` advanced on the next frame (`moor()` uses 3.4 s, `clearDeparture()` 3.6 s). | `levelClearTimer = 3.4` in `clearTutorial()`. |

## P2 — interaction bugs

| # | Issue | Cause | Fix |
|---|-------|-------|-----|
| 6 | **Touch buttons could stay "held" forever**: pausing / clearing a level / game over while a finger is down unmounted `TouchControls`, so `onInput(action, false)` never fired and the ship kept thrusting after resuming. | No release on unmount; `Game.pause()` kept the held keys. | `TouchButton` releases its action on unmount (handler kept in a ref so re-created callbacks don't trigger it), and `Game.pause()` clears held input. |
| 7 | Stuck input when the tug **link mode** or attach state changed under a pressed button. | The pressed `TouchButton` is unmounted by the conditional render. | Same unmount cleanup. |
| 8 | The pad stayed in **"Linked"** mode after the tugs were cast off and re-summoned. | `linked` is local state that was never reset. | `useEffect` resets `linked` when `tugState !== "attached"`. |

## P3 — copy, a11y and polish

| # | Issue | Fix |
|---|-------|-----|
| 9 | While tugs were on standby the HUD read **"Solo steering"**, and the `[T]` hint was shown on touch devices. | State-aware copy: `⚓ Summon` / `[T] Summon`, `Steaming…`, `✓ Tugs Fast`, `Tugs away` / `Tugs away · [T]`. |
| 10 | Mobile status chips sat at `bottom: 220px` — exactly touching the touch pad (208 px + 12 px inset). | `bottom: calc(232px + safe-area)`; a `max-height: 560px` fallback docks them under the top HUD in landscape instead of into the pad. |
| 11 | Toggle buttons did not announce their state; HUD buttons had no keyboard focus ring; the hull bar was not a progressbar. | `aria-pressed` on mute / tugs / link, `role="progressbar"` + `aria-valuenow` on the hull bar, `focus-visible` rings (plus focus moved into the start-screen dialogs). |
| 12 | **"Restart (R)"** was shown on phones; the resume button could read **"Lv 0"**; the leaderboard listed academy runs as **"Lv 0"**. | `touch` is passed to `GameOverScreen`; level index 0 renders as `Academy`. |
| 13 | `:hover` styles stuck after a tap on touch devices. | Hover rules guarded with `@media (hover: ...)`; decorative loops respect `prefers-reduced-motion`. |
| 14 | **Touch pad overflowed 320 px-wide screens** (164 + 56 + 88 + 24 = 332 px). | Buttons are `70/64/80 px` below `sm` and only grow to the old sizes on wider screens. |
| 15 | The mobile **How-to guide showed "◀ ▶" for both the bow tug and the stern tug**. | Touch labels are now `BOW ◀ ▶` and `STERN ◀ ▶`, matching the pad. |
| 16 | The academy **step 3 instruction said "press [T]"** on phones, and the step header truncated the title. | Touch-specific instruction; the header uses `Step 3/9` + a separate truncating title so the name survives. |
| 17 | TypeScript errors (unused params in `TouchControls`, unused `PilotBoundary` import in `Game.ts`). | Removed — `tsc --noEmit` is clean. |
| 18 | The dev server rejected the hosted preview host. | `server.allowedHosts: true` in `vite.config.ts`. |

## Verification

- `npx tsc --noEmit` — clean (previously 3 errors).
- `npm run build` — clean.
- All HUD/screen components rendered with `react-dom/server` for desktop + touch and
  normal/tutorial/game-over states to check the render paths.
- `vite dev` serves the app through the preview proxy host (HTTP 200).

## Out of scope (noted for a follow-up)

- The touch pad takes ~220 px of vertical space; on landscape phones (`height < 500 px`) that is
  most of the play area. A dedicated compact/landscape pad would help.
- `index.html` disables pinch zoom (`user-scalable=no`) — intentional for a game, but it hurts a11y.
- Dialogs move focus in and restore Escape handling, but there is still no full focus trap.


---

## Second pass — production hardening & design language

### Engine
| Issue | Fix |
| --- | --- |
| The pilot-area rule was cosmetic: penalties ticked forever, the fatal line was somewhere else (the exit threshold). | Tugs outside the pilot limit fine you, then revoke the contract after a 3 s grace period; the HUD shows a live countdown. The academy is exempt. |
| The pilot boundary was drawn as a single line, so the north/south limits were invisible. | Full dashed boundary rectangle with the seaward limit line labelled. |
| `isInRendezvousRange()` used an infinite vertical band, so tugs could be summoned far outside the drawn pilot station. | Trigger is the drawn circle. |
| SAT could resolve a deep quay contact the wrong way and eject the hull onto land. | Hard hull-vs-quay clamp plus basin limits after every collision pass. |
| The camera framed the ship inside a hardcoded `top: 64 / bottom: 196` box. | Insets are measured from the real HUD/pad DOM every 0.4 s (and on phase change), so framing is correct on any aspect ratio. |
| The first rendered frame used a 1×1 viewport: the camera started fully zoomed out and drifted in for seconds. | Resize before the first level load and snap the camera to its target. |
| Score screens auto-advanced after 3.4 s — barely enough to read five rows. | 6 s, one exported constant shared with the progress bar, plus an explicit continue button. |
| AudioContext was never closed; deferred horn/tug sounds fired after unmount. | `AudioSys.dispose()`, tracked timers cleared on destroy. |
| Reduced-motion was CSS-only. | Canvas shake, flash and hit-stop are disabled too. |

### Design language
The interface was rebuilt around a restrained maritime instrument style:

- **Type:** system UI stack (Inter/SF/Segoe), tabular numerals, 10–13 px labels,
  weights 500–700. Gradient headings, `tracking-widest` everywhere and 900-weight
  display type are gone.
- **Icons:** 16 inline SVG glyphs replace every emoji — including the ones drawn
  into the canvas, which rendered as tofu on systems without an emoji font.
- **Colour:** four ink surfaces, paper text, one amber signal with semantic
  safe/danger/teal. Neon cyan rings, glow shadows, purple accents and pulsing
  CTAs removed.
- **Surfaces:** flat translucent bars, 1 px hairlines, one shadow level, no
  backdrop blur on the play field (expensive on mobile GPUs).
- **Layout:** one instrument strip instead of three floating glass cards; the
  hull line is part of it. The touch pad gains a landscape variant.
- **Copy:** "juicy", "★ New harbour record ★" and emoji punctuation replaced with
  plain, specific language ("New harbour record", "Play", "Main menu").

### Verification
- `npm run typecheck` — clean.
- `npm run selfcheck` — 268 invariants: SAT/circle collision behaviour, level
  determinism, spawn/berth clearance for 40 levels × 4 seeds, quay clamp.
- Headless run of the real `Game` class against a mock canvas: menu, academy,
  pause/resume, horn, tug attach/detach and four level types — no exceptions.
- SSR render of every screen in desktop and touch states: no emoji, no legacy
  gradient/glow classes.
- `npm run build` — single 368 kB `dist/index.html` (111 kB gzipped), no external
  requests at runtime.

## Second pass — handling, cockpit and player identity

Follow-up round after playing the merged build: the hull answered the helm like a
speedboat, the tugs teleported, the pad was a patchwork of sizes, and repeated
runs piled up duplicate score entries for the same person.

### Handling

| Symptom | Cause | Fix |
| --- | --- | --- |
| A 200 m hull could be spun on the spot. | Rudder lift was linear in speed with no ceiling; yaw inertia was low. | `MAX_ANGVEL = 0.075 rad/s` (≈4.3 °/s) hard cap, `RUDDER_LIFT = 0.5`, extra rudder drag, `INERTIA = 1500`, `K_ANG = 0.9`. Measured peak yaw: **22 °/s → 4.3 °/s**. |
| The ship stopped dead instead of drifting. | Heavy linear longitudinal drag. | `K_LONG = 0.095`, `C_LONG = 0.0016`. Coasting from 4 u/s still leaves **1.35 u/s at 10 s, 0.51 at 20 s, 0.20 at 30 s** — any way at all keeps her moving. |
| Turning scrubbed off all speed. | Rudder drag multiplied the whole flow vector. | Drag applies to the athwartships component only; 4 s of hard helm at 9 u/s leaves 4.4 u/s of headway. |
| Tugs jumped from the quay to the hull. | Attachment was a smoothstep on a timer, not motion. | Tugs are free-sailing bodies: `TUG_ACCEL = 30 u/s²` from rest up to `TUG_MAX_SPEED = 92`, aimed at the slot with the berth's own velocity fed forward, so they **build way, run, and ease alongside** in ≈3 s from 200 u out (≈7 s if the ship is already making full sea speed). They make fast to the flank they are already on, and a tug that does end up on the wrong side runs past the nearest end first instead of grinding along the topsides. |
| The hull passed straight through a waiting tug. | No tug collision at all. | Circle-vs-hull SAT against `transformPoly(HULL, …)`: the tug is shoved clear, the ship loses a little way, foam and a "TUG CLEARED" caption fire, and a decaying avoidance offset keeps her from jam-cleating against the topsides. |

### Pad

- Every control is the same 54 px square (44 px on short landscape): Ahead/Astern
  match the bow/stern arrows, Horn matches Summon/Cast off.
- The **Link** switch sits between **Push** and **Pull** when the tugs are
  attached (and in the middle of the four arrows when they are independent).
- The **speed read-out moved above the Ahead button**, where the eye already is.

### Onboarding & scores

- A run only starts from a button press; `Enter`/`Space` no longer launch from
  the menu. `Escape` pauses, `P` toggles pause, `M` mutes, `R` restarts.
- The start screen loses the mission tagline and the "harbour office" / "take the
  helm" jargon: **Play**, **Main menu**, "Press a button to begin."
- **One pilot per device.** The callsign lives in `localStorage`, is editable from
  the options menu, and a run is logged silently under it — no form, no second
  row. `addScore` keeps one row per callsign (best run wins) and normalises the
  returned rank.

### Motion comfort

Scrolling water layers, current streaks, rock dashes, berth chevrons and labels
now drift **forward only** and at roughly a third of the old rate; `render` never
scrolls a wave texture backwards, which is what made some levels feel like the
camera was reversing.

### Verification
- `npm run typecheck` — clean.
- `npm run selfcheck` — 268/268 invariants still pass with the new handling.
- Headless `Game` probes: yaw cap, coast decay, tug speed ramp, tug arrival time
  on three levels, hull-vs-standby-tug separation.
- SSR render of the start and game-over screens: no jargon, no key-to-start hint,
  logged-pilot line present, name form suppressed for a known callsign.
- `npm run build` — single 370 kB `dist/index.html` (112 kB gzipped).

## Third pass — helm, tugs, cockpit feedback and the pause key

Reported from play: the ship was too slow to swing, the clock started before the
player did, reverse ran as fast as ahead, `Esc`/`P` did not pause (and flickered
when it did), sound carried on through a pause, the speed read-out was
unreadable and missing on desktop, the horn shared the speaker icon, and the
tugs teleported between flanks.

### Handing

| Problem | Cause | Fix |
| --- | --- | --- |
| The hull could barely be turned, in any mode. | The 4.3 °/s yaw cap applied to the tugs as well as the rudder. | The cap is now mode-dependent: `MAX_ANGVEL = 0.075` (≈4.3 °/s) on the rudder, `MAX_ANGVEL_TUGS = 0.38` (≈21.8 °/s) with the tugs fast, `TUG_TORQUE_SCALE = 1.8`. A full circle with the tugs takes **16.6 s**; on the rudder alone she creeps round, which is the point of hiring tugs. |
| Reverse matched ahead. | Astern used 63 % of the ahead thrust and the same drag model. | `ENGINE_ASTERN = 5` plus a soft `ASTERN_SPEED_LIMIT = 22 u/s` governor: **22.3 u/s astern against 66.8 u/s ahead — exactly ⅓**. |
| The clock ran while the briefing was up. | `timeLeft` ticked from the first frame of the level. | The clock and the briefing both hold until the first command (helm, tugs or horn), and the briefing card no longer fades out on a timer of its own. |

### Pause

- `P`/`Esc` are handled in exactly one place (the engine). The React layer used to
  handle them too, so a single press paused and immediately resumed — the flicker.
- Key auto-repeat no longer toggles pause; `Enter`/`Space` still do nothing on the
  menu, so a run can only start from a button.
- `AudioSys.suspend()` now suspends the whole `AudioContext`, which silences a horn
  or a collision tone that is already ringing, and `resume()` wakes it. Loops are
  faded out first so nothing slams back in at full level.

### Tugs

- **One flank, decided once.** Both tugs work the seaward side, chosen when they
  are summoned; the old code re-pointed them at the ship's current flank, so the
  first tug to come alongside appeared to hop to the other side.
- **A real approach.** Three latched stages — open out to a runway ~40 u off the
  topsides, run along it until abeam, then haul in — plus a wide clearance while
  closing fast, and a "round the nearer end" diversion if a tug is on the wrong
  side of the hull. Nothing aims across the ship any more.
- **Idle means idle.** At the berth the tugs hold their station and their heading;
  the bobbing offsets and the ±0.06 rad heading hunt are gone.
- **No snapping.** Attachment is now within 9 u of the slot and the hand-over to
  hull-relative motion starts from where the tug actually is. Worst observed
  single-frame movement through summon, approach, attach and heavy tug work: 2.9 u.
- If the deadline expires while they are still out in the basin, they stand down
  instead of teleporting to the hull.

### Cockpit

- `HudData.forwardSpeed` is the signed speed along the keel, so the read-outs can
  show **astern as a negative** and colour it as danger.
- The touch pad's speed block has an opaque dark ground and a brighter value
  (it was translucent green on water), and reads `−4.6 / kns ast` going astern.
- **Desktop now has a speed read-out**: its own cell in the instrument strip —
  number, unit, and AHEAD / ASTERN / ALL STOP.
- Pad layout: **Horn left, Summon/Cast off right**, and the **Link** switch moved
  above the arrow cluster instead of sitting between the buttons.
- New `shipHorn` glyph (a whistle on its mast) so the horn button can no longer be
  mistaken for the sound toggle, which keeps the speaker.
- Status chips gained an opaque ground; the pause screen's key hints now match the
  real controls (including "aster is a third of ahead" and "the same keys work the
  rudder when the tugs are away").

### Verification
- `npm run typecheck` — clean; `npm run build` — 387 kB single file (114 kB gzip).
- `npm run selfcheck` — 268/268.
- Headless probes: pause/resume by key with repeat, clock and briefing held until
  the first command (helm, horn and summon each start it), helm keys inert while
  paused, astern ratio, rudder and tug yaw, full circle timing, tug station-keeping,
  approach clearance, no single-frame teleports, deadline stand-down, mooring settle.
- SSR renders of the pad and the strip: horn left of summon, link above the arrows,
  speed above Ahead, desktop speed cell present, whistle glyph on the horn only.
