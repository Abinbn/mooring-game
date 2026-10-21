# HUD / UI audit & fix plan

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
