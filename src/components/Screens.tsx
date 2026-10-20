import { useEffect, useRef, useState } from "react";
import type { Breakdown, GameOverInfo } from "@/game/Game";
import type { ScoreEntry } from "@/game/highscores";
import { cn } from "@/utils/cn";

/* ───────────────────────── Shared bits ───────────────────────── */

export function Overlay({ children, dark = true, className }: { children: React.ReactNode; dark?: boolean; className?: string }) {
  return (
    <div
      className={cn(
        "anim-fade absolute inset-0 flex flex-col items-center overflow-y-auto no-scrollbar font-display",
        dark ? "bg-[radial-gradient(ellipse_at_center,rgba(6,32,43,0.55),rgba(3,14,20,0.92))]" : "",
        className,
      )}
      style={{
        paddingTop: "max(16px, env(safe-area-inset-top))",
        paddingBottom: "max(16px, env(safe-area-inset-bottom))",
        touchAction: "pan-y",
      }}
    >
      {children}
    </div>
  );
}

export function HighScoreTable({ scores, highlight, compact = false }: { scores: ScoreEntry[]; highlight?: number; compact?: boolean }) {
  if (scores.length === 0) {
    return <div className="py-3 text-center text-sm text-cyan-100/60">No berths logged yet. Be the first harbour pilot!</div>;
  }
  const list = compact ? scores.slice(0, 5) : scores;
  return (
    <ol className="w-full space-y-1">
      {list.map((s, i) => (
        <li
          key={`${s.date}-${i}`}
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm",
            i === highlight ? "bg-amber-400/20 ring-1 ring-amber-300/70 text-amber-100" : "bg-white/[0.04] text-cyan-50/90",
          )}
        >
          <span className={cn("w-6 text-right font-black tabular-nums", i === 0 ? "text-amber-300" : i < 3 ? "text-cyan-200" : "text-cyan-100/50")}>{i + 1}</span>
          <span className="flex-1 truncate font-bold tracking-wide">{s.name}</span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-200/60">Lv {s.level}</span>
          <span className="w-20 text-right font-black tabular-nums text-white">{s.score.toLocaleString()}</span>
        </li>
      ))}
    </ol>
  );
}

