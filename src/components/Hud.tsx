import type { HudData } from "@/game/Game";
import { fmtTime } from "@/game/math";
import { Icon } from "@/components/icons";
import { cn } from "@/utils/cn";

interface Props {
  hud: HudData;
  touch: boolean;
  onPause: () => void;
  onMute: () => void;
  onHorn: () => void;
  onToggleTugs?: () => void;
}

const BTN =
  "pointer-events-auto relative flex h-8 w-8 items-center justify-center rounded-md border border-paper/20 bg-paper/[0.06] text-paper transition-colors cursor-pointer active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-paper/60";

export default function Hud({ hud, touch, onPause, onMute, onHorn, onToggleTugs }: Props) {
  const unlimited = hud.unlimitedTime;
  const low = !unlimited && hud.timeLeft < 10 && !hud.introActive;
  const hullColor = hud.hull > 60 ? "#57b98a" : hud.hull > 30 ? "#f0a63c" : "#d9564a";
  const curMag = Math.hypot(hud.current.x, hud.current.y);
  const curAngle = (Math.atan2(hud.current.y, hud.current.x) * 180) / Math.PI;
  const tugsAttached = hud.tugState === "attached";

  return (
    <div className="pointer-events-none absolute inset-0 select-none font-display">
      {/* ── Instrument strip ─────────────────────────────────────
          One bar: mission · clock · score, with the hull line built in.
          Measures itself (data-ui-top) so the 3D camera frames the ship
          in the space that is actually free.                          */}
      <div data-ui-top className="absolute inset-x-0 top-0 flex flex-col gap-1.5 px-2 pb-2 pt-[calc(8px_+_env(safe-area-inset-top))] sm:px-3 sm:pt-[calc(12px_+_env(safe-area-inset-top))]">
        <div className="panel-flat overflow-hidden rounded-lg">
          <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-stretch">
            {/* Mission */}
            <div className="min-w-0 px-2.5 py-1.5 short:py-1">
              <div className="label truncate text-paper-mute">
                {hud.missionType === "tutorial" ? "Academy" : `Contract ${hud.level}`}
              </div>
              <div className="truncate text-[13px] font-semibold leading-tight text-paper sm:text-sm">{hud.levelName}</div>
              <div className="mt-0.5 flex items-center gap-1 text-[10px] font-medium">
                {hud.tugState === "standby" && hud.inRendezvousRange ? (
                  <span className="flex items-center gap-1 text-signal">
                    <Icon name="anchor" className="h-3 w-3" />
                    {touch ? "Summon tugs" : "Summon tugs · T"}
                  </span>
                ) : hud.tugState === "approaching" ? (
                  <span className="text-signal">Tugs closing…</span>
                ) : tugsAttached ? (
                  <span className="flex items-center gap-1 text-safe">
                    <Icon name="check" className="h-3 w-3" />
                    Tugs fast
                  </span>
                ) : (
                  <span className="text-paper-mute">{touch ? "Tugs away" : "Tugs away · T"}</span>
                )}
              </div>
            </div>

            {/* Clock */}
            <div className="flex flex-col items-center justify-center border-x border-paper/10 px-2.5 py-1.5 short:py-1">
              <div className="label text-paper-mute">{unlimited ? "Academy" : "Time"}</div>
              <div
                className={cn("num text-xl font-bold leading-none sm:text-2xl", low ? "text-danger anim-blink" : "text-paper")}
                aria-label={unlimited ? "No time limit" : `${Math.ceil(hud.timeLeft)} seconds remaining`}
              >
                {unlimited ? "—" : fmtTime(hud.timeLeft)}
              </div>
            </div>

            {/* Score + controls */}
            <div className="flex min-w-0 items-start justify-end gap-2 px-2 py-1.5 short:py-1">
              <div className="min-w-0 text-right">
                <div className="label text-paper-mute">Score</div>
                <div key={hud.scoreBump} className="num anim-score-pop text-lg font-bold leading-none text-paper sm:text-xl">
                  {hud.displayScore.toLocaleString()}
                </div>
                {hud.streak > 1 && (
                  <div className="num mt-0.5 whitespace-nowrap text-[10px] font-semibold text-safe">
                    Streak ×{hud.mult.toFixed(1).replace(/\.0$/, "")}
                  </div>
                )}
              </div>
              <div className="flex shrink-0 gap-1">
                {/* Tug + horn live in the touch pad; hide them on narrow screens. */}
                <div className="hidden gap-1 sm:flex">
                  <button
                    type="button"
                    onClick={onToggleTugs}
                    className={cn(
                      BTN,
                      tugsAttached && "border-safe/70 bg-safe/20 text-safe",
                      hud.tugState === "standby" && hud.inRendezvousRange && "border-signal/80 bg-signal/15 text-signal",
                    )}
                    title={tugsAttached ? "Cast off tugs (T)" : "Attach tugs (T)"}
                    aria-label="Tugs"
                    aria-pressed={tugsAttached}
                  >
                    <Icon name="anchor" className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={onHorn} className={BTN} title="Ship horn (H)" aria-label="Ship horn">
                    <Icon name="horn" className="h-4 w-4" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={onMute}
                  className={BTN}
                  aria-label="Sound"
                  aria-pressed={hud.muted}
                  title={touch ? "Sound" : "Sound (M)"}
                >
                  <Icon name={hud.muted ? "volumeOff" : "volume"} className={cn("h-4 w-4", hud.muted && "text-paper-mute")} />
                </button>
                <button type="button" onClick={onPause} className={BTN} aria-label="Pause">
                  <Icon name="pause" className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Hull line */}
          <div className="flex items-center gap-2 border-t border-paper/10 px-2.5 py-1">
            <span className="label shrink-0 text-paper-mute">Hull</span>
            <div
              className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/45"
              role="progressbar"
              aria-label="Hull integrity"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(hud.hull)}
            >
              <div
                className="hull-bar h-full rounded-full"
                style={{ width: `${Math.max(0, Math.min(100, hud.hull))}%`, backgroundColor: hullColor }}
              />
            </div>
            <span className="num shrink-0 text-[11px] font-semibold" style={{ color: hullColor }}>
              {Math.round(hud.hull)}%
            </span>
            {curMag > 0.3 && (
              <span className="num ml-auto hidden shrink-0 items-center gap-1 text-[10px] text-paper-dim sm:flex">
                <Icon name="chevronRight" className="h-3 w-3" style={{ transform: `rotate(${curAngle}deg)` }} />
                {(curMag * 0.55).toFixed(1)} kn
              </span>
            )}
          </div>
        </div>

        {/* Breach warning */}
        {hud.tugPenaltyWarning && hud.tugBreachIn !== null && (
          <div className="pointer-events-none mx-auto flex max-w-[560px] items-center justify-center gap-2 rounded-md border border-danger/60 bg-danger/20 px-2.5 py-1.5">
            <Icon name="alert" className="h-3.5 w-3.5 shrink-0 text-danger" />
            <span className="text-[11px] font-semibold text-paper">
              Tugs outside the pilot area — cast off
              <span className="num ml-1 text-danger">{hud.tugBreachIn.toFixed(1)}s</span>
            </span>
          </div>
        )}

        {/* Tutorial card */}
        {hud.tutorial && (
          <div className="pointer-events-auto mx-auto w-full max-w-[560px]">
            <div
              className={cn(
                "rounded-md border px-3 py-2 transition-colors sm:px-4",
                hud.tutorial.completed ? "border-safe/60 bg-[#0a2a22]/95" : "border-paper/15 bg-[#071e27]/95",
              )}
            >
              <div className="mb-1 flex items-center justify-between gap-2 border-b border-paper/10 pb-1">
                <div className="flex min-w-0 items-center gap-1.5">
                  <Icon name="compass" className="h-3.5 w-3.5 shrink-0 text-teal" />
                  <span className="num shrink-0 text-[10px] font-semibold uppercase tracking-[0.08em] text-teal">
                    Step {hud.tutorial.step}/{hud.tutorial.totalSteps}
                  </span>
                  <span className="truncate text-[10px] font-semibold uppercase tracking-[0.06em] text-paper-dim">
                    {hud.tutorial.title}
                  </span>
                </div>
                <span className="shrink-0 rounded border border-paper/20 bg-paper/10 px-1.5 py-0.5 text-[10px] font-semibold text-signal">
                  {hud.tutorial.keyHint}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <p className="text-[12px] leading-snug text-paper sm:text-[13px] short:hidden">{hud.tutorial.instruction}</p>
                {hud.tutorial.completed && (
                  <span className="flex shrink-0 items-center gap-1 rounded border border-safe/50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-safe">
                    <Icon name="check" className="h-3 w-3" />
                    Done
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Bottom status row · desktop ───────────────────────── */}
      {!touch && (
        <div
          className="absolute left-1/2 flex max-w-[96vw] -translate-x-1/2 flex-wrap items-center justify-center gap-1.5 px-2"
          style={{ bottom: "calc(16px + env(safe-area-inset-bottom))" }}
        >
          {hud.missionType === "departure" ? (
            <>
              <Chip ok={hud.speed > 0.8} label="Propulsion" />
              <Chip ok={tugsAttached} label={tugsAttached ? "Tugs attached" : "Tugs detached"} />
              {hud.departureExit && <Chip ok label={hud.departureExit.label} tone="teal" />}
            </>
          ) : (
            <>
              <Chip ok={hud.align.pos} label="Position" />
              <Chip ok={hud.align.angle} label="Angle" />
              <Chip ok={hud.align.speed} label="Speed" />
              {hud.securing > 0.02 && hud.phase === "playing" && (
                <div className="num rounded border border-safe/50 bg-safe/15 px-2 py-1 text-[10px] font-semibold text-safe">
                  Securing {Math.round(hud.securing * 100)}%
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Bottom status row · touch (sits above the pad) ───── */}
      {touch && (
        <div className="touch-chips absolute left-1/2 flex max-w-[96vw] -translate-x-1/2 flex-wrap items-center justify-center gap-1.5 px-2">
          {hud.departureExit && (
            <div className="whitespace-nowrap rounded border border-teal/50 bg-teal/15 px-2 py-1 text-[10px] font-semibold text-teal">
              {hud.departureExit.label}
            </div>
          )}
          {hud.securing > 0.02 && hud.phase === "playing" && hud.missionType !== "departure" && (
            <div className="num whitespace-nowrap rounded border border-safe/50 bg-safe/15 px-2 py-1 text-[10px] font-semibold text-safe">
              Securing {Math.round(hud.securing * 100)}%
            </div>
          )}
        </div>
      )}

      {/* ── Level intro ──────────────────────────────────────── */}
      {hud.introActive && !hud.tutorial && (
        <div key={hud.level} className="anim-banner absolute left-1/2 top-[38%] w-[min(92vw,560px)] -translate-x-1/2 text-center">
          <div className="panel inline-block rounded-lg px-5 py-3 text-left sm:px-6 sm:py-4">
            <div className="label text-teal">
              {hud.missionType === "departure" ? `Outbound contract ${hud.level}` : `Contract ${hud.level}`}
            </div>
            <div className="mt-0.5 text-xl font-semibold uppercase tracking-[0.02em] text-paper sm:text-2xl">{hud.levelName}</div>
            <div className="mt-1.5 max-w-[46ch] text-[12px] leading-snug text-paper-dim sm:text-[13px]">{hud.introTip}</div>
          </div>
        </div>
      )}
    </div>
  );
}

function Chip({ ok, label, tone }: { ok: boolean; label: string; tone?: "teal" }) {
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 rounded border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.06em]",
        tone === "teal"
          ? "border-teal/50 bg-teal/15 text-teal"
          : ok
            ? "border-safe/50 bg-safe/12 text-safe"
            : "border-paper/15 bg-paper/[0.04] text-paper-mute",
      )}
    >
      <span className={cn("inline-block h-1.5 w-1.5 rounded-full", ok && tone !== "teal" ? "bg-safe" : "bg-paper/30")} />
      {label}
    </div>
  );
}
