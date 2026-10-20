import { useEffect, useRef, useState } from "react";
import type { Breakdown, GameOverInfo } from "@/game/Game";
import type { SavedRunState } from "@/game/savedRun";
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

type StartModal = "howto" | "privacy" | "info" | null;

export function StartScreen({
  onPlay,
  onResume,
  onStartTutorial,
  savedRun,
  scores,
  touch,
  muted,
  onMute,
}: {
  onPlay: () => void;
  onResume?: () => void;
  onStartTutorial?: () => void;
  savedRun?: SavedRunState | null;
  scores: ScoreEntry[];
  touch: boolean;
  muted: boolean;
  onMute: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<StartModal>(null);

  // Close dropdown or modal with Escape, and prevent Space/Enter from starting game when modal is open
  useEffect(() => {
    if (!activeModal && !menuOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Escape") {
        e.stopPropagation();
        setActiveModal(null);
        setMenuOpen(false);
      } else if (activeModal && (e.code === "Enter" || e.code === "Space")) {
        e.stopPropagation();
      }
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [activeModal, menuOpen]);

  return (
    <Overlay>
      {/* Top right dropdown menu */}
      <div className="absolute right-3 top-3 z-30 sm:right-6 sm:top-5">
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className={cn(
              "flex h-10 items-center gap-2 rounded-xl border border-cyan-300/30 bg-black/45 px-3 py-2 text-cyan-100 shadow-lg backdrop-blur-md transition-all hover:border-cyan-300/60 hover:bg-cyan-500/20 active:scale-95 cursor-pointer",
              menuOpen && "border-cyan-300/80 bg-cyan-500/25 shadow-[0_0_18px_rgba(56,225,255,0.35)]",
            )}
            aria-label="Open menu"
            aria-expanded={menuOpen}
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="4" y1="6" x2="20" y2="6" />
              <line x1="4" y1="12" x2="20" y2="12" />
              <line x1="4" y1="18" x2="20" y2="18" />
            </svg>
            <span className="text-xs font-bold uppercase tracking-wider hidden sm:inline">Options</span>
            <span className={cn("text-[10px] transition-transform duration-200", menuOpen ? "rotate-180" : "")}>▾</span>
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
              <div className="panel anim-pop absolute right-0 top-full mt-2 w-60 rounded-2xl border border-cyan-300/35 p-1.5 shadow-[0_16px_40px_rgba(0,0,0,0.65)] backdrop-blur-xl z-40">
                {/* Sound Toggle */}
                <button
                  type="button"
                  onClick={() => {
                    onMute();
                  }}
                  className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-xs font-bold text-cyan-50 transition-colors hover:bg-cyan-500/20 cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-base">{muted ? "🔇" : "🔊"}</span>
                    <span>Sound Effects</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        "rounded-md px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider",
                        muted ? "bg-red-500/20 text-red-300 border border-red-400/30" : "bg-emerald-500/20 text-emerald-300 border border-emerald-400/30",
                      )}
                    >
                      {muted ? "Off" : "On"}
                    </span>
                    {!touch && <span className="text-[10px] text-cyan-200/50">M</span>}
                  </div>
                </button>

                {/* Privacy Policy */}
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    setActiveModal("privacy");
                  }}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-bold text-cyan-50 transition-colors hover:bg-cyan-500/20 cursor-pointer"
                >
                  <span className="text-base">🛡️</span>
                  <span>Privacy Policy</span>
                </button>

                {/* Info & About */}
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    setActiveModal("info");
                  }}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-bold text-cyan-50 transition-colors hover:bg-cyan-500/20 cursor-pointer"
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-cyan-400/20 text-xs font-black text-cyan-300 ring-1 ring-cyan-300/50">
                    i
                  </span>
                  <span>Info & About</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Main Home Screen Center Content */}
      <div className="flex w-full max-w-4xl flex-1 flex-col items-center justify-center gap-6 px-4 py-6">
        <div className="anim-pop text-center">
          <h1 className="leading-[0.9]">
            <span className="title-gradient block text-5xl font-black uppercase tracking-tight sm:text-7xl md:text-8xl">Dead Slow</span>
            <span className="title-amber block text-5xl font-black uppercase tracking-tight sm:text-7xl md:text-8xl">Ahead</span>
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm text-cyan-50/85 sm:text-base">
            One giant cargo ship. Two little tugs. Bring her alongside the quay — gently.
          </p>
        </div>

        {/* Buttons Row: "How to ?" to the left of "Play" / "Resume" */}
        <div className="anim-pop flex flex-col items-center gap-2.5" style={{ animationDelay: "0.1s" }}>
          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
            <button
              type="button"
              onClick={() => setActiveModal("howto")}
              className="btn-ghost flex items-center gap-2.5 rounded-2xl border-2 border-cyan-400/40 bg-cyan-950/45 px-6 py-3.5 text-lg font-black uppercase tracking-wider text-cyan-100 shadow-[0_4px_20px_rgba(56,225,255,0.12)] backdrop-blur-md transition-all hover:border-cyan-300 hover:bg-cyan-500/25 hover:text-white active:scale-95 cursor-pointer sm:px-8 sm:py-4 sm:text-2xl"
            >
              <span className="flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-full bg-cyan-400/20 text-xs sm:text-sm font-black text-cyan-300 ring-1 ring-cyan-300/60">
                ?
              </span>
              <span>How to ?</span>
            </button>

            {savedRun && onResume ? (
              <>
                <button
                  type="button"
                  onClick={onResume}
                  className="btn-primary anim-pulse-glow flex items-center gap-2 rounded-2xl px-8 py-3.5 text-2xl font-black uppercase tracking-widest cursor-pointer sm:px-12 sm:py-4 sm:text-3xl"
                >
                  <span>Resume</span>
                  <span className="text-base sm:text-lg font-bold opacity-85">(Lv {savedRun.levelIndex})</span>
                </button>
                <button
                  type="button"
                  onClick={onPlay}
                  className="btn-ghost rounded-2xl px-5 py-3.5 text-sm sm:text-base font-black uppercase tracking-wider text-cyan-200 hover:text-white border border-cyan-400/35 bg-cyan-950/30 hover:bg-cyan-500/20 cursor-pointer active:scale-95 transition-all"
                  title="Start fresh from Level 1"
                >
                  New Run
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={onPlay}
                className="btn-primary anim-pulse-glow rounded-2xl px-10 py-3.5 text-2xl font-black uppercase tracking-widest cursor-pointer sm:px-14 sm:py-4 sm:text-3xl"
              >
                Play
              </button>
            )}
          </div>
          <div className="text-xs font-semibold tracking-wide text-cyan-100/60">
            {touch
              ? savedRun
                ? "Tap Resume to continue or New Run"
                : "Tap Play to start"
              : savedRun
                ? "Press Enter or Space to resume"
                : "Press Enter or Space"}
          </div>
        </div>

        {/* Leaderboard below the buttons */}
        <div className="panel anim-pop flex w-full max-w-lg flex-col rounded-2xl p-4 sm:p-5" style={{ animationDelay: "0.18s" }}>
          <div className="mb-3 flex items-center justify-between border-b border-cyan-300/15 pb-2">
            <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.25em] text-cyan-300 sm:text-sm">
              <span className="text-amber-300 text-sm">⚓</span>
              <span>Harbour log · Top pilots</span>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-200/50">Local Records</span>
          </div>
          <HighScoreTable scores={scores} compact />
          <div className="mt-3 border-t border-cyan-300/10 pt-2 text-center text-[11px] text-cyan-100/50">
            {touch ? "Press ⏸ to pause during game" : "P / Esc pauses · M mutes · R restarts after a run"}
          </div>
        </div>
      </div>

      {/* Modals: How To, Privacy Policy, Info */}
      {activeModal && (
        <div
          className="anim-fade fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          onClick={() => setActiveModal(null)}
        >
          <div
            className="panel anim-pop relative max-h-[90vh] w-full max-w-lg overflow-y-auto no-scrollbar rounded-3xl border border-cyan-300/35 p-5 text-cyan-50 shadow-2xl sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setActiveModal(null)}
              className="btn-ghost absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-xl text-lg font-bold text-cyan-200 hover:text-white cursor-pointer"
              aria-label="Close modal"
            >
              ✕
            </button>

            {/* How to Berth Modal */}
            {activeModal === "howto" && (
              <div>
                <div className="mb-4 text-center">
                  <div className="text-[11px] font-bold uppercase tracking-[0.3em] text-cyan-300">Harbour Pilot Guide</div>
                  <h2 className="title-gradient mt-1 text-3xl font-black uppercase sm:text-4xl">How to Berth</h2>
                </div>
                <ul className="space-y-3 text-sm text-cyan-50/90">
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
                      <b className="text-cyan-200">Stern tug / Rudder</b>: swings stern sideways. Ship can also steer solo with rudder + engine wash!
                    </span>
                  </li>
                  <li className="flex items-center gap-3 border-t border-cyan-300/15 pt-2.5">
                    <span className="flex gap-1">
                      {touch ? <span className="kbd text-cyan-200">⚓</span> : <Key>T</Key>}
                    </span>
                    <span>
                      <b className="text-cyan-200">Attach / Detach Tugs [T]</b>: summon tugs in pilot station, or cast them off for narrow gates & solo handling.
                    </span>
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="flex gap-1">
                      {touch ? <span className="kbd text-amber-200">📯</span> : <Key>H</Key>}
                    </span>
                    <span>
                      <b className="text-amber-200">Ship foghorn</b>: blast for maritime acoustic salute & atmospheric echo!
                    </span>
                  </li>
                  <li className="flex items-center gap-3 border-t border-cyan-300/15 pt-2.5">
                    <span className="kbd text-cyan-300">◎</span>
                    <span>
                      Park inside the <b className="text-cyan-200">dashed outline</b>, square to the quay, nearly stopped. Hold position to secure braided mooring lines.
                    </span>
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="kbd text-emerald-300">⚓</span>
                    <span>
                      <b className="text-emerald-200">Pilot Boundary</b>: Harbour tugs cannot leave pilot limits (-5 pts/tick). Dragging tugs to open sea fails contract!
                    </span>
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="kbd text-red-300">✶</span>
                    <span>
                      Hard knocks cost <b className="text-red-300">hull</b>. Soft touches, fast times and perfect alignment score big.
                    </span>
                  </li>
                </ul>
                <div className="mt-6 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveModal(null);
                      onStartTutorial?.();
                    }}
                    className="btn-primary flex items-center justify-center gap-2 w-full rounded-xl py-3 text-base font-black uppercase tracking-wider cursor-pointer"
                  >
                    <span>🎓</span>
                    <span>Pilot Academy</span>
                  </button>
                </div>
              </div>
            )}

            {/* Privacy Policy Modal */}
            {activeModal === "privacy" && (
              <div>
                <div className="mb-4 text-center">
                  <div className="text-[11px] font-bold uppercase tracking-[0.3em] text-cyan-300">Transparency & Safety</div>
                  <h2 className="title-gradient mt-1 text-3xl font-black uppercase sm:text-4xl">Privacy Policy</h2>
                </div>
                <div className="space-y-3.5 text-xs sm:text-sm text-cyan-100/85">
                  <div className="rounded-xl bg-white/[0.04] p-3 border border-cyan-300/10">
                    <div className="font-extrabold text-cyan-200 uppercase tracking-wider text-xs mb-1">Local Storage Only</div>
                    <p>Dead Slow Ahead runs entirely in your browser. All gameplay scores, pilot callsigns, and audio settings are kept solely in your browser's local storage.</p>
                  </div>
                  <div className="rounded-xl bg-white/[0.04] p-3 border border-cyan-300/10">
                    <div className="font-extrabold text-cyan-200 uppercase tracking-wider text-xs mb-1">Zero Telemetry & Tracking</div>
                    <p>No cookies, advertising identifiers, or analytics tracking scripts are embedded. No external servers receive your personal data.</p>
                  </div>
                  <div className="rounded-xl bg-white/[0.04] p-3 border border-cyan-300/10">
                    <div className="font-extrabold text-cyan-200 uppercase tracking-wider text-xs mb-1">Data Ownership</div>
                    <p>You can reset your harbour records and preferences at any time by clearing your browser cache and site data.</p>
                  </div>
                </div>
                <div className="mt-6 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setActiveModal(null)}
                    className="btn-ghost w-full rounded-xl py-2.5 text-sm font-bold uppercase tracking-wider cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}

            {/* Info & About Modal */}
            {activeModal === "info" && (
              <div>
                <div className="mb-4 text-center">
                  <div className="text-[11px] font-bold uppercase tracking-[0.3em] text-cyan-300">Harbour Simulator</div>
                  <h2 className="title-gradient mt-1 text-3xl font-black uppercase sm:text-4xl">About Dead Slow</h2>
                </div>
                <div className="space-y-3 text-xs sm:text-sm text-cyan-100/85">
                  <p>
                    <b className="text-white">Dead Slow Ahead</b> is a precision maritime simulator recreating the physics of heavy cargo vessels and tugboat berthing operations.
                  </p>
                  <div className="rounded-xl bg-white/[0.04] p-3 border border-cyan-300/10 space-y-1.5">
                    <div className="font-extrabold text-amber-300 uppercase tracking-wider text-xs">Scoring System</div>
                    <div className="text-xs space-y-1">
                      <div>• <b className="text-cyan-200">Base Fee:</b> Fixed contract payment per completed berth.</div>
                      <div>• <b className="text-cyan-200">Time Bonus:</b> Bonus awarded for swift berthing manoeuvres.</div>
                      <div>• <b className="text-cyan-200">Precision:</b> Score for parallel alignment and dock centering.</div>
                      <div>• <b className="text-cyan-200">Gentle Handling:</b> Preservation bonus for zero hull impacts.</div>
                      <div>• <b className="text-cyan-200">Streak Multiplier:</b> Consecutive perfect berths multiply your earnings.</div>
                    </div>
                  </div>
                  <p className="text-xs text-cyan-200/70 italic">
                    Tip: Massive container ships carry massive momentum. Counter-steer with your tugs well before reaching the quay wall!
                  </p>
                </div>
                <div className="mt-6 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setActiveModal(null)}
                    className="btn-ghost w-full rounded-xl py-2.5 text-sm font-bold uppercase tracking-wider cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
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
            <div className="text-[11px] font-bold uppercase tracking-[0.4em] text-emerald-300">
              {data.levelIndex === 0 ? "Academy Completed" : data.departure ? "Fairway Cleared" : "Lines secured"}
            </div>
            <div className="anim-slam text-glow-mint text-5xl font-black uppercase text-emerald-300 sm:text-6xl">
              {data.levelIndex === 0 ? "Certified!" : data.departure ? "At Sea!" : "Moored!"}
            </div>
            <div className="mt-1 text-xs text-cyan-100/70">
              {data.levelIndex === 0 ? "Pilot Academy Graduation" : data.departure ? `Outbound Run ${data.levelIndex}` : `Berth ${data.levelIndex}`} · {data.levelName}
            </div>
          </div>
          <div className="mt-4">
            <Row label={data.departure ? "Departure fee" : "Berthing fee"} value={`+${data.base.toLocaleString()}`} delay={0.25} />
            <Row label="Time bonus" value={`+${data.timeBonus.toLocaleString()}`} delay={0.4} />
            <Row label={data.departure ? "Fairway course" : "Precision"} value={`+${data.precision.toLocaleString()}`} delay={0.55} accent={data.precision >= 600 ? "text-cyan-200" : undefined} />
            <Row label={data.departure ? "Smooth departure" : "Gentle handling"} value={`+${data.gentle.toLocaleString()}`} delay={0.7} accent={data.gentle >= 500 ? "text-cyan-200" : undefined} />
            {data.perfect > 0 && <Row label={data.departure ? "★ FLAWLESS DEPARTURE" : "★ PERFECT BERTHING"} value={`+${data.perfect}`} delay={0.85} accent="text-amber-300" />}
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
  const tugViolation = info.reason === "tug_open_sea";
  return (
    <Overlay>
      <div className="flex w-full flex-1 flex-col items-center justify-center px-4 py-2">
        <div className="panel anim-pop w-full max-w-md rounded-3xl p-5 sm:p-6">
          <div className="text-center">
            <div
              className={cn(
                "text-[11px] font-bold uppercase tracking-[0.4em]",
                wrecked || tugViolation ? "text-red-300" : "text-amber-300",
              )}
            >
              {wrecked ? "Hull breached" : tugViolation ? "Pilot Area Violation" : "Contract expired"}
            </div>
            <h2
              className={cn(
                "anim-slam text-4xl font-black uppercase leading-none sm:text-5xl",
                wrecked || tugViolation ? "text-red-300" : "text-amber-300",
              )}
            >
              {wrecked ? "She's going down" : tugViolation ? "Tugs in Open Sea" : "Out of time"}
            </h2>
            <div className="mt-1 text-xs text-cyan-100/70">
              {wrecked
                ? "Too many hard knocks. The insurers would like a word."
                : tugViolation
                ? "Harbour tugs are restricted to harbour pilotage! Dragging attached tugs to open sea revoked your licence."
                : "The pilot boat went home without you."}
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
