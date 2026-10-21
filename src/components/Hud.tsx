import type { HudData } from "@/game/Game";
import { fmtTime } from "@/game/math";
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
  "btn-ghost relative flex h-9 w-9 items-center justify-center rounded-lg font-black cursor-pointer transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 focus-visible:ring-offset-2 focus-visible:ring-offset-[#06202b]";

export default function Hud({ hud, touch, onPause, onMute, onHorn, onToggleTugs }: Props) {
  const unlimited = hud.timeLimit > 9000;
  const low = !unlimited && hud.timeLeft < 10 && !hud.introActive;
  const hullColor = hud.hull > 60 ? "#3ef2a0" : hud.hull > 30 ? "#ffb340" : "#ff5d5d";
  const curMag = Math.hypot(hud.current.x, hud.current.y);
  const curAngle = (Math.atan2(hud.current.y, hud.current.x) * 180) / Math.PI;
  const tugsAttached = hud.tugState === "attached";

  return (
    <div className="pointer-events-none absolute inset-0 select-none font-display">

      {/* ── Top stack (level · timer · score / hull · tutorial) ───
          Laid out in normal flow so the bars can never overlap the
          buttons above them, whatever the font size or viewport.   */}
      <div className="absolute inset-x-0 top-0 flex flex-col gap-2 px-2 pb-2 pt-[calc(8px_+_env(safe-area-inset-top))] sm:px-3 sm:pt-[calc(12px_+_env(safe-area-inset-top))] sm:pb-3">
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-2">
          {/* Left: level card */}
          <div className="min-w-0 rounded-xl bg-black/40 px-2.5 py-1.5 ring-1 ring-cyan-300/20 backdrop-blur-sm sm:px-3">
            <div className="truncate text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300/80">
              {hud.missionType === "tutorial" ? "Training Academy" : `Lv ${hud.level}`}
            </div>
            <div className="truncate text-sm font-extrabold leading-tight text-white sm:text-base">{hud.levelName}</div>
            {/* Tug status — icon + word only, no prose */}
            <div className="mt-0.5 truncate text-[10px] font-bold tracking-wider">
              {hud.tugState === "standby" && hud.inRendezvousRange ? (
                <span className="text-amber-300 anim-blink">⚓ {touch ? "Summon" : "[T] Summon"}</span>
              ) : hud.tugState === "approaching" ? (
                <span className="text-amber-200">
                  <span className="inline-block animate-spin text-[10px]">⚙</span> Steaming…
                </span>
              ) : tugsAttached ? (
                <span className="text-emerald-300/80">✓ Tugs Fast</span>
              ) : (
                <span className="text-cyan-200/40">{touch ? "Tugs away" : "Tugs away · [T]"}</span>
              )}
            </div>
          </div>

          {/* Centre: timer — centred by the grid, never pushed by side content */}
          <div
            className={cn(
              "justify-self-center rounded-xl px-2.5 py-1.5 text-center ring-1 backdrop-blur-sm sm:px-3",
              low ? "bg-red-600/40 ring-red-300/60 anim-blink" : "bg-black/40 ring-cyan-300/20",
            )}
            title={unlimited ? "No time limit" : "Time remaining"}
          >
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300/80">Time</div>
            <div className={cn("text-2xl font-black tabular-nums leading-none sm:text-3xl", low ? "text-red-200" : "text-white")}>
              {unlimited ? "∞" : fmtTime(hud.timeLeft)}
            </div>
          </div>

          {/* Right: score + action buttons */}
          <div className="flex min-w-0 flex-col items-end gap-1.5 justify-self-end">
            <div className="rounded-xl bg-black/40 px-2.5 py-1.5 text-right ring-1 ring-cyan-300/20 backdrop-blur-sm sm:px-3">
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300/80">Score</div>
              <div key={hud.scoreBump} className="anim-score-pop text-xl font-black tabular-nums leading-none text-amber-300 sm:text-2xl">
                {hud.displayScore.toLocaleString()}
              </div>
              {hud.streak > 1 && (
                <div className="mt-0.5 whitespace-nowrap text-[10px] font-extrabold tracking-wider text-emerald-300">
                  STREAK ×{hud.mult.toFixed(1).replace(/\.0$/, "")}
                </div>
              )}
            </div>
            <div className="pointer-events-auto flex gap-1.5">
              {/* Tug + horn already live in the touch pad; hide them on narrow
                  screens so the level card and timer keep their room. */}
              <div className="hidden gap-1.5 sm:flex">
                <button
                  type="button"
                  onClick={onToggleTugs}
                  className={cn(
                    BTN,
                    "text-base text-cyan-200 hover:text-cyan-100",
                    tugsAttached && "bg-cyan-500/25 ring-2 ring-cyan-300 shadow-[0_0_10px_rgba(56,225,255,0.4)] text-cyan-100",
                    hud.tugState === "standby" && hud.inRendezvousRange && "ring-2 ring-amber-400 bg-amber-400/20 text-amber-300 anim-blink",
                  )}
                  title={tugsAttached ? "Detach Tugs [T]" : "Attach Tugs [T]"}
                  aria-label="Tugs"
                  aria-pressed={tugsAttached}
                >
                  <span>⚓</span>
                </button>
                <button
                  type="button"
                  onClick={onHorn}
                  className={cn(BTN, "text-base text-amber-200 hover:text-amber-100")}
                  title="Ship Horn (H)"
                  aria-label="Ship horn"
                >
                  <span>📯</span>
                </button>
              </div>
              {/* Mute */}
              <button
                type="button"
                onClick={onMute}
                className={cn(BTN, "text-lg")}
                aria-label="Mute"
                aria-pressed={hud.muted}
                title={touch ? "Toggle sound" : "Toggle sound (M)"}
              >
                <span className={cn(hud.muted && "opacity-50")}>♪</span>
                {hud.muted && <span className="absolute left-1/2 top-1/2 h-0.5 w-6 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded bg-red-400" />}
              </button>
              {/* Pause */}
              <button type="button" onClick={onPause} className={cn(BTN, "gap-1")} aria-label="Pause">
                <span className="block h-4 w-1.5 rounded-sm bg-current" />
                <span className="block h-4 w-1.5 rounded-sm bg-current" />
              </button>
            </div>
          </div>
        </div>

        {/* Hull bar — flows directly under the top row */}
        <div>
          <div className="mb-0.5 flex items-center justify-between gap-2 text-[9px] font-bold uppercase tracking-[0.2em] text-cyan-300/70">
            <span className="truncate">Hull integrity</span>
            <div className="flex shrink-0 items-center gap-2">
              {curMag > 0.3 && (
                <span className="flex items-center gap-1 text-cyan-200/70">
                  Current
                  <span className="inline-block text-sm leading-none" style={{ transform: `rotate(${curAngle}deg)` }}>➜</span>
                  {(curMag * 0.55).toFixed(1)} kn
                </span>
              )}
              <span style={{ color: hullColor }}>{Math.round(hud.hull)}%</span>
            </div>
          </div>
          <div
            className="h-2 overflow-hidden rounded-full bg-black/45 ring-1 ring-cyan-300/20"
            role="progressbar"
            aria-label="Hull integrity"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(hud.hull)}
          >
            <div
              className="hull-bar h-full rounded-full"
              style={{ width: `${Math.max(0, Math.min(100, hud.hull))}%`, backgroundColor: hullColor, boxShadow: `0 0 10px ${hullColor}` }}
            />
          </div>
        </div>

        {/* Tutorial guided banner — flows under the hull bar */}
        {hud.tutorial && (
          <div className="pointer-events-auto mx-auto w-full max-w-[560px]">
            <div
              className={cn(
                "rounded-2xl px-3 py-2 ring-1 backdrop-blur-md shadow-2xl transition-all duration-300 sm:px-5 sm:py-3",
                hud.tutorial.completed
                  ? "bg-emerald-950/85 ring-emerald-400/60 shadow-[0_0_25px_rgba(62,242,160,0.3)]"
                  : "bg-black/75 ring-cyan-300/35",
              )}
            >
              <div className="mb-1.5 flex items-center justify-between gap-2 border-b border-white/10 pb-1.5">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="text-sm">🎓</span>
                  <span className="shrink-0 text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300 sm:text-xs">
                    Step {hud.tutorial.step}/{hud.tutorial.totalSteps}
                  </span>
                  <span className="truncate text-[10px] font-black uppercase tracking-[0.15em] text-cyan-100/90 sm:text-xs sm:tracking-[0.2em]">
                    {hud.tutorial.title}
                  </span>
                </div>
                <div className="shrink-0 whitespace-nowrap rounded-md bg-cyan-400/20 px-2 py-0.5 text-[10px] font-black tracking-wider text-amber-200 ring-1 ring-cyan-300/40">
                  {hud.tutorial.keyHint}
                </div>
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs sm:text-sm font-semibold text-white/95 leading-snug">
                  {hud.tutorial.instruction}
                </div>
                {hud.tutorial.completed && (
                  <div className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-400/20 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-300 ring-1 ring-emerald-300/50">
                    <span>✓</span>
                    <span>DONE</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Bottom chips — desktop only (hidden on mobile) ─── */}
      {!touch && (
        <div
          className="absolute left-1/2 flex -translate-x-1/2 flex-wrap justify-center items-center gap-1.5 sm:gap-2 px-2 max-w-[96vw]"
          style={{ bottom: "calc(18px + env(safe-area-inset-bottom))" }}
        >
          {hud.tugPenaltyWarning && (
            <div className="flex items-center gap-1.5 rounded-full bg-red-600/95 px-3 py-1 text-[10px] sm:text-xs font-black tracking-wider text-white ring-2 ring-red-300 shadow-[0_0_16px_rgba(255,93,93,0.8)] anim-blink">
              <span>⚠️</span>
              <span>DETACH TUGS [T] — OUTSIDE PILOT ZONE (−5 PTS)</span>
            </div>
          )}

          {hud.missionType === "departure" ? (
            <>
              <Chip ok={hud.speed > 0.8} label="PROPULSION" />
              <Chip ok={tugsAttached} label={tugsAttached ? "TUGS ATTACHED" : "TUGS DETACHED"} />
              {hud.departureExit && (
                <div className="flex items-center gap-1.5 rounded-full bg-emerald-400/20 px-3 py-1 text-[10px] sm:text-xs font-black tracking-wider text-emerald-200 ring-1 ring-emerald-300/60">
                  <span>{hud.departureExit.label}</span>
                </div>
              )}
            </>
          ) : (
            <>
              <Chip ok={hud.align.pos} label="POSITION" />
              <Chip ok={hud.align.angle} label="ANGLE" />
              <Chip ok={hud.align.speed} label="SPEED" />
              {hud.securing > 0.02 && hud.phase === "playing" && (
                <div className="ml-1 rounded-full bg-emerald-400/90 px-2.5 py-1 text-[10px] font-black tracking-wider text-emerald-950 sm:text-xs">
                  SECURING LINES {Math.round(hud.securing * 100)}%
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* On mobile: only the important penalty warning + status chips */}
      {touch && (
        <div className="touch-chips absolute left-1/2 flex -translate-x-1/2 flex-wrap justify-center items-center gap-1.5 px-2 max-w-[96vw]">
          {hud.tugPenaltyWarning && (
            <div className="flex items-center gap-1.5 rounded-full bg-red-600/95 px-3 py-1 text-[10px] font-black tracking-wider text-white ring-2 ring-red-300 shadow-[0_0_16px_rgba(255,93,93,0.8)] anim-blink">
              <span>⚠️</span>
              <span className="whitespace-nowrap">TUGS OUTSIDE PILOT ZONE −5 PTS</span>
            </div>
          )}
          {hud.departureExit && (
            <div className="flex items-center gap-1.5 rounded-full bg-emerald-400/20 px-3 py-1 text-[10px] font-black tracking-wider text-emerald-200 ring-1 ring-emerald-300/60">
              <span className="whitespace-nowrap">{hud.departureExit.label}</span>
            </div>
          )}
          {hud.securing > 0.02 && hud.phase === "playing" && hud.missionType !== "departure" && (
            <div className="whitespace-nowrap rounded-full bg-emerald-400/90 px-2.5 py-1 text-[10px] font-black tracking-wider text-emerald-950">
              SECURING {Math.round(hud.securing * 100)}%
            </div>
          )}
        </div>
      )}

      {/* ── Level intro banner ────────────────────────────────── */}
      {hud.introActive && !hud.tutorial && (
        <div key={hud.level} className="anim-banner absolute left-1/2 top-[34%] w-[min(92vw,640px)] -translate-x-1/2 text-center">
          <div className="inline-block rounded-2xl bg-black/55 px-5 py-3 ring-1 ring-cyan-300/30 backdrop-blur-md sm:px-8 sm:py-4">
            <div className="text-[11px] font-bold uppercase tracking-[0.35em] text-cyan-300">
              {hud.missionType === "departure" ? `Outbound Contract ${hud.level}` : `Contract ${hud.level}`}
            </div>
            <div className="title-gradient text-2xl font-black uppercase sm:text-4xl">{hud.levelName}</div>
            <div className="mt-1.5 text-xs font-medium text-cyan-50/90 sm:text-sm">{hud.introTip}</div>
          </div>
        </div>
      )}
    </div>
  );
}

function Chip({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] sm:text-xs font-bold tracking-wider transition-colors duration-150",
        ok ? "bg-emerald-400/25 text-emerald-200 ring-1 ring-emerald-300/60" : "bg-black/35 text-cyan-100/60 ring-1 ring-cyan-200/15",
      )}
    >
      <span className={cn("inline-block h-2 w-2 rounded-full", ok ? "bg-emerald-300 shadow-[0_0_8px_#3ef2a0]" : "bg-cyan-100/30")} />
      {label}
    </div>
  );
}
