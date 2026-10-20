import type { HudData } from "@/game/Game";
import { fmtTime } from "@/game/math";
import { cn } from "@/utils/cn";

interface Props {
  hud: HudData;
  touch: boolean;
  onPause: () => void;
  onMute: () => void;
  onHorn: () => void;
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

export default function Hud({ hud, touch, onPause, onMute, onHorn }: Props) {
  const low = hud.timeLeft < 10 && !hud.introActive;
  const hullColor = hud.hull > 60 ? "#3ef2a0" : hud.hull > 30 ? "#ffb340" : "#ff5d5d";
  const curMag = Math.hypot(hud.current.x, hud.current.y);
  const curAngle = (Math.atan2(hud.current.y, hud.current.x) * 180) / Math.PI;
  const speedKn = (hud.speed * 0.55).toFixed(1);

  return (
    <div className="pointer-events-none absolute inset-0 select-none font-display" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      {/* Top bar */}
      <div className="absolute left-0 right-0 top-0 flex items-start justify-between gap-2 p-2 sm:p-3">
        <div className="min-w-0 rounded-xl bg-black/40 px-3 py-1.5 ring-1 ring-cyan-300/20 backdrop-blur-sm">
          <div className="truncate text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300/80">
            {hud.missionType === "tutorial" ? "Training Academy" : `Berth ${hud.berthNumber} · Lv ${hud.level}`}
          </div>
          <div className="truncate text-sm font-extrabold leading-tight text-white sm:text-base">{hud.levelName}</div>
          <div className="mt-0.5 flex items-center gap-2 text-[10px] font-bold tracking-wider text-amber-200/90 sm:text-xs">
            <span className="truncate">{hud.telegraph}</span>
            <span className="text-cyan-100/60">{speedKn} kn</span>
          </div>
          {hud.missionType !== "departure" && (
            <div className="mt-1 flex items-center gap-1.5 text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wider">
              {hud.tugState === "standby" ? (
                hud.inRendezvousRange ? (
                  <span className="flex items-center gap-1 text-amber-300 anim-blink">
                    <span>📯</span>
                    <span>Sound Horn [H] to Summon Tugs</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-cyan-200/50">
                    <span>⚓</span>
                    <span>Tugs on Standby (Approach Dock)</span>
                  </span>
                )
              ) : hud.tugState === "approaching" ? (
                <span className="flex items-center gap-1 text-amber-300">
                  <span className="animate-spin text-[10px]">⚙</span>
                  <span>Tugs Steaming Up...</span>
                </span>
              ) : (
                <span className="flex items-center gap-1 text-emerald-300/80">
                  <span>✓</span>
                  <span>Tugs Made Fast</span>
                </span>
              )}
            </div>
          )}
        </div>

        <div
          className={cn(
            "rounded-xl px-3 py-1.5 text-center ring-1 backdrop-blur-sm",
            low ? "bg-red-600/40 ring-red-300/60 anim-blink" : "bg-black/40 ring-cyan-300/20",
          )}
        >
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300/80">Time</div>
          <div className={cn("text-2xl font-black tabular-nums leading-none sm:text-3xl", low ? "text-red-200" : "text-white")}>
            {hud.timeLimit > 9000 ? "∞" : fmtTime(hud.timeLeft)}
          </div>
        </div>

        <div className="flex flex-col items-end gap-1.5">
          <div className="rounded-xl bg-black/40 px-3 py-1.5 text-right ring-1 ring-cyan-300/20 backdrop-blur-sm">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300/80">Score</div>
            <div key={hud.scoreBump} className="anim-score-pop text-xl font-black tabular-nums leading-none text-amber-300 sm:text-2xl">
              {hud.displayScore.toLocaleString()}
            </div>
            {hud.streak > 1 && (
              <div className="mt-0.5 text-[10px] font-extrabold tracking-wider text-emerald-300">PERFECT STREAK ×{hud.mult.toFixed(1).replace(/\.0$/, "")}</div>
            )}
          </div>
          <div className="pointer-events-auto flex gap-1.5">
            <button
              type="button"
              onClick={onHorn}
              className={cn(
                "btn-ghost relative flex h-9 w-9 items-center justify-center rounded-lg text-base font-black text-amber-200 hover:text-amber-100 cursor-pointer active:scale-95 transition-all",
                hud.tugState === "standby" && hud.inRendezvousRange && "ring-2 ring-amber-400 bg-amber-400/20 shadow-[0_0_12px_rgba(255,179,64,0.6)]",
              )}
              title="Ship Horn (H)"
              aria-label="Ship Horn"
            >
              <span>📯</span>
            </button>
            <button
              type="button"
              onClick={onMute}
              className="btn-ghost relative flex h-9 w-9 items-center justify-center rounded-lg text-lg font-black cursor-pointer"
              aria-label={hud.muted ? "Unmute" : "Mute"}
            >
              <span className={cn(hud.muted && "opacity-50")}>♪</span>
              {hud.muted && <span className="absolute left-1/2 top-1/2 h-0.5 w-6 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded bg-red-400" />}
            </button>
            <button type="button" onClick={onPause} className="btn-ghost flex h-9 w-9 items-center justify-center gap-1 rounded-lg cursor-pointer" aria-label="Pause">
              <span className="block h-4 w-1.5 rounded-sm bg-current" />
              <span className="block h-4 w-1.5 rounded-sm bg-current" />
            </button>
          </div>
        </div>
      </div>

      {/* Pilot Academy Tutorial Guided Banner */}
      {hud.tutorial && (
        <div className="pointer-events-auto absolute left-1/2 top-18 sm:top-20 z-30 w-[min(94vw,560px)] -translate-x-1/2">
          <div
            className={cn(
              "rounded-2xl px-4 py-2.5 sm:px-5 sm:py-3 ring-1 backdrop-blur-md shadow-2xl transition-all duration-300",
              hud.tutorial.completed
                ? "bg-emerald-950/85 ring-emerald-400/60 shadow-[0_0_25px_rgba(62,242,160,0.3)]"
                : "bg-black/75 ring-cyan-300/35",
            )}
          >
            <div className="mb-1.5 flex items-center justify-between gap-2 border-b border-white/10 pb-1.5">
              <div className="flex items-center gap-2">
                <span className="text-sm">🎓</span>
                <span className="text-[10px] sm:text-xs font-black uppercase tracking-[0.25em] text-cyan-300">
                  Step {hud.tutorial.step} of {hud.tutorial.totalSteps} · {hud.tutorial.title}
                </span>
              </div>
              <div className="rounded-md bg-cyan-400/20 px-2 py-0.5 text-[10px] font-black tracking-wider text-amber-200 ring-1 ring-cyan-300/40">
                {hud.tutorial.keyHint}
              </div>
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs sm:text-sm font-semibold text-white/95 leading-snug">
                {hud.tutorial.instruction}
              </div>
              {hud.tutorial.completed && (
                <div className="flex items-center gap-1 shrink-0 rounded-full bg-emerald-400/20 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-300 ring-1 ring-emerald-300/50">
                  <span>✓</span>
                  <span>DONE</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Hull bar */}
      <div className="absolute left-2 top-[108px] w-40 sm:left-3 sm:top-[116px] sm:w-52">
        <div className="mb-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300/80">
          <span>Hull</span>
          <span style={{ color: hullColor }}>{Math.round(hud.hull)}%</span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-black/45 ring-1 ring-cyan-300/20">
          <div className="hull-bar h-full rounded-full" style={{ width: `${Math.max(0, hud.hull)}%`, backgroundColor: hullColor, boxShadow: `0 0 10px ${hullColor}` }} />
        </div>
        {curMag > 0.3 && (
          <div className="mt-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-200/80">
            <span>Current</span>
            <span className="inline-block text-base leading-none text-cyan-200" style={{ transform: `rotate(${curAngle}deg)` }}>
              ➜
            </span>
            <span className="text-cyan-100/70">{(curMag * 0.55).toFixed(1)} kn</span>
          </div>
        )}
      </div>

      {/* Alignment / Mission chips */}
      <div
        className="absolute left-1/2 flex -translate-x-1/2 items-center gap-1.5 sm:gap-2"
        style={{ bottom: touch ? "calc(200px + env(safe-area-inset-bottom))" : "calc(18px + env(safe-area-inset-bottom))" }}
      >
        {hud.missionType === "departure" ? (
          <>
            <Chip ok={hud.speed > 1} label="PROPULSION" />
            <Chip ok={true} label="TUGS ATTACHED" />
            <Chip ok={false} label="⬅ STEER TO SEA" />
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

      {/* Level intro banner */}
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