function Key({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return <span className={cn("kbd", wide && "min-w-[3.4rem]")}>{children}</span>;
}

/* ───────────────────────── Start ───────────────────────── */

export function StartScreen({
  onPlay,
  scores,
  touch,
  muted,
  onMute,
}: {
  onPlay: () => void;
  scores: ScoreEntry[];
  touch: boolean;
  muted: boolean;
  onMute: () => void;
}) {
  return (
    <Overlay>
      <div className="flex w-full max-w-5xl flex-1 flex-col items-center justify-center gap-5 px-4 py-4">
        <div className="anim-pop text-center">
          <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.5em] text-cyan-300/90 sm:text-xs">Harbour Pilot Simulator · Arcade</div>
          <h1 className="leading-[0.9]">
            <span className="title-gradient block text-5xl font-black uppercase tracking-tight sm:text-7xl md:text-8xl">Dead Slow</span>
            <span className="title-amber block text-5xl font-black uppercase tracking-tight sm:text-7xl md:text-8xl">Ahead</span>
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm text-cyan-50/85 sm:text-base">
            One giant cargo ship. Two little tugs. Bring her alongside the quay — gently.
          </p>
        </div>

        <div className="anim-pop flex flex-col items-center gap-3" style={{ animationDelay: "0.1s" }}>
          <button type="button" onClick={onPlay} className="btn-primary anim-pulse-glow rounded-2xl px-12 py-4 text-2xl font-black uppercase tracking-widest sm:px-16 sm:text-3xl">
            Play
          </button>
          <div className="text-xs text-cyan-100/60">{touch ? "Tap to start" : "Press Enter or Space"}</div>
        </div>

        <div className="grid w-full max-w-4xl grid-cols-1 gap-3 md:grid-cols-2">
          <div className="panel anim-pop rounded-2xl p-4" style={{ animationDelay: "0.18s" }}>
            <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.3em] text-cyan-300">How to berth</div>
            <ul className="space-y-2.5 text-sm text-cyan-50/90">
              <li className="flex items-center gap-3">
                <span className="flex gap-1">
                  {touch ? (
                    <Key wide>▲ ▼</Key>
                  ) : (
                    <>
                      <Key>W</Key>
                      <Key>S</Key>
                    </>
                  )}
                </span>
                <span>
                  <b className="text-amber-200">Engine</b> ahead / astern. She's 200 m of steel — brake early.
                </span>
              </li>
              <li className="flex items-center gap-3">
                <span className="flex gap-1">
                  {touch ? (
                    <Key wide>◀ ▶</Key>
                  ) : (
                    <>
                      <Key>Q</Key>
                      <Key>E</Key>
                    </>
                  )}
                </span>
                <span>
                  <b className="text-cyan-200">Bow tug</b> pushes or pulls the bow sideways.
                </span>
              </li>
              <li className="flex items-center gap-3">
                <span className="flex gap-1">
                  {touch ? (
                    <Key wide>◀ ▶</Key>
                  ) : (
                    <>
                      <Key>A</Key>
                      <Key>D</Key>
                    </>
                  )}
                </span>
                <span>
                  <b className="text-cyan-200">Stern tug</b> pushes or pulls the stern sideways.
                </span>
              </li>
              {!touch && (
                <li className="flex items-center gap-3">
                  <span className="flex gap-1">
                    <Key>←</Key>
                    <Key>→</Key>
                  </span>
                  <span>Both tugs together — slide her sideways.</span>
                </li>
              )}
              <li className="flex items-center gap-3 border-t border-cyan-300/15 pt-2.5">
                <span className="kbd text-cyan-300">◎</span>
                <span>
                  Park inside the <b className="text-cyan-200">dashed outline</b>, square to the quay, nearly stopped. Hold it to secure the lines.
                </span>
              </li>
              <li className="flex items-center gap-3">
                <span className="kbd text-red-300">✶</span>
                <span>
                  Hard knocks cost <b className="text-red-300">hull</b>. Soft touches, fast times and perfect alignment score big.
                </span>
              </li>
            </ul>
          </div>

          <div className="panel anim-pop flex flex-col rounded-2xl p-4" style={{ animationDelay: "0.26s" }}>
            <div className="mb-3 flex items-center justify-between">
              <div className="text-[11px] font-bold uppercase tracking-[0.3em] text-cyan-300">Harbour log · Top pilots</div>
              <button type="button" onClick={onMute} className="btn-ghost rounded-lg px-2.5 py-1 text-xs font-bold">
                {muted ? "♪ Sound off" : "♪ Sound on"}
              </button>
            </div>
            <HighScoreTable scores={scores} compact />
            <div className="mt-auto pt-3 text-center text-[11px] text-cyan-100/50">
              {touch ? "Press P on a keyboard or ⏸ to pause" : "P / Esc pauses · M mutes · R restarts after a run"}
            </div>
          </div>
        </div>
      </div>
    </Overlay>
  );
}

/* ───────────────────────── Pause ───────────────────────── */

