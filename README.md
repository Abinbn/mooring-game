# Dead Slow Ahead

A harbour berthing game. You have a 200-metre cargo ship, two tugboats, and one
instruction: bring her alongside the quay — square, centred, and slow enough that
nothing breaks.

Everything is generated at run time: the physics is a fixed-step hydrodynamics
model, the art is canvas 2D, and the sound is synthesised with the Web Audio API.
There are no image, audio or font downloads, and the game makes no network
requests while it runs.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | Type-check, then build a **single self-contained `dist/index.html`** |
| `npm run preview` | Serve the production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run selfcheck` | Headless logic checks (collision, level generation, spawn safety) |

The production build is one file: open `dist/index.html` straight from disk, host
it anywhere, or wrap it for a desktop/mobile shell. No runtime dependencies.

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Engine ahead / astern | `W` `S` (or `↑` `↓`) | ▲ / ▼ |
| Bow tug port / starboard | `Q` `E` | Bow pad |
| Stern tug (or rudder when detached) | `A` `D` | Stern pad |
| Both tugs together | `←` `→` | Link mode, then Push / Pull |
| Attach / cast off tugs | `T` | Anchor button |
| Ship horn | `H` | Horn button |
| Pause | `P` / `Esc` | Pause button |
| Mute | `M` | Options → Sound |

## How a contract works

1. **Approach** — line the ship up with the berth and kill your speed early. She
   carries a lot of momentum and the water pushes back.
2. **Summon tugs** inside the pilot station, or handle her on the engine and
   rudder alone if you prefer.
3. **Berth** — park inside the dashed outline, parallel to the quay, nearly
   stopped, and hold station until the lines are secured.
4. **Departure contracts** reverse this: unmoor, clear the fairway, and cast the
   tugs off before crossing the pilot limit. Dragging them into open water fines
   you, then revokes the contract.

Scoring rewards precision and a clean hull; consecutive perfect berths multiply
the fee. Best runs are kept in a local harbour log.

## Project layout

```
src/
  App.tsx                 phase state machine, screen wiring
  components/
    Hud.tsx               in-game instrument strip, status, tutorial card
    Screens.tsx           menu, pause, score breakdown, game over
    TouchControls.tsx     on-screen pad (portrait + landscape)
    icons.tsx             inline SVG icon set
  game/
    Game.ts               engine: loop, input, physics, scoring, camera
    render.ts             canvas world drawing
    levels.ts             deterministic level generator
    math.ts               vectors, SAT collision, helpers
    particles.ts          particle system
    audio.ts              procedural Web Audio
scripts/selfcheck.ts      headless invariant checks
docs/HUD_UI_AUDIT.md      UI audit that preceded this release pass
```

## Performance notes

- Physics runs on a fixed 120 Hz step with a clamped accumulator, so a slow frame
  cannot explode the simulation.
- Rendering caches the water tile, the star field and the vignette instead of
  rebuilding gradients per frame.
- The particle system has a hard cap and recycles its oldest slot.
- UI chrome is measured once every 0.4 s so the camera frames the ship in the
  space the HUD and the touch pad leave free, on any aspect ratio.

## Accessibility

- Full keyboard play, visible focus rings, `aria-pressed` on toggles, and the
  hull bar exposed as a progressbar.
- `prefers-reduced-motion` disables screen shake, flashes, hit-stop and UI
  animation loops.
- No emoji or platform-dependent glyphs in the interface.
