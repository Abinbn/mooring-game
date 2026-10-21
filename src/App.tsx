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
  const [muted, setMuted] = useState(false);
  const [touch, setTouch] = useState(() => (typeof window !== "undefined" ? window.matchMedia("(pointer: coarse)").matches : false));

  // refs mirroring state for the global key handler
  const phaseRef = useRef<Phase>("menu");
  const pendingRef = useRef(false);
  const nameRef = useRef("");
  const gameOverRef = useRef<GameOverInfo | null>(null);
  phaseRef.current = phase;
  pendingRef.current = pendingName;
  nameRef.current = name;
  gameOverRef.current = gameOver;

  const submitName = useCallback(() => {
    const info = gameOverRef.current;
    if (!pendingRef.current || !info) return;
    const n = (nameRef.current.trim() || "CAPTAIN").toUpperCase();
    setLastName(n);
    const rank = addScore({ name: n, score: info.score, level: info.level, date: Date.now() });
    setHighlight(rank);
    setScores(loadScores());
    setPendingName(false);
    pendingRef.current = false;
    gameRef.current?.audio.click();
  }, []);

  const restart = useCallback(() => {
    if (pendingRef.current) submitName();
    gameRef.current?.restart();
  }, [submitName]);

  const toMenu = useCallback(() => {
    if (pendingRef.current) submitName();
    gameRef.current?.toMenu();
  }, [submitName]);

  // Create the game engine
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const game = new Game(canvas, {
      onPhase: (p, payload) => {
        setPhase(p);
        if (p === "levelClear" && payload) setBreakdown(payload as Breakdown);
        if (p === "gameover" && payload) {
          const info = payload as GameOverInfo;
          setGameOver(info);
          const q = qualifies(info.score);
          setPendingName(q);
          pendingRef.current = q;
          setHighlight(-1);
          if (q) setName(getLastName() || "");
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
    gameRef.current = game;
    (window as unknown as { __dsa?: Game }).__dsa = game;
    setMuted(game.audio.muted);
    game.setTouchMode(touch);

    const ro = new ResizeObserver(() => game.resize());
    if (wrapRef.current) ro.observe(wrapRef.current);
    const onResize = () => game.resize();
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);

    return () => {
      ro.disconnect();
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
      if (e.code === "Enter" || e.code === "Space") {
        if (p === "menu") {
          e.preventDefault();
          const s = loadSavedRun();
          if (s) {
            onResumeRun();
          } else {
            onPlay();
          }
        } else if (p === "levelClear") {
          e.preventDefault();
          g.skipLevelClear();
        } else if (p === "gameover") {
          e.preventDefault();
          restart();
        }
      } else if (e.code === "KeyR") {
        if (p === "gameover" || p === "paused") restart();
      } else if (e.code === "Escape") {
        if (p === "gameover") toMenu();
      } else if (e.code === "KeyM") {
        setMuted(g.toggleMute());
      } else if (p === "levelClear" && !e.repeat) {
        g.skipLevelClear();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [restart, toMenu, onResumeRun, onPlay]);

  const onInput = useCallback((a: Action, d: boolean) => gameRef.current?.setInput(a, d), []);
  const onMute = useCallback(() => {
    const g = gameRef.current;
    if (g) setMuted(g.toggleMute());
  }, []);
  const onPause = useCallback(() => gameRef.current?.pause(), []);
  const onResume = useCallback(() => gameRef.current?.resume(), []);
  const onSkip = useCallback(() => gameRef.current?.skipLevelClear(), []);

  const showHud = hud && (phase === "playing" || phase === "paused" || phase === "levelClear");
  const showTouch = touch && phase === "playing";

  return (
    <div ref={wrapRef} className="relative h-screen w-full overflow-hidden bg-[#06202b]" style={{ height: "100dvh" }}>
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