export function PauseScreen({ onResume, onRestart, onMenu, touch }: { onResume: () => void; onRestart: () => void; onMenu: () => void; touch: boolean }) {
  return (
    <Overlay>
      <div className="flex flex-1 flex-col items-center justify-center px-4">
        <div className="panel anim-pop w-full max-w-sm rounded-3xl p-6 text-center">
          <div className="text-[11px] font-bold uppercase tracking-[0.4em] text-cyan-300">All stop</div>
          <h2 className="title-gradient mt-1 text-5xl font-black uppercase">Paused</h2>
          <div className="mt-5 flex flex-col gap-2.5">
            <button type="button" onClick={onResume} className="btn-primary rounded-xl px-6 py-3 text-lg font-black uppercase tracking-widest">
              Resume
            </button>
            <button type="button" onClick={onRestart} className="btn-ghost rounded-xl px-6 py-2.5 font-bold uppercase tracking-widest">
              Restart run
            </button>
            <button type="button" onClick={onMenu} className="btn-ghost rounded-xl px-6 py-2.5 font-bold uppercase tracking-widest">
              Main menu
            </button>
          </div>
          {!touch && (
            <div className="mt-5 grid grid-cols-3 gap-2 text-[11px] text-cyan-100/70">
              <div>
                <div className="mb-1 flex justify-center gap-1">
                  <Key>Q</Key>
                  <Key>W</Key>
                  <Key>E</Key>
                </div>
                <div className="flex justify-center gap-1">
                  <Key>A</Key>
                  <Key>S</Key>
                  <Key>D</Key>
                </div>
              </div>
              <div className="col-span-2 flex flex-col justify-center text-left">
                <div>
                  <b className="text-amber-200">W/S</b> engine · <b className="text-cyan-200">Q/E</b> bow tug
                </div>
                <div>
                  <b className="text-cyan-200">A/D</b> stern tug · <b className="text-cyan-200">←/→</b> both
                </div>
                <div className="mt-1 text-cyan-100/50">Esc / P to resume</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Overlay>
  );
}

/* ───────────────────────── Level clear ───────────────────────── */

function Row({ label, value, delay, accent }: { label: string; value: string; delay: number; accent?: string }) {
  return (
    <div className="anim-pop flex items-center justify-between border-b border-cyan-300/10 py-1.5 text-sm" style={{ animationDelay: `${delay}s` }}>
      <span className="text-cyan-100/80">{label}</span>
      <span className={cn("font-black tabular-nums", accent ?? "text-white")}>{value}</span>
    </div>
  );
}

export function LevelClearScreen({ data, onContinue }: { data: Breakdown; onContinue: () => void }) {
  const [progress, setProgress] = useState(0);
  const start = useRef(performance.now());
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const t = (performance.now() - start.current) / 3400;
      setProgress(Math.min(1, t));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <Overlay dark={false} className="pointer-events-auto" >
      <button type="button" onClick={onContinue} className="flex flex-1 w-full cursor-pointer flex-col items-center justify-center px-4 text-left md:items-start md:pl-[7vw]" aria-label="Continue">
        <div className="panel w-full max-w-sm rounded-3xl p-5 sm:p-6">
          <div className="text-center">
            <div className="text-[11px] font-bold uppercase tracking-[0.4em] text-emerald-300">Lines secured</div>
            <div className="anim-slam text-glow-mint text-5xl font-black uppercase text-emerald-300 sm:text-6xl">Moored!</div>
            <div className="mt-1 text-xs text-cyan-100/70">
              Berth {data.levelIndex} · {data.levelName}
            </div>
          </div>
          <div className="mt-4">
            <Row label="Berthing fee" value={`+${data.base.toLocaleString()}`} delay={0.25} />
            <Row label="Time bonus" value={`+${data.timeBonus.toLocaleString()}`} delay={0.4} />
            <Row label="Precision" value={`+${data.precision.toLocaleString()}`} delay={0.55} accent={data.precision >= 600 ? "text-cyan-200" : undefined} />
            <Row label="Gentle handling" value={`+${data.gentle.toLocaleString()}`} delay={0.7} accent={data.gentle >= 500 ? "text-cyan-200" : undefined} />
            {data.perfect > 0 && <Row label="★ PERFECT BERTHING" value={`+${data.perfect}`} delay={0.85} accent="text-amber-300" />}
            {data.mult > 1 && <Row label={`Streak ×${data.streak}`} value={`×${data.mult}`} delay={0.95} accent="text-amber-300" />}
            <div className="anim-pop mt-2 flex items-center justify-between pt-1" style={{ animationDelay: "1.05s" }}>
              <span className="text-xs font-bold uppercase tracking-[0.3em] text-cyan-300">Total</span>
              <span className="text-glow-amber text-3xl font-black tabular-nums text-amber-300">+{data.total.toLocaleString()}</span>
            </div>
          </div>
          <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-white/10">
            <div className="h-full bg-cyan-300" style={{ width: `${progress * 100}%` }} />
          </div>
          <div className="mt-2 text-center text-[11px] text-cyan-100/60">Next contract incoming · tap or press any key to skip</div>
        </div>
      </button>
    </Overlay>
  );
}

/* ───────────────────────── Game over ───────────────────────── */

export function GameOverScreen({
  info,
  scores,
  highlight,
  pendingName,
  name,
  onNameChange,
  onSubmitName,
  onRestart,
  onMenu,
}: {
  info: GameOverInfo;
  scores: ScoreEntry[];
  highlight: number;
  pendingName: boolean;
  name: string;
  onNameChange: (v: string) => void;
  onSubmitName: () => void;
  onRestart: () => void;
  onMenu: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (pendingName) {
      const t = setTimeout(() => inputRef.current?.focus(), 120);
      return () => clearTimeout(t);
    }
  }, [pendingName]);

  const wrecked = info.reason === "wrecked";
  return (
    <Overlay>
      <div className="flex w-full flex-1 flex-col items-center justify-center px-4 py-2">
        <div className="panel anim-pop w-full max-w-md rounded-3xl p-5 sm:p-6">
          <div className="text-center">
            <div className={cn("text-[11px] font-bold uppercase tracking-[0.4em]", wrecked ? "text-red-300" : "text-amber-300")}>
              {wrecked ? "Hull breached" : "Contract expired"}
            </div>
            <h2 className={cn("anim-slam text-4xl font-black uppercase leading-none sm:text-5xl", wrecked ? "text-red-300" : "text-amber-300")}>
              {wrecked ? "She's going down" : "Out of time"}
            </h2>
            <div className="mt-1 text-xs text-cyan-100/70">
              {wrecked ? "Too many hard knocks. The insurers would like a word." : "The pilot boat went home without you."}
            </div>
          </div>

          <div className="mt-4 text-center">
            <div className="text-[11px] font-bold uppercase tracking-[0.3em] text-cyan-300">Final score</div>
            <div className="text-glow-amber text-5xl font-black tabular-nums text-amber-300">{info.score.toLocaleString()}</div>
          </div>

          <div className="mt-3 grid grid-cols-4 gap-2 text-center">
            {[
              ["Level", info.level],
              ["Moored", info.moorings],
              ["Perfect", info.perfects],
              ["Knocks", info.bumps],
            ].map(([l, v]) => (
              <div key={l as string} className="rounded-lg bg-white/[0.05] px-1 py-1.5">
                <div className="text-lg font-black text-white">{v as number}</div>
                <div className="text-[9px] font-bold uppercase tracking-widest text-cyan-200/60">{l as string}</div>
              </div>
            ))}
          </div>

          {pendingName ? (
            <form
              className="mt-4 rounded-xl bg-amber-400/10 p-3 ring-1 ring-amber-300/40"
              onSubmit={(e) => {
                e.preventDefault();
                onSubmitName();
              }}
            >
              <div className="text-center text-xs font-black uppercase tracking-[0.3em] text-amber-300">★ New harbour record ★</div>
              <div className="mt-2 flex gap-2">
                <input
                  ref={inputRef}
                  value={name}
                  onChange={(e) => onNameChange(e.target.value.toUpperCase().slice(0, 12))}
                  onKeyDown={(e) => e.stopPropagation()}
                  maxLength={12}
                  placeholder="PILOT NAME"
                  className="min-w-0 flex-1 rounded-lg border border-cyan-300/30 bg-black/40 px-3 py-2 font-bold uppercase tracking-widest text-white outline-none focus:border-amber-300"
                  autoComplete="off"
                  autoCapitalize="characters"
                />
                <button type="submit" className="btn-primary rounded-lg px-4 py-2 text-sm font-black uppercase tracking-widest">
                  Log it
                </button>
              </div>
            </form>
          ) : (
            <div className="mt-4 max-h-44 overflow-y-auto no-scrollbar">
              <HighScoreTable scores={scores} highlight={highlight} />
            </div>
          )}

          <div className="mt-4 flex gap-2">
            <button type="button" onClick={onRestart} className="btn-primary flex-1 rounded-xl px-4 py-3 text-lg font-black uppercase tracking-widest">
              Restart <span className="text-sm opacity-70">(R)</span>
            </button>
            <button type="button" onClick={onMenu} className="btn-ghost rounded-xl px-4 py-3 font-bold uppercase tracking-widest">
              Menu
            </button>
          </div>
        </div>
      </div>
    </Overlay>
  );
}
