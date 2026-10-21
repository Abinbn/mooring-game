import { useCallback, useEffect, useRef, useState } from "react";
import { Game, type Action, type Breakdown, type GameOverInfo, type HudData, type Phase } from "@/game/Game";
import { addScore, getLastName, loadScores, qualifies, setLastName, type ScoreEntry } from "@/game/highscores";
import { clearSavedRun, loadSavedRun, type SavedRunState } from "@/game/savedRun";
import Hud from "@/components/Hud";
import TouchControls from "@/components/TouchControls";
import { GameOverScreen, LevelClearScreen, PauseScreen, StartScreen } from "@/components/Screens";

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Game | null>(null);

  const [phase, setPhase] = useState<Phase>("menu");
  const [hud, setHud] = useState<HudData | null>(null);
  const [breakdown, setBreakdown] = useState<Breakdown | null>(null);
  const [gameOver, setGameOver] = useState<GameOverInfo | null>(null);
  const [scores, setScores] = useState<ScoreEntry[]>(() => loadScores());
  const [savedRun, setSavedRun] = useState<SavedRunState | null>(() => loadSavedRun());
  const [highlight, setHighlight] = useState(-1);
  const [pendingName, setPendingName] = useState(false);
  const [name, setName] = useState("");
  const [callsign, setCallsign] = useState(() => (typeof window !== "undefined" ? getLastName() : ""));
  const [loggedAs, setLoggedAs] = useState("");
  const [muted, setMuted] = useState(false);
  const [touch, setTouch] = useState(() => (typeof window !== "undefined" ? window.matchMedia("(pointer: coarse)").matches : false));
  const [fatal, setFatal] = useState<string | null>(null);

  // refs mirroring state for the global key handler
  const phaseRef = useRef<Phase>("menu");
  const pendingRef = useRef(false);
  const nameRef = useRef("");
  const gameOverRef = useRef<GameOverInfo | null>(null);
  phaseRef.current = phase;
  pendingRef.current = pendingName;
  nameRef.current = name;
  gameOverRef.current = gameOver;

  /** Write a finished run to the harbour log under a pilot name. */
  const logRun = useCallback((info: GameOverInfo, rawName: string) => {
    const pilot = (rawName.trim() || "CAPTAIN").toUpperCase().slice(0, 12);
    setLastName(pilot);
    setCallsign(pilot);
    const rank = addScore({ name: pilot, score: info.score, level: info.level, date: Date.now() });
    setHighlight(rank);
    setScores(loadScores());
    setLoggedAs(rank >= 0 ? pilot : "");
    setPendingName(false);
    pendingRef.current = false;
  }, []);

  const submitName = useCallback(() => {
    const info = gameOverRef.current;
    if (!pendingRef.current || !info) return;
    logRun(info, nameRef.current);
    gameRef.current?.audio.click();
  }, [logRun]);

  const restart = useCallback(() => {
    if (pendingRef.current) submitName();
    setLoggedAs("");
    gameRef.current?.restart();
  }, [submitName]);

  const toMenu = useCallback(() => {
    if (pendingRef.current) submitName();
    setLoggedAs("");
    gameRef.current?.toMenu();
  }, [submitName]);

  // Create the game engine
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let game: Game;
    try {
      game = new Game(canvas, {
        onPhase: (p, payload) => {
          setPhase(p);
          if (p === "levelClear" && payload) setBreakdown(payload as Breakdown);
          if (p === "gameover" && payload) {
            const info = payload as GameOverInfo;
            setGameOver(info);
            setLoggedAs("");
            const q = qualifies(info.score);
            const knownPilot = getLastName();
            if (q && knownPilot) {
              // This device already has a pilot: the run belongs to them, so it
              // is logged directly instead of stacking up duplicate entries.
              setHighlight(-1);
              logRun(info, knownPilot);
            } else {
              setPendingName(q);
              pendingRef.current = q;
              setHighlight(-1);
              setName("");
            }
            setScores(loadScores());
            setSavedRun(null);
          }
          if (p === "menu") {
            setScores(loadScores());
            setSavedRun(loadSavedRun());
          }
        },
        onHud: (h) => setHud(h),
      });
    } catch (err) {
      console.error("Could not start the renderer", err);
      setFatal("This browser could not start the 2D renderer. WebGL is not required, but canvas 2D must be enabled.");
      return;
    }

    gameRef.current = game;
    const dev = (import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV;
    if (dev) (window as unknown as { __dsa?: Game }).__dsa = game;
    setMuted(game.audio.muted);
    game.setTouchMode(touch);
    game.setReducedMotion(motionQuery.matches);

    const onMotionChange = () => game.setReducedMotion(motionQuery.matches);
    motionQuery.addEventListener("change", onMotionChange);

    const ro = new ResizeObserver(() => game.resize());
    if (wrapRef.current) ro.observe(wrapRef.current);
    const onResize = () => game.resize();
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);

    return () => {
      ro.disconnect();
      motionQuery.removeEventListener("change", onMotionChange);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
      game.destroy();
      gameRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Detect touch devices on first touch
  useEffect(() => {
    const onTouch = () => {
      setTouch(true);
      gameRef.current?.setTouchMode(true);
    };
    window.addEventListener("touchstart", onTouch, { once: true, passive: true });
    return () => window.removeEventListener("touchstart", onTouch);
  }, []);

  useEffect(() => {
    gameRef.current?.setTouchMode(touch);
  }, [touch]);

  // The HUD and the touch pad mount/unmount with the phase, so re-measure the
  // free play area once React has committed the new chrome.
  useEffect(() => {
    const id = requestAnimationFrame(() => gameRef.current?.refreshUiInsets());
    return () => cancelAnimationFrame(id);
  }, [phase, touch]);

  const onHorn = useCallback(() => gameRef.current?.soundHorn(), []);
  const onToggleTugs = useCallback(() => gameRef.current?.toggleTugs(), []);
  const onStartTutorial = useCallback(() => {
    gameRef.current?.startTutorial();
  }, []);
  const onPlay = useCallback(() => {
    clearSavedRun();
    setSavedRun(null);
    gameRef.current?.startRun();
  }, []);
  const onResumeRun = useCallback(() => {
    const s = loadSavedRun();
    if (s && gameRef.current) {
      gameRef.current.resumeSavedRun(s);
    } else {
      gameRef.current?.startRun();
    }
    setSavedRun(null);
  }, []);

  // Global menu keys
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) return;
      const g = gameRef.current;
      if (!g) return;
      const p = phaseRef.current;
      if (e.code === "KeyM") {
        setMuted(g.toggleMute());
        return;
      }
      // A run only ever starts from an explicit button press, so a stray
      // keypress can never drop the player straight into the harbour.
      if (p === "menu") return;

      if (e.code === "Escape") {
        if (p === "playing") g.pause();
        else if (p === "paused") g.resume();
        else if (p === "gameover") toMenu();
        return;
      }
      if (e.code === "Enter" || e.code === "Space") {
        if (p === "levelClear") {
          e.preventDefault();
          g.skipLevelClear();
        } else if (p === "gameover") {
          e.preventDefault();
          restart();
        }
      } else if (e.code === "KeyR") {
        if (p === "gameover" || p === "paused") restart();
      } else if (e.code === "KeyP") {
        if (p === "playing") g.pause();
        else if (p === "paused") g.resume();
      } else if (p === "levelClear" && !e.repeat) {
        g.skipLevelClear();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [restart, toMenu]);

  const onInput = useCallback((a: Action, d: boolean) => gameRef.current?.setInput(a, d), []);
  const onMute = useCallback(() => {
    const g = gameRef.current;
    if (g) setMuted(g.toggleMute());
  }, []);
  const onCallsignChange = useCallback((v: string) => {
    const clean = v.toUpperCase().slice(0, 12);
    setCallsign(clean);
    setLastName(clean);
  }, []);
  const onPause = useCallback(() => gameRef.current?.pause(), []);
  const onResume = useCallback(() => gameRef.current?.resume(), []);
  const onSkip = useCallback(() => gameRef.current?.skipLevelClear(), []);

  const showHud = hud && (phase === "playing" || phase === "paused" || phase === "levelClear");
  const showTouch = touch && phase === "playing";

  if (fatal) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-ink-900 p-6 font-display" style={{ height: "100dvh" }}>
        <div className="panel max-w-sm rounded-lg p-5 text-center">
          <div className="label text-danger">Renderer unavailable</div>
          <h1 className="mt-1 text-xl font-semibold text-paper">The harbour will not load</h1>
          <p className="mt-2 text-[13px] leading-snug text-paper-dim">{fatal}</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={wrapRef} className="relative h-screen w-full overflow-hidden bg-ink-900" style={{ height: "100dvh" }}>
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      {showHud && (
        <Hud
          hud={{ ...hud, muted }}
          touch={touch}
          onPause={onPause}
          onMute={onMute}
          onHorn={onHorn}
          onToggleTugs={onToggleTugs}
        />
      )}
      {showTouch && hud && (
        <TouchControls
          onInput={onInput}
          onToggleTugs={onToggleTugs}
          onHorn={onHorn}
          hud={hud}
        />
      )}

      {phase === "menu" && (
        <StartScreen
          onPlay={onPlay}
          onResume={onResumeRun}
          onStartTutorial={onStartTutorial}
          savedRun={savedRun}
          scores={scores}
          touch={touch}
          muted={muted}
          onMute={onMute}
          callsign={callsign}
          onCallsignChange={onCallsignChange}
        />
      )}
      {phase === "paused" && <PauseScreen onResume={onResume} onRestart={restart} onMenu={toMenu} touch={touch} />}
      {phase === "levelClear" && breakdown && <LevelClearScreen key={breakdown.levelIndex} data={breakdown} onContinue={onSkip} />}
      {phase === "gameover" && gameOver && (
        <GameOverScreen
          info={gameOver}
          scores={scores}
          highlight={highlight}
          pendingName={pendingName}
          pilot={loggedAs || undefined}
          name={name}
          onNameChange={setName}
          onSubmitName={submitName}
          onRestart={restart}
          onMenu={toMenu}
          touch={touch}
        />
      )}
    </div>
  );
}
