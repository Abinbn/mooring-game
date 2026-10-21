import { useEffect, useRef, useState } from "react";
import { LEVEL_CLEAR_HOLD, type Breakdown, type GameOverInfo } from "@/game/Game";
import type { SavedRunState } from "@/game/savedRun";
import type { ScoreEntry } from "@/game/highscores";
import { Icon } from "@/components/icons";
import { cn } from "@/utils/cn";

/* ───────────────────────── Shared ───────────────────────── */

export function Overlay({
  children,
  dark = true,
  className,
}: {
  children: React.ReactNode;
  dark?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "anim-fade absolute inset-0 flex flex-col items-center overflow-y-auto no-scrollbar font-display",
        dark ? "bg-[rgba(4,20,27,0.86)]" : "",
        className,
      )}
      style={{
        paddingTop: "max(14px, env(safe-area-inset-top))",
        paddingBottom: "max(14px, env(safe-area-inset-bottom))",
        touchAction: "pan-y",
      }}
    >
      {children}
    </div>
  );
}

function levelLabel(level: number) {
  return level === 0 ? "Academy" : `Lv ${level}`;
}

export function HighScoreTable({
  scores,
  highlight,
  compact = false,
}: {
  scores: ScoreEntry[];
  highlight?: number;
  compact?: boolean;
}) {
  if (scores.length === 0) {
    return <p className="px-1 py-3 text-[13px] text-paper-mute">No berths logged yet. The first entry is yours.</p>;
  }
  const list = compact ? scores.slice(0, 5) : scores;
  return (
    <ol className="w-full">
      {list.map((s, i) => (
        <li
          key={`${s.date}-${i}`}
          className={cn(
            "flex items-center gap-3 border-b border-paper/[0.06] px-1 py-1.5 text-[13px] last:border-b-0",
            i === highlight ? "bg-signal/10 text-paper" : "text-paper-dim",
          )}
        >
          <span className={cn("num w-5 text-right text-[11px] font-semibold", i === 0 ? "text-signal" : "text-paper-mute")}>
            {i + 1}
          </span>
          <span className="flex-1 truncate font-medium text-paper">{s.name}</span>
          <span className="label shrink-0 text-paper-mute">{levelLabel(s.level)}</span>
          <span className="num w-16 shrink-0 text-right font-semibold text-paper">{s.score.toLocaleString()}</span>
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
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!activeModal) return;
    closeRef.current?.focus();
  }, [activeModal]);

  // Escape closes; Enter/Space must not leak through to "start game" while a
  // dialog is open.
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
      {/* Options */}
      <div className="absolute right-2 top-2 z-30 sm:right-4 sm:top-3">
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className={cn(
              "btn-ghost flex h-9 items-center gap-2 rounded-md px-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] cursor-pointer",
              menuOpen && "border-paper/50 bg-paper/10",
            )}
            aria-label="Options"
            aria-expanded={menuOpen}
          >
            <Icon name="menu" className="h-4 w-4" />
            <span className="hidden sm:inline">Options</span>
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
              <div className="panel anim-pop absolute right-0 top-full z-40 mt-1.5 w-56 rounded-lg p-1">
                <button
                  type="button"
                  onClick={onMute}
                  className="flex w-full items-center justify-between rounded px-2.5 py-2 text-[12px] font-medium text-paper transition-colors hover:bg-paper/10 cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <Icon name={muted ? "volumeOff" : "volume"} className="h-4 w-4" />
                    Sound
                  </span>
                  <span className={cn("label", muted ? "text-danger" : "text-safe")}>{muted ? "Off" : "On"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    setActiveModal("privacy");
                  }}
                  className="flex w-full items-center gap-2 rounded px-2.5 py-2 text-[12px] font-medium text-paper transition-colors hover:bg-paper/10 cursor-pointer"
                >
                  <Icon name="shield" className="h-4 w-4" />
                  Privacy
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    setActiveModal("info");
                  }}
                  className="flex w-full items-center gap-2 rounded px-2.5 py-2 text-[12px] font-medium text-paper transition-colors hover:bg-paper/10 cursor-pointer"
                >
                  <Icon name="info" className="h-4 w-4" />
                  About
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-5 px-4 py-6">
        {/* Wordmark */}
        <div className="anim-pop text-center">
          <div className="label text-teal">Harbour pilotage</div>
          <h1 className="mt-1 text-4xl font-bold uppercase leading-[0.95] tracking-[0.02em] text-paper sm:text-6xl">
            Dead Slow
            <span className="block text-signal">Ahead</span>
          </h1>
          <p className="mt-2 text-[12px] text-paper-dim sm:text-[13px]">
            Bring a 200-metre cargo ship alongside with two tugs. No rush — that is the point.
          </p>
        </div>

        {/* Actions */}
        <div className="anim-pop flex w-full max-w-sm flex-col items-stretch gap-2" style={{ animationDelay: "0.06s" }}>
          {savedRun && onResume ? (
            <>
              <button
                type="button"
                onClick={onResume}
                className="btn-primary flex items-center justify-center gap-2 rounded-md px-6 py-3 text-base font-bold uppercase tracking-[0.06em] cursor-pointer"
              >
                Resume
                <span className="label opacity-70">({levelLabel(savedRun.levelIndex)})</span>
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setActiveModal("howto")}
                  className="btn-ghost flex-1 rounded-md px-4 py-2.5 text-[12px] font-semibold uppercase tracking-[0.06em] cursor-pointer"
                >
                  How to play
                </button>
                <button
                  type="button"
                  onClick={onPlay}
                  className="btn-ghost flex-1 rounded-md px-4 py-2.5 text-[12px] font-semibold uppercase tracking-[0.06em] cursor-pointer"
                  title="Start again from contract 1"
                >
                  New contract
                </button>
              </div>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onPlay}
                className="btn-primary flex items-center justify-center gap-2 rounded-md px-6 py-3 text-base font-bold uppercase tracking-[0.06em] cursor-pointer"
              >
                <Icon name="play" className="h-4 w-4" />
                Take the helm
              </button>
              <button
                type="button"
                onClick={() => setActiveModal("howto")}
                className="btn-ghost rounded-md px-4 py-2.5 text-[12px] font-semibold uppercase tracking-[0.06em] cursor-pointer"
              >
                How to play
              </button>
            </>
          )}
          <p className="mt-1 text-center text-[11px] text-paper-mute">
            {touch
              ? savedRun
                ? "Resume your contract, or start again from the first berth"
                : "Tap to start"
              : savedRun
                ? "Enter to resume · Esc for options"
                : "Enter or Space to start"}
          </p>
        </div>

        {/* Harbour log */}
        <div className="panel anim-pop w-full max-w-md rounded-lg p-3 sm:p-4" style={{ animationDelay: "0.12s" }}>
          <div className="mb-1.5 flex items-center justify-between border-b border-paper/10 pb-1.5">
            <span className="label text-paper-dim">Harbour log</span>
            <span className="label text-paper-mute">Top pilots</span>
          </div>
          <HighScoreTable scores={scores} compact />
          <p className="mt-2 border-t border-paper/[0.08] pt-2 text-center text-[11px] text-paper-mute">
            {touch ? "Pause from the top-right during a run" : "P / Esc pause · M mute · R restart"}
          </p>
        </div>
      </div>

      {/* Dialogs */}
      {activeModal && (
        <div
          className="anim-fade fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setActiveModal(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={activeModal === "howto" ? "How to play" : activeModal === "privacy" ? "Privacy" : "About"}
            className="panel anim-pop relative max-h-[88vh] w-full max-w-lg overflow-y-auto no-scrollbar rounded-lg p-4 text-paper shadow-2xl sm:p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              ref={closeRef}
              type="button"
              onClick={() => setActiveModal(null)}
              className="btn-ghost absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-md cursor-pointer"
              aria-label="Close"
            >
              <Icon name="close" className="h-4 w-4" />
            </button>

            {activeModal === "howto" && (
              <div>
                <div className="label text-teal">Operating notes</div>
                <h2 className="mt-0.5 text-2xl font-semibold uppercase tracking-[0.02em]">How to berth</h2>
                <ul className="mt-4 space-y-2.5 text-[13px] text-paper-dim">
                  <li className="flex items-start gap-3">
                    <span className="flex shrink-0 gap-1">{touch ? <Key wide><Icon name="chevronUp" className="h-3.5 w-3.5" /><Icon name="chevronDown" className="h-3.5 w-3.5" /></Key> : <><Key>W</Key><Key>S</Key></>}</span>
                    <span><b className="font-semibold text-paper">Engine</b> ahead and astern. A loaded ship carries her momentum for a long way — brake early.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex shrink-0 gap-1">{touch ? <Key wide>Bow</Key> : <><Key>Q</Key><Key>E</Key></>}</span>
                    <span><b className="font-semibold text-paper">Bow tug</b> pushes or pulls the bow sideways.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex shrink-0 gap-1">{touch ? <Key wide>Stern</Key> : <><Key>A</Key><Key>D</Key></>}</span>
                    <span><b className="font-semibold text-paper">Stern tug</b> swings the stern; without tugs the same keys work the rudder.</span>
                  </li>
                  <li className="flex items-start gap-3 border-t border-paper/10 pt-2.5">
                    <span className="flex shrink-0 gap-1">{touch ? <span className="kbd"><Icon name="anchor" className="h-4 w-4" /></span> : <Key>T</Key>}</span>
                    <span><b className="font-semibold text-paper">Attach / cast off tugs.</b> Summon them inside the pilot station; cast off for narrow gates and for leaving harbour.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex shrink-0 gap-1">{touch ? <span className="kbd"><Icon name="horn" className="h-4 w-4" /></span> : <Key>H</Key>}</span>
                    <span><b className="font-semibold text-paper">Ship horn.</b> No mechanical use. It does sound magnificent.</span>
                  </li>
                  <li className="flex items-start gap-3 border-t border-paper/10 pt-2.5">
                    <span className="kbd shrink-0"><Icon name="compass" className="h-4 w-4" /></span>
                    <span>Park inside the dashed outline, square to the quay, nearly stopped. Hold position until the lines are secured.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="kbd shrink-0"><Icon name="alert" className="h-4 w-4" /></span>
                    <span><b className="font-semibold text-paper">Pilot limit.</b> Tugs may not leave the pilot area. Dragging them past it fines you, then revokes the contract.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="kbd shrink-0"><Icon name="star" className="h-4 w-4" /></span>
                    <span>Hard knocks cost hull. Soft touches, quick work and clean alignment pay best.</span>
                  </li>
                </ul>
                <div className="mt-5">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveModal(null);
                      onStartTutorial?.();
                    }}
                    className="btn-ghost flex w-full items-center justify-center gap-2 rounded-md py-2.5 text-[12px] font-semibold uppercase tracking-[0.06em] cursor-pointer"
                  >
                    <Icon name="compass" className="h-4 w-4" />
                    Open pilot academy
                  </button>
                </div>
              </div>
            )}

            {activeModal === "privacy" && (
              <div>
                <div className="label text-teal">Transparency</div>
                <h2 className="mt-0.5 text-2xl font-semibold uppercase tracking-[0.02em]">Privacy</h2>
                <div className="mt-4 space-y-3 text-[13px] text-paper-dim">
                  <p>Dead Slow Ahead runs entirely in your browser. Scores, callsigns and settings are kept in your browser's local storage on this device.</p>
                  <p>There are no cookies, analytics, advertising identifiers or tracking scripts, and the game makes no network requests while it runs.</p>
                  <p>Clearing your browser's site data removes your harbour log and preferences.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="btn-ghost mt-5 w-full rounded-md py-2 text-[12px] font-semibold uppercase tracking-[0.06em] cursor-pointer"
                >
                  Close
                </button>
              </div>
            )}

            {activeModal === "info" && (
              <div>
                <div className="label text-teal">About</div>
                <h2 className="mt-0.5 text-2xl font-semibold uppercase tracking-[0.02em]">Dead Slow Ahead</h2>
                <div className="mt-4 space-y-3 text-[13px] text-paper-dim">
                  <p>
                    A berthing game about the least dramatic part of shipping: bringing a very large object to a stop in
                    exactly the right place, at about the speed of a walking person.
                  </p>
                  <div className="rounded border border-paper/10 p-2.5">
                    <div className="label mb-1.5 text-signal">Scoring</div>
                    <ul className="space-y-1 text-[12px]">
                      <li>Contract fee — paid for every completed job.</li>
                      <li>Time bonus — for working quickly.</li>
                      <li>Precision — for alignment and centring.</li>
                      <li>Gentle handling — for a clean hull.</li>
                      <li>Streak — consecutive perfect jobs multiply the fee.</li>
                    </ul>
                  </div>
                  <p>Physics, audio and visuals are generated at run time. No external assets, no network calls.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="btn-ghost mt-5 w-full rounded-md py-2 text-[12px] font-semibold uppercase tracking-[0.06em] cursor-pointer"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </Overlay>
  );
}

/* ───────────────────────── Pause ───────────────────────── */

export function PauseScreen({
  onResume,
  onRestart,
  onMenu,
  touch,
}: {
  onResume: () => void;
  onRestart: () => void;
  onMenu: () => void;
  touch: boolean;
}) {
  return (
    <Overlay>
      <div className="flex flex-1 flex-col items-center justify-center px-4">
        <div className="panel anim-pop w-full max-w-sm rounded-lg p-5">
          <div className="label text-teal">All stop</div>
          <h2 className="mt-0.5 text-3xl font-semibold uppercase tracking-[0.02em]">Paused</h2>
          <div className="mt-4 flex flex-col gap-2">
            <button type="button" onClick={onResume} className="btn-primary rounded-md px-5 py-2.5 text-sm font-bold uppercase tracking-[0.06em] cursor-pointer">
              Resume
            </button>
            <button type="button" onClick={onRestart} className="btn-ghost rounded-md px-5 py-2.5 text-[12px] font-semibold uppercase tracking-[0.06em] cursor-pointer">
              Restart run
            </button>
            <button type="button" onClick={onMenu} className="btn-ghost rounded-md px-5 py-2.5 text-[12px] font-semibold uppercase tracking-[0.06em] cursor-pointer">
              Harbour office
            </button>
          </div>
          {!touch && (
            <div className="mt-4 grid grid-cols-[auto_1fr] gap-3 border-t border-paper/10 pt-3 text-[11px] text-paper-dim">
              <div className="grid grid-cols-3 gap-1">
                <Key>Q</Key><Key>W</Key><Key>E</Key>
                <Key>A</Key><Key>S</Key><Key>D</Key>
              </div>
              <div className="flex flex-col justify-center gap-0.5">
                <div><b className="text-paper">W/S</b> engine · <b className="text-paper">Q/E</b> bow tug</div>
                <div><b className="text-paper">A/D</b> stern tug · <b className="text-paper">Arrow keys</b> both</div>
                <div className="text-paper-mute">Esc / P resumes</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Overlay>
  );
}

/* ───────────────────────── Level clear ───────────────────────── */

const CLEAR_HOLD_MS = LEVEL_CLEAR_HOLD * 1000;

function Row({ label, value, delay, accent }: { label: string; value: string; delay: number; accent?: string }) {
  return (
    <div className="anim-pop flex items-center justify-between border-b border-paper/[0.08] py-1.5 text-[13px]" style={{ animationDelay: `${delay}s` }}>
      <span className="text-paper-dim">{label}</span>
      <span className={cn("num font-semibold", accent ?? "text-paper")}>{value}</span>
    </div>
  );
}

export function LevelClearScreen({ data, onContinue }: { data: Breakdown; onContinue: () => void }) {
  const [progress, setProgress] = useState(0);
  const start = useRef(performance.now());
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const t = (performance.now() - start.current) / CLEAR_HOLD_MS;
      setProgress(Math.min(1, t));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const academy = data.levelIndex === 0;
  return (
    <Overlay dark={false} className="pointer-events-auto">
      <div className="flex w-full flex-1 items-center justify-center px-4 py-6 md:justify-start md:pl-[7vw]">
        <div className="panel anim-pop w-full max-w-sm rounded-lg p-4 sm:p-5">
          <div className="label text-safe">
            {academy ? "Academy completed" : data.departure ? "Fairway cleared" : "Lines secured"}
          </div>
          <div className="text-3xl font-semibold uppercase tracking-[0.02em] text-paper">
            {academy ? "Certified" : data.departure ? "At sea" : "Moored"}
          </div>
          <div className="mt-0.5 text-[11px] text-paper-mute">
            {academy ? "Pilot academy graduation" : data.departure ? `Outbound contract ${data.levelIndex}` : `Berth ${data.levelIndex}`}
            {" · "}
            {data.levelName}
          </div>

          <div className="mt-3">
            <Row label={data.departure ? "Departure fee" : "Berthing fee"} value={`+${data.base.toLocaleString()}`} delay={0.1} />
            <Row label="Time bonus" value={`+${data.timeBonus.toLocaleString()}`} delay={0.16} />
            <Row
              label={data.departure ? "Fairway course" : "Precision"}
              value={`+${data.precision.toLocaleString()}`}
              delay={0.22}
              accent={data.precision >= 600 ? "text-teal" : undefined}
            />
            <Row
              label={data.departure ? "Smooth departure" : "Gentle handling"}
              value={`+${data.gentle.toLocaleString()}`}
              delay={0.28}
              accent={data.gentle >= 500 ? "text-teal" : undefined}
            />
            {data.perfect > 0 && (
              <Row label={data.departure ? "Flawless departure" : "Perfect berthing"} value={`+${data.perfect}`} delay={0.34} accent="text-signal" />
            )}
            {data.mult > 1 && <Row label={`Streak ×${data.streak}`} value={`×${data.mult}`} delay={0.4} accent="text-signal" />}
            <div className="anim-pop mt-2 flex items-center justify-between pt-1" style={{ animationDelay: "0.46s" }}>
              <span className="label text-teal">Total</span>
              <span className="num text-2xl font-bold text-signal">+{data.total.toLocaleString()}</span>
            </div>
          </div>

          <div className="mt-3 h-0.5 w-full overflow-hidden rounded-full bg-paper/10">
            <div className="h-full bg-teal" style={{ width: `${progress * 100}%` }} />
          </div>
          <button
            type="button"
            onClick={onContinue}
            className="btn-ghost mt-2 w-full rounded-md py-2 text-[12px] font-semibold uppercase tracking-[0.06em] cursor-pointer"
          >
            Next contract
          </button>
        </div>
      </div>
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
  touch,
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
  touch: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!pendingName) return;
    const t = setTimeout(() => inputRef.current?.focus(), 120);
    return () => clearTimeout(t);
  }, [pendingName]);

  const wrecked = info.reason === "wrecked";
  const tugViolation = info.reason === "tug_open_sea";

  return (
    <Overlay>
      <div className="flex w-full flex-1 flex-col items-center justify-center px-4 py-2">
        <div className="panel anim-pop w-full max-w-md rounded-lg p-4 sm:p-5">
          <div className="label text-danger">
            {wrecked ? "Hull breached" : tugViolation ? "Pilotage contract revoked" : "Contract expired"}
          </div>
          <h2 className="text-2xl font-semibold uppercase tracking-[0.02em] text-paper sm:text-3xl">
            {wrecked ? "She is going down" : tugViolation ? "Tugs in open water" : "Out of time"}
          </h2>
          <p className="mt-1 text-[12px] leading-snug text-paper-dim">
            {wrecked
              ? "Too many hard knocks; the hull gave up before the quay did."
              : tugViolation
                ? "Harbour tugs are licensed for pilotage only. Dragging them past the pilot limit voided the contract."
                : "The pilot boat went home without you."}
          </p>

          <div className="mt-3 flex items-end justify-between border-y border-paper/10 py-2">
            <span className="label text-paper-mute">Final score</span>
            <span className="num text-3xl font-bold text-signal">{info.score.toLocaleString()}</span>
          </div>

          <div className="mt-3 grid grid-cols-4 gap-2 text-center">
            {[
              ["Level", info.level === 0 ? "—" : String(info.level)],
              ["Moored", String(info.moorings)],
              ["Perfect", String(info.perfects)],
              ["Knocks", String(info.bumps)],
            ].map(([label, value]) => (
              <div key={label} className="rounded border border-paper/10 py-1.5">
                <div className="num text-base font-semibold text-paper">{value}</div>
                <div className="label text-paper-mute">{label}</div>
              </div>
            ))}
          </div>

          {pendingName ? (
            <form
              className="mt-3 rounded border border-signal/40 bg-signal/10 p-2.5"
              onSubmit={(e) => {
                e.preventDefault();
                onSubmitName();
              }}
            >
              <div className="label text-signal">New harbour record</div>
              <div className="mt-1.5 flex gap-2">
                <input
                  ref={inputRef}
                  value={name}
                  onChange={(e) => onNameChange(e.target.value.toUpperCase().slice(0, 12))}
                  onKeyDown={(e) => e.stopPropagation()}
                  maxLength={12}
                  placeholder="CALLSIGN"
                  aria-label="Callsign for the harbour log"
                  className="min-w-0 flex-1 rounded border border-paper/20 bg-ink-900/70 px-2.5 py-1.5 text-[13px] font-semibold uppercase tracking-[0.08em] text-paper outline-none placeholder:text-paper-mute"
                  autoComplete="off"
                  autoCapitalize="characters"
                />
                <button type="submit" className="btn-primary rounded px-3 py-1.5 text-[12px] font-bold uppercase tracking-[0.06em] cursor-pointer">
                  Log it
                </button>
              </div>
            </form>
          ) : (
            <div className="mt-3 max-h-40 overflow-y-auto no-scrollbar">
              <HighScoreTable scores={scores} highlight={highlight} />
            </div>
          )}

          <div className="mt-3 flex gap-2">
            <button type="button" onClick={onRestart} className="btn-primary flex-1 rounded-md px-4 py-2.5 text-sm font-bold uppercase tracking-[0.06em] cursor-pointer">
              Restart{!touch && <span className="ml-1 font-medium opacity-60">R</span>}
            </button>
            <button type="button" onClick={onMenu} className="btn-ghost rounded-md px-4 py-2.5 text-[12px] font-semibold uppercase tracking-[0.06em] cursor-pointer">
              Harbour office
            </button>
          </div>
        </div>
      </div>
    </Overlay>
  );
}
