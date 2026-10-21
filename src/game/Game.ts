import { AudioSys } from "./audio";
import {
  C_ANG,
  C_LAT,
  C_LONG,
  DMG_FACTOR_HARD,
  DMG_FACTOR_QUAY,
  DMG_THRESHOLD_HARD,
  DMG_THRESHOLD_QUAY,
  ENGINE_AHEAD,
  ENGINE_ASTERN,
  ENGINE_RAMP,
  FIXED_DT,
  FRICTION,
  HULL_REPAIR_PER_LEVEL,
  INERTIA,
  K_ANG,
  K_LAT,
  K_LONG,
  MOOR_DIST_MAX,
  MOOR_DIST_MIN,
  MOOR_MAX_ANGVEL,
  MOOR_MAX_SPEED,
  QUAY_X,
  RESTITUTION_QUAY,
  RESTITUTION_ROCK,
  SECURE_TIME,
  SHIP_L,
  SHIP_W,
  TUG_ANCHOR,
  TUG_BREACH_GRACE,
  TUG_FORCE,
  TUG_L,
  TUG_RAMP,
  TUG_W,
} from "./constants";
import {
  makeLevel,
  type BuoyDef,
  type DepartureExit,
  type LevelDef,
  type MissionType,
  type ShipVisual,
} from "./levels";
import {
  angleDiff,
  circleVsPolygon,
  clamp,
  clamp01,
  cross,
  damp,
  dampAngle,
  hullPoly,
  satPolygons,
  transformPoly,
  type Contact,
  type Vec,
} from "./math";
import { ParticleSystem } from "./particles";
import {
  PALETTES,
  drawBerthZone,
  drawBuoy,
  drawCraneOverhead,
  drawCurrentLines,
  drawDepartureFairway,
  drawGhost,
  drawMooringLines,
  drawPilotBoundary,
  drawQuayBase,
  drawRendezvousZone,
  drawRocks,
  drawShip,
  drawTug,
  drawWater,
  type WorldView,
} from "./render";
import { clearSavedRun, saveActiveRun, type SavedRunState } from "./savedRun";

export type { SavedRunState } from "./savedRun";
export type { MissionType } from "./levels";
export type Phase = "menu" | "playing" | "paused" | "levelClear" | "gameover";
export type Action = "ahead" | "astern" | "bowLeft" | "bowRight" | "sternLeft" | "sternRight";
export type TugAttachmentState = "standby" | "approaching" | "attached";

/** Score screens linger this long before the next contract starts. */
export const LEVEL_CLEAR_HOLD = 6;
/** Level time limits above this mean "no clock". */
const UNLIMITED_TIME = 9000;

export interface TutorialInfo {
  step: number;
  totalSteps: number;
  title: string;
  instruction: string;
  keyHint: string;
  completed: boolean;
}

export interface Breakdown {
  levelIndex: number;
  levelName: string;
  base: number;
  timeBonus: number;
  precision: number;
  gentle: number;
  perfect: number;
  streak: number;
  mult: number;
  total: number;
  departure?: boolean;
}

export interface GameOverInfo {
  score: number;
  level: number;
  reason: "wrecked" | "timeout" | "tug_open_sea";
  moorings: number;
  bumps: number;
  perfects: number;
  bestStreak: number;
}

export interface HudData {
  phase: Phase;
  level: number;
  levelName: string;
  berthNumber: string;
  missionType: MissionType;
  tugState: TugAttachmentState;
  inRendezvousRange: boolean;
  score: number;
  displayScore: number;
  scoreBump: number;
  timeLeft: number;
  timeLimit: number;
  hull: number;
  streak: number;
  mult: number;
  align: { pos: boolean; angle: boolean; speed: boolean; all: boolean };
  securing: number;
  introActive: boolean;
  introTitle: string;
  introTip: string;
  current: Vec;
  telegraph: string;
  speed: number;
  muted: boolean;
  tutorial?: TutorialInfo;
  rudder: number;
  tugPenaltyWarning: boolean;
  /** Seconds left before the pilotage contract is revoked, or null. */
  tugBreachIn: number | null;
  /** True for missions without a clock (the academy). */
  unlimitedTime: boolean;
  departureExit?: DepartureExit;
}

export interface GameCallbacks {
  onPhase: (phase: Phase, payload?: Breakdown | GameOverInfo) => void;
  onHud: (hud: HudData) => void;
}

interface Tug {
  anchorX: number;
  side: 1 | -1;
  pendingSide: 1 | -1;
  cmd: number;
  effort: number;
  localPos: Vec;
  localAngle: number;
  phase: number;
  waypoint: Vec | null;
  emitAcc: number;
  worldPos: Vec;
  worldAngle: number;
  standbyPos: Vec;
}

interface Buoy {
  def: BuoyDef;
  pos: Vec;
  vel: Vec;
  phase: number;
  r: number;
}

interface FloatText {
  x: number;
  y: number;
  text: string;
  color: string;
  size: number;
  t: number;
  life: number;
}

const KEYMAP: Record<string, Action[]> = {
  KeyW: ["ahead"],
  ArrowUp: ["ahead"],
  KeyS: ["astern"],
  ArrowDown: ["astern"],
  KeyQ: ["bowLeft"],
  KeyE: ["bowRight"],
  KeyA: ["sternLeft"],
  KeyD: ["sternRight"],
  ArrowLeft: ["bowLeft", "sternLeft"],
  ArrowRight: ["bowRight", "sternRight"],
};

const ACTIONS: Action[] = ["ahead", "astern", "bowLeft", "bowRight", "sternLeft", "sternRight"];
const HULL = hullPoly(SHIP_L, SHIP_W);
const UP = -Math.PI / 2;

export class Game {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private cb: GameCallbacks;
  private dpr = 1;
  private w = 1;
  private h = 1;
  private rafId = 0;
  private last = 0;
  private acc = 0;
  private time = 0;
  private hudTimer = 0;

  phase: Phase = "menu";
  audio = new AudioSys();
  touchMode = false;

  private level!: LevelDef;
  private levelIndex = 1;
  private runSeed = 1;

  // Ship state
  private pos: Vec = { x: 0, y: 0 };
  private vel: Vec = { x: 0, y: 0 };
  private heading = UP;
  private angVel = 0;
  private throttle = 0;
  private throttleTarget = 0;
  private rudder = 0;
  private rudderTarget = 0;
  private tugs: Tug[] = [];
  private buoys: Buoy[] = [];
  private shipVis: ShipVisual;

  // Run state
  private hull = 100;
  private score = 0;
  private displayScore = 0;
  private scoreBump = 0;
  private timeLeft = 60;
  private introTimer = 0;
  private secure = 0;
  private secureTick = 0;
  private levelClearTimer = 0;
  private wrecked = false;
  private wreckTimer = 0;
  private lastBeep = -1;
  private stats = { moorings: 0, bumps: 0, perfects: 0, streak: 0, bestStreak: 0 };
  private levelMaxImpact = 0;
  private levelDamage = 0;
  private softTouchGiven = false;
  private align = { pos: false, angle: false, speed: false, all: false };
  private scrapeLevel = 0;
  private wakeAcc = 0;
  private engineAcc = 0;

  // Tugboat attachment state
  private tugState: TugAttachmentState = "standby";
  private tugAttachTimer = 0;
  private tugPenaltyTimer = 0;
  private tugBreachTimer = 0;

  // Tutorial state
  private tutorialStep = 0;
  private tutorialStepTimer = 0;
  private tutorialStepCompleted = false;

  // Departure & Mooring lines state
  private departureCleared = false;
  private mooringLinesAttached = false;

  // UI-aware camera framing (measured from the DOM)
  private uiTop = 12;
  private uiBottom = 12;
  private lastMeasure = 0;

  // Deferred audio/FX callbacks, cleared on destroy
  private timers: number[] = [];
  private reducedMotion = false;

  // Camera / juice
  private cam = { x: 0, y: 0, zoom: 1.5 };
  private trauma = 0;
  private hitStop = 0;
  private flash = 0;
  private flashColor = "255,255,255";
  private particles = new ParticleSystem();
  private texts: FloatText[] = [];

  // Input
  private keys = new Set<string>();
  private input: Record<Action, boolean> = {
    ahead: false,
    astern: false,
    bowLeft: false,
    bowRight: false,
    sternLeft: false,
    sternRight: false,
  };

  constructor(canvas: HTMLCanvasElement, cb: GameCallbacks) {
    this.canvas = canvas;
    this.cb = cb;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("Canvas 2D not supported");
    this.ctx = ctx;
    this.shipVis = {
      pos: this.pos,
      heading: UP,
      L: SHIP_L,
      W: SHIP_W,
      hull: "#d64a3a",
      hullDark: "#7d1f16",
      deck: "#e8614f",
      containers: 1,
      seed: 4242,
    };
    this.runSeed = Math.floor(Math.random() * 1e9);
    this.resize();
    this.measureUi();
    this.loadLevel(1, true);
    this.snapCamera();
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
    document.addEventListener("visibilitychange", this.onVisibility);
    this.last = performance.now();
    this.rafId = requestAnimationFrame(this.loop);
  }

  destroy() {
    cancelAnimationFrame(this.rafId);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.clearTimers();
    this.audio.dispose();
  }

  // ───────────────────────── Public API ─────────────────────────

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.w = Math.max(1, rect.width);
    this.h = Math.max(1, rect.height);
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    this.measureUi();
  }

  setTouchMode(on: boolean) {
    this.touchMode = on;
    this.measureUi();
  }

  /** Re-measure the HUD/pad chrome (called when the React layer mounts/unmounts UI). */
  refreshUiInsets() {
    this.measureUi();
  }

  setReducedMotion(on: boolean) {
    this.reducedMotion = on;
    if (on) {
      this.trauma = 0;
      this.flash = 0;
      this.hitStop = 0;
    }
  }

  /**
   * The camera frames the ship inside the part of the screen the HUD and the
   * touch pad are not covering. The React layer tags those elements, so we
   * measure them instead of guessing pixel offsets.
   */
  private measureUi() {
    if (typeof document === "undefined") return;
    const top = document.querySelector<HTMLElement>("[data-ui-top]");
    const pad = document.querySelector<HTMLElement>("[data-ui-pad]");
    const t = top ? top.getBoundingClientRect().bottom : 12;
    const b = pad ? Math.max(0, window.innerHeight - pad.getBoundingClientRect().top) : 12;
    // Never let chrome eat more than half the viewport (tiny landscape screens).
    this.uiTop = Math.round(Math.min(Math.max(0, t), this.h * 0.42));
    this.uiBottom = Math.round(Math.min(Math.max(0, b), this.h * 0.5));
  }

  private snapCamera() {
    const t = this.cameraTarget();
    this.cam.x = t.x;
    this.cam.y = t.y;
    this.cam.zoom = t.zoom;
  }

  private later(fn: () => void, ms: number) {
    const id = window.setTimeout(() => {
      this.timers = this.timers.filter((t) => t !== id);
      fn();
    }, ms);
    this.timers.push(id);
  }

  private clearTimers() {
    for (const id of this.timers) window.clearTimeout(id);
    this.timers.length = 0;
  }

  isInRendezvousRange(): boolean {
    const rz = this.level?.rendezvous;
    if (!rz) return true;
    const dx = this.pos.x - rz.x;
    const dy = this.pos.y - rz.y;
    return dx * dx + dy * dy <= rz.radius * rz.radius;
  }

  isInPilotArea(): boolean {
    const pb = this.level?.pilotBoundary;
    if (!pb) return true;
    return (
      this.pos.x >= pb.minX &&
      this.pos.x <= pb.maxX &&
      this.pos.y >= pb.minY &&
      this.pos.y <= pb.maxY
    );
  }

  toggleTugs() {
    if (this.phase !== "playing") return;
    this.audio.ensure();

    if (this.tugState === "attached") {
      this.tugState = "standby";
      for (const t of this.tugs) {
        t.effort = 0;
        t.cmd = 0;
      }
      this.audio.splash();
      this.audio.tugToot(35);
      this.particles.burst(this.tugs[0].worldPos.x, this.tugs[0].worldPos.y, "foam", 12, 22);
      this.particles.burst(this.tugs[1].worldPos.x, this.tugs[1].worldPos.y, "foam", 12, 22);
      this.addText(this.pos.x, this.pos.y - SHIP_W - 22, "TUGS DETACHED / STANDBY", "#6fb9c9", 20);
    } else if (this.tugState === "standby") {
      if (
        this.isInPilotArea() &&
        (this.isInRendezvousRange() || this.level.missionType === "departure" || this.level.missionType === "tutorial")
      ) {
        this.tugState = "approaching";
        this.tugAttachTimer = 1.4;
        this.audio.tugToot(0);
        this.addText(this.pos.x, this.pos.y - SHIP_W - 22, "TUGS STEAMING TO ATTACH", "#57b98a", 20);
        this.later(() => {
          if (this.phase === "playing") this.audio.tugToot(40);
        }, 360);
      } else {
        this.audio.bump();
        this.addText(this.pos.x, this.pos.y - SHIP_W - 22, "OUTSIDE PILOT ZONE — CANNOT ATTACH", "#d9564a", 18);
      }
    }
  }

  soundHorn() {
    if (this.phase !== "playing") return;
    this.audio.ensure();
    this.audio.shipHorn();

    // Funnel world coordinates
    const localFunnelX = -SHIP_L * 0.44 + 4;
    const cosH = Math.cos(this.heading);
    const sinH = Math.sin(this.heading);
    const fx = this.pos.x + localFunnelX * cosH;
    const fy = this.pos.y + localFunnelX * sinH;

    this.particles.steamPuff(fx, fy, this.vel.x, this.vel.y, 20);
    this.particles.hornShockwaves(this.pos.x, this.pos.y);
    this.addText(this.pos.x, this.pos.y - SHIP_W - 10, "HORN", "#f0a63c", 20);
    this.trauma = Math.min(1, this.trauma + 0.08);

    // Decorative tug call-and-response whistle
    this.later(() => {
      if (this.phase === "playing") this.audio.tugToot(0);
    }, 380);
    this.later(() => {
      if (this.phase === "playing") this.audio.tugToot(55);
    }, 700);
  }

  startTutorial() {
    this.audio.ensure();
    this.runSeed = 42;
    this.score = 0;
    this.displayScore = 0;
    this.hull = 100;
    this.stats = { moorings: 0, bumps: 0, perfects: 0, streak: 0, bestStreak: 0 };
    this.loadLevel(0, false);
    this.setPhase("playing");
    this.audio.horn(false);
    this.audio.click();
  }

  private persistCurrentRun() {
    if (this.phase === "gameover" || this.phase === "menu") return;
    saveActiveRun({
      levelIndex: this.levelIndex,
      score: this.score,
      displayScore: this.displayScore,
      hull: this.hull,
      streak: this.stats.streak,
      stats: { ...this.stats },
      runSeed: this.runSeed,
      savedAt: Date.now(),
    });
  }

  startRun() {
    this.audio.ensure();
    this.runSeed = Math.floor(Math.random() * 1e9);
    this.score = 0;
    this.displayScore = 0;
    this.hull = 100;
    this.stats = { moorings: 0, bumps: 0, perfects: 0, streak: 0, bestStreak: 0 };
    this.loadLevel(1, false);
    this.setPhase("playing");
    this.audio.horn(false);
    this.audio.click();
    this.persistCurrentRun();
  }

  resumeSavedRun(saved: SavedRunState) {
    this.audio.ensure();
    this.runSeed = saved.runSeed;
    this.score = saved.score;
    this.displayScore = saved.displayScore;
    this.hull = saved.hull;
    this.stats = { ...saved.stats };
    this.loadLevel(saved.levelIndex, false);
    this.setPhase("playing");
    this.audio.shipHorn();
    this.audio.click();
    this.persistCurrentRun();
  }

  restart() {
    this.startRun();
  }

  toMenu() {
    this.persistCurrentRun();
    this.audio.silenceLoops();
    this.loadLevel(1, true);
    this.setPhase("menu");
  }

  pause() {
    if (this.phase !== "playing") return;
    this.persistCurrentRun();
    this.audio.silenceLoops();
    this.keys.clear();
    this.recomputeInput();
    this.setPhase("paused");
  }

  resume() {
    if (this.phase !== "paused") return;
    this.audio.ensure();
    this.last = performance.now();
    this.setPhase("playing");
    this.persistCurrentRun();
  }

  togglePause() {
    if (this.phase === "playing") this.pause();
    else if (this.phase === "paused") this.resume();
  }

  skipLevelClear() {
    if (this.phase !== "levelClear") return;
    this.nextLevel();
  }

  toggleMute() {
    this.audio.ensure();
    return this.audio.toggleMuted();
  }

  /** Touch/virtual button input */
  setInput(action: Action, down: boolean) {
    const id = `touch:${action}`;
    if (down) this.keys.add(id);
    else this.keys.delete(id);
    this.recomputeInput();
    if (down) this.audio.ensure();
  }

  clearInput() {
    this.keys.clear();
    this.recomputeInput();
  }

  getHud(): HudData {
    const u = this.vel.x * Math.cos(this.heading) + this.vel.y * Math.sin(this.heading);
    const spd = Math.hypot(this.vel.x, this.vel.y);
    let telegraph = "STOP";
    if (Math.abs(u) > 0.6 || Math.abs(this.throttle) > 0.05) {
      const dir = (Math.abs(u) > 0.6 ? u : this.throttle) > 0 ? "AHEAD" : "ASTERN";
      const a = Math.abs(u);
      const word = a < 5 ? "DEAD SLOW" : a < 12 ? "SLOW" : a < 24 ? "HALF" : "FULL";
      telegraph = `${word} ${dir}`;
    }
    return {
      phase: this.phase,
      level: this.levelIndex,
      levelName: this.level.name,
      berthNumber: this.level.berthNumber,
      missionType: this.level.missionType,
      tugState: this.tugState,
      inRendezvousRange: this.isInRendezvousRange(),
      score: this.score,
      displayScore: Math.round(this.displayScore),
      scoreBump: this.scoreBump,
      timeLeft: this.timeLeft,
      timeLimit: this.level.timeLimit,
      hull: this.hull,
      streak: this.stats.streak,
      mult: this.multFor(this.stats.streak),
      align: this.align,
      securing: this.secure,
      introActive: this.introTimer > 0,
      introTitle: this.level.missionType === "tutorial" ? "Pilot Academy" : `Berth ${this.level.berthNumber} · ${this.level.name}`,
      introTip: this.touchMode ? this.level.tipTouch : this.level.tipKeys,
      current: this.currentAt(this.time),
      telegraph,
      speed: spd,
      muted: this.audio.muted,
      tutorial: this.getTutorialInfo(),
      rudder: this.rudder,
      tugPenaltyWarning: this.tugState === "attached" && !this.isInPilotArea(),
      tugBreachIn:
        this.tugState === "attached" && !this.isInPilotArea() && this.level.missionType !== "tutorial"
          ? Math.max(0, TUG_BREACH_GRACE - this.tugBreachTimer)
          : null,
      unlimitedTime: this.level.timeLimit > UNLIMITED_TIME,
      departureExit: this.level.departureExit,
    };
  }

  // ───────────────────────── Setup ─────────────────────────

  private setPhase(p: Phase, payload?: Breakdown | GameOverInfo) {
    this.phase = p;
    this.cb.onPhase(p, payload);
  }

  private loadLevel(index: number, attract: boolean) {
    this.levelIndex = index;
    this.level = makeLevel(index, this.runSeed);
    const lv = this.level;
    this.pos = { x: lv.start.pos.x, y: lv.start.pos.y };
    this.vel = { x: 0, y: 0 };
    this.heading = lv.start.heading;
    this.angVel = 0;
    this.throttle = 0;
    this.throttleTarget = 0;
    this.rudder = 0;
    this.rudderTarget = 0;
    this.timeLeft = lv.timeLimit;
    this.introTimer = attract ? 0 : 2.6;
    this.secure = 0;
    this.secureTick = 0;
    this.levelClearTimer = 0;
    this.wrecked = false;
    this.wreckTimer = 0;
    this.lastBeep = -1;
    this.levelMaxImpact = 0;
    this.levelDamage = 0;
    this.softTouchGiven = false;
    this.scrapeLevel = 0;
    this.trauma = 0;
    this.hitStop = 0;
    this.flash = 0;
    this.texts.length = 0;
    this.particles.clear();
    this.keys.clear();
    this.recomputeInput();
    this.departureCleared = false;
    this.mooringLinesAttached = lv.missionType === "departure";
    this.tugPenaltyTimer = 0;
    this.tugBreachTimer = 0;
    this.tutorialStep = 0;
    this.tutorialStepTimer = 0;
    this.tutorialStepCompleted = false;
    this.tugAttachTimer = 0;
    this.tugState = attract || lv.missionType === "departure" ? "attached" : "standby";

    if (attract) {
      this.pos = { x: -260, y: 90 };
      this.heading = UP + 0.35;
      this.vel = { x: 3, y: -2 };
    }

    // Tugs sit on the side facing away from the quay
    const side: 1 | -1 = Math.sin(this.heading) > 0 ? 1 : -1;
    this.tugs = (["bow", "stern"] as const).map((k) => {
      const anchorX = (k === "bow" ? 1 : -1) * SHIP_L * TUG_ANCHOR;
      const localPos = { x: anchorX, y: side * (SHIP_W / 2 + TUG_W / 2 + 3) };
      const standbyPos: Vec = {
        x: QUAY_X - 160,
        y: lv.berth.y + (k === "bow" ? -120 : 120),
      };
      const tug: Tug = {
        anchorX,
        side,
        pendingSide: side,
        cmd: 0,
        effort: 0,
        localPos,
        localAngle: 0,
        phase: Math.random() * 6.28,
        waypoint: null,
        emitAcc: 0,
        standbyPos,
        worldPos: this.tugState === "standby" ? { ...standbyPos } : { x: 0, y: 0 },
        worldAngle: this.tugState === "standby" ? Math.PI : 0,
      };
      return tug;
    });
    this.buoys = lv.buoys.map((def) => ({
      def,
      pos: { ...def.anchor },
      vel: { x: 0, y: 0 },
      phase: Math.random() * 6.28,
      r: 4.5,
    }));

    // Camera starts a bit wide and eases in
    const target = this.cameraTarget();
    this.cam.x = target.x;
    this.cam.y = target.y;
    this.cam.zoom = target.zoom * (attract ? 1 : 0.8);
    this.updateTugsVisual(0.5);
  }

  private nextLevel() {
    const nextIdx = this.levelIndex === 0 ? 1 : this.levelIndex + 1;
    this.loadLevel(nextIdx, false);
    this.setPhase("playing");
    this.audio.horn(false);
    this.persistCurrentRun();
  }

  // ───────────────────────── Input ─────────────────────────

  private onKeyDown = (e: KeyboardEvent) => {
    const el = document.activeElement;
    if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) return;
    if (e.code === "KeyH" && this.phase === "playing") {
      e.preventDefault();
      this.soundHorn();
      return;
    }
    if (e.code === "KeyT" && this.phase === "playing") {
      e.preventDefault();
      this.toggleTugs();
      return;
    }
    if (KEYMAP[e.code]) {
      e.preventDefault();
      if (!this.keys.has(e.code)) {
        this.keys.add(e.code);
        this.recomputeInput();
      }
      this.audio.ensure();
      return;
    }
    if (e.code === "Space") e.preventDefault();
    if ((e.code === "KeyP" || e.code === "Escape") && (this.phase === "playing" || this.phase === "paused")) {
      e.preventDefault();
      this.togglePause();
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    if (this.keys.delete(e.code)) this.recomputeInput();
  };

  private onBlur = () => {
    this.keys.clear();
    this.recomputeInput();
    if (this.phase === "playing") this.pause();
  };

  private onVisibility = () => {
    if (document.hidden && this.phase === "playing") this.pause();
  };

  private recomputeInput() {
    for (const a of ACTIONS) this.input[a] = false;
    for (const k of this.keys) {
      if (k.startsWith("touch:")) {
        this.input[k.slice(6) as Action] = true;
      } else {
        const acts = KEYMAP[k];
        if (acts) for (const a of acts) this.input[a] = true;
      }
    }
  }

  // ───────────────────────── Main loop ─────────────────────────

  private loop = (now: number) => {
    this.rafId = requestAnimationFrame(this.loop);
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.1) dt = 0.1;
    if (dt < 0) dt = 0;

    if (this.phase !== "paused") {
      if (this.hitStop > 0) {
        this.hitStop -= dt;
      } else {
        this.acc += dt;
        let steps = 0;
        while (this.acc >= FIXED_DT && steps < 10) {
          this.step(FIXED_DT);
          this.acc -= FIXED_DT;
          steps++;
        }
        if (steps >= 10) this.acc = 0;
      }
      this.updateVisual(dt);
    }
    this.render();

    this.hudTimer += dt;
    if (this.hudTimer > 0.066) {
      this.hudTimer = 0;
      this.cb.onHud(this.getHud());
    }

    this.lastMeasure += dt;
    if (this.lastMeasure > 0.4) {
      this.lastMeasure = 0;
      this.measureUi();
    }
  };

  private currentAt(t: number): Vec {
    const lv = this.level;
    if (!lv.gust) return lv.current;
    const g = 1 + lv.gust * Math.sin((t / lv.gustPeriod) * 6.2832) * 0.5 + lv.gust * 0.5 * Math.sin(t * 0.9);
    return { x: lv.current.x * g, y: lv.current.y * g };
  }

  private multFor(streak: number) {
    return Math.min(3, 1 + 0.5 * Math.max(0, streak - 1));
  }

  // ───────────────────────── Physics step ─────────────────────────

  private step(dt: number) {
    this.time += dt;
    const playing = this.phase === "playing" && !this.wrecked;
    const inMenu = this.phase === "menu";

    // Timers
    if (this.phase === "playing") {
      if (this.wrecked) {
        this.wreckTimer -= dt;
        if (this.wreckTimer <= 0) this.gameOver("wrecked");
      } else if (this.introTimer > 0) {
        this.introTimer -= dt;
        if (this.anyInput()) this.introTimer = Math.min(this.introTimer, 0.6);
      } else {
        this.timeLeft -= dt;
        const s = Math.ceil(this.timeLeft);
        if (s <= 5 && s !== this.lastBeep && s > 0) {
          this.lastBeep = s;
          this.audio.countdown(false);
        }
        if (this.timeLeft <= 0) {
          this.timeLeft = 0;
          this.audio.countdown(true);
          this.gameOver("timeout");
          return;
        }
      }
    } else if (this.phase === "levelClear") {
      this.levelClearTimer -= dt;
      if (this.levelClearTimer <= 0) this.nextLevel();
    }

    // Tug attachment countdown
    if (this.tugState === "approaching") {
      this.tugAttachTimer -= dt;
      if (this.tugAttachTimer <= 0) {
        this.tugAttachTimer = 0;
        this.tugState = "attached";
        this.addText(this.pos.x, this.pos.y - SHIP_W - 22, "TUGS SECURED & READY", "#57b98a", 20);
        this.audio.bump();
      }
    }

    // Commands
    if (playing) {
      this.throttleTarget = this.input.ahead ? 1 : this.input.astern ? -1 : 0;
      const helmLeft = this.input.bowLeft || this.input.sternLeft;
      const helmRight = this.input.bowRight || this.input.sternRight;

      if (this.tugState === "attached") {
        // When tug is attached, ship's own turn left/right (rudder) is disabled!
        this.rudderTarget = 0;
        this.tugs[0].cmd = (this.input.bowRight ? 1 : 0) - (this.input.bowLeft ? 1 : 0);
        this.tugs[1].cmd = (this.input.sternRight ? 1 : 0) - (this.input.sternLeft ? 1 : 0);
      } else {
        // When tugs are detached, ship steers via its own rudder
        this.rudderTarget = helmRight ? 1 : helmLeft ? -1 : 0;
        this.tugs[0].cmd = 0;
        this.tugs[1].cmd = 0;
      }
    } else {
      this.throttleTarget = 0;
      this.rudderTarget = 0;
      this.tugs[0].cmd = 0;
      this.tugs[1].cmd = 0;
    }
    this.throttle = damp(this.throttle, this.throttleTarget, ENGINE_RAMP, dt);
    this.rudder = damp(this.rudder, this.rudderTarget, this.tugState === "attached" ? 8.0 : 4.0, dt);
    for (const t of this.tugs) t.effort = damp(t.effort, t.cmd, TUG_RAMP, dt);

    // Forces (mass = 1)
    const c = Math.cos(this.heading);
    const s = Math.sin(this.heading);
    const fwd = { x: c, y: s };
    const right = { x: -s, y: c };
    let fx = 0;
    let fy = 0;
    let torque = 0;

    const eng = this.throttle > 0 ? this.throttle * ENGINE_AHEAD : this.throttle * ENGINE_ASTERN;
    fx += fwd.x * eng;
    fy += fwd.y * eng;

    for (const t of this.tugs) {
      const f = t.effort * TUG_FORCE;
      fx += right.x * f;
      fy += right.y * f;
      torque += t.anchorX * f;
    }

    // Drag relative to the water
    const cur = this.currentAt(this.time);
    const rx = this.vel.x - cur.x;
    const ry = this.vel.y - cur.y;
    const u = rx * fwd.x + ry * fwd.y;
    const v = rx * right.x + ry * right.y;

    // Rudder hydrodynamics: water flow over rudder at stern (only active when tugs are detached)
    if (this.tugState !== "attached") {
      const propWash = Math.max(0, this.throttle) * 7.5;
      // Cap vFlow to prevent quadratic torque runaway at high ahead speed (barrel-roll fix)
      const vFlow = Math.min(u + propWash, 12);
      if (Math.abs(vFlow) > 0.04 || Math.abs(this.rudder) > 0.04) {
        const sternArm = -SHIP_L * 0.48;
        const rudderLift = this.rudder * (vFlow * 1.5 + Math.sign(vFlow) * vFlow * vFlow * 0.02);
        const fRudderRight = -rudderLift;
        fx += right.x * fRudderRight;
        fy += right.y * fRudderRight;
        torque += sternArm * fRudderRight;

        const rDrag = Math.abs(this.rudder) * Math.abs(vFlow) * 0.35;
        fx -= fwd.x * rDrag;
        fy -= fwd.y * rDrag;
      }
    }

    const dLong = -(K_LONG * u + C_LONG * u * Math.abs(u));
    const dLat = -(K_LAT * v + C_LAT * v * Math.abs(v));
    fx += fwd.x * dLong + right.x * dLat;
    fy += fwd.y * dLong + right.y * dLat;
    const w = this.angVel;
    torque += -(K_ANG * w + C_ANG * w * Math.abs(w)) * INERTIA;

    if (inMenu) {
      // gentle drift in attract mode
      fx += Math.sin(this.time * 0.3) * 0.6;
      fy += Math.cos(this.time * 0.23) * 0.6;
    }

    this.vel.x += fx * dt;
    this.vel.y += fy * dt;
    this.angVel += (torque / INERTIA) * dt;
    this.pos.x += this.vel.x * dt;
    this.pos.y += this.vel.y * dt;
    this.heading += this.angVel * dt;

    this.collide(dt);
    this.updateBuoys(dt);

    // Departure mooring line release when pulling away from quay
    if (this.mooringLinesAttached && this.level.missionType === "departure") {
      const distFromQuay = QUAY_X - this.pos.x - SHIP_W / 2;
      const speed = Math.hypot(this.vel.x, this.vel.y);
      const tugPulling = this.tugs.some((t) => Math.abs(t.effort) > 0.25);
      if (distFromQuay > MOOR_DIST_MAX + 6 || Math.abs(this.throttle) > 0.15 || speed > 0.8 || tugPulling) {
        this.mooringLinesAttached = false;
        this.audio.splash();
        this.particles.burst(QUAY_X - 2, this.pos.y, "foam", 14, 30);
        this.addText(this.pos.x, this.pos.y - SHIP_W - 16, "LINES CAST OFF!", "#e0b877", 20);
      }
    }

    // Tug pilot-boundary breach: fine, then fail the contract after a grace
    // period. The academy is exempt — it sends the ship out on purpose.
    if (playing && this.tugState === "attached" && !this.isInPilotArea()) {
      this.tugBreachTimer += dt;
      this.tugPenaltyTimer += dt;
      if (this.tugPenaltyTimer >= 0.7) {
        this.tugPenaltyTimer = 0;
        this.score = Math.max(0, this.score - 5);
        this.audio.bump();
        this.addText(this.pos.x, this.pos.y - SHIP_W - 25, "−5 PTS · TUGS OUTSIDE PILOT AREA", "#d9564a", 15);
      }
      if (this.level.missionType !== "tutorial" && this.tugBreachTimer >= TUG_BREACH_GRACE) {
        this.gameOver("tug_open_sea");
        return;
      }
    } else {
      this.tugPenaltyTimer = 0;
      this.tugBreachTimer = 0;
    }

    if (playing) {
      if (this.level.missionType === "tutorial") {
        this.updateTutorial(dt);
      } else if (this.level.missionType === "departure" && !this.departureCleared) {
        this.checkDeparture();
      }
    }

    if (playing && this.introTimer <= 0) {
      if (this.level.missionType === "arrival") {
        this.checkMooring(dt);
      } else if (this.level.missionType === "tutorial" && this.tutorialStep === 6) {
        this.checkMooring(dt);
      } else {
        this.secure = 0;
      }
    } else if (this.phase !== "levelClear") {
      this.secure = 0;
    }
  }

  private anyInput() {
    return ACTIONS.some((a) => this.input[a]);
  }

  // ───────────────────────── Collisions ─────────────────────────

  private collide(dt: number) {
    const poly = transformPoly(HULL, this.pos, this.heading);
    let scraping = 0;
    for (const obs of this.level.obstacles) {
      const dx = obs.center.x - this.pos.x;
      const dy = obs.center.y - this.pos.y;
      if (dx * dx + dy * dy > (obs.radius + SHIP_L / 2 + 4) ** 2) continue;
      const contact = satPolygons(poly, obs.poly);
      if (!contact) continue;
      const vt = this.resolveContact(contact, obs.kind);
      scraping = Math.max(scraping, vt);
      // refresh polygon after correction
      const np = transformPoly(HULL, this.pos, this.heading);
      for (let i = 0; i < np.length; i++) poly[i] = np[i];
    }
    this.clampToBasin();
    this.scrapeLevel = damp(this.scrapeLevel, clamp01((scraping - 2.5) / 10), 10, dt);
  }

  /**
   * Belt-and-braces constraint: the quay is a solid wall, the rocks close the
   * basin. If a deep or fast contact ever lets SAT resolve the wronG way, the
   * hull is pushed back instead of being ejected onto land.
   */
  private clampToBasin() {
    const poly = transformPoly(HULL, this.pos, this.heading);
    let maxX = -Infinity;
    for (const v of poly) maxX = Math.max(maxX, v.x);
    if (maxX > QUAY_X) {
      this.pos.x -= maxX - QUAY_X;
      if (this.vel.x > 0) this.vel.x = 0;
      this.angVel *= 0.97;
    }
    const lim = 1240;
    this.pos.x = clamp(this.pos.x, -lim, QUAY_X);
    this.pos.y = clamp(this.pos.y, -lim, lim);
  }

  /** Resolves a contact; returns the tangential sliding speed for scrape FX. */
  private resolveContact(c: Contact, kind: "quay" | "rock" | "ship"): number {
    const n = c.normal;
    this.pos.x += n.x * c.depth;
    this.pos.y += n.y * c.depth;

    const r = { x: c.point.x - this.pos.x, y: c.point.y - this.pos.y };
    const vpx = this.vel.x - this.angVel * r.y;
    const vpy = this.vel.y + this.angVel * r.x;
    const vn = vpx * n.x + vpy * n.y;
    const t = { x: -n.y, y: n.x };
    const vt = vpx * t.x + vpy * t.y;

    if (vn < 0) {
      const e = kind === "quay" ? RESTITUTION_QUAY : RESTITUTION_ROCK;
      const rn = cross(r, n);
      const j = (-(1 + e) * vn) / (1 + (rn * rn) / INERTIA);
      this.vel.x += n.x * j;
      this.vel.y += n.y * j;
      this.angVel += (rn * j) / INERTIA;

      const rt = cross(r, t);
      let jt = -vt / (1 + (rt * rt) / INERTIA);
      jt = clamp(jt, -FRICTION * j, FRICTION * j);
      this.vel.x += t.x * jt;
      this.vel.y += t.y * jt;
      this.angVel += (rt * jt) / INERTIA;

      this.onImpact(-vn, c.point, kind, n);
    }

    const slide = Math.abs(vt);
    if (slide > 2.5 && this.phase === "playing" && !this.wrecked) {
      if (Math.random() < 0.5) {
        this.particles.burst(c.point.x, c.point.y, "spark", 1, 30 + slide * 4, n.x, n.y);
      }
      const dmg = (slide - 2.5) * (kind === "quay" ? 0.35 : 0.8) * FIXED_DT;
      this.applyDamage(dmg, null);
    }
    return slide;
  }

  private onImpact(speed: number, point: Vec, kind: "quay" | "rock" | "ship", n: Vec) {
    if (speed < 0.5) return;
    const threshold = kind === "quay" ? DMG_THRESHOLD_QUAY : DMG_THRESHOLD_HARD;
    const factor = kind === "quay" ? DMG_FACTOR_QUAY : DMG_FACTOR_HARD;
    const trainingScale = this.levelIndex === 1 ? 0.6 : 1;
    const dmg = Math.max(0, speed - threshold) * factor * trainingScale;
    this.levelMaxImpact = Math.max(this.levelMaxImpact, speed);

    this.trauma = Math.min(1, this.trauma + clamp(speed / 14, 0.05, 0.6));
    this.particles.burst(point.x, point.y, "foam", Math.min(26, 4 + Math.floor(speed * 2.5)), 18 + speed * 4, n.x, n.y);
    this.particles.ripple(point.x, point.y, 4, 1.2);

    if (this.phase !== "playing" || this.wrecked) return;

    if (dmg > 0) {
      this.applyDamage(dmg, point);
      this.stats.bumps++;
      this.particles.burst(point.x, point.y, "spark", Math.min(30, Math.floor(dmg * 1.5) + 6), 60 + speed * 6, n.x, n.y);
      this.particles.burst(point.x, point.y, "debris", Math.min(14, Math.floor(dmg / 3) + 2), 40 + speed * 3, n.x, n.y);
      this.audio.thud(clamp01(speed / 12));
      if (dmg > 12) this.hitStop = Math.min(0.12, 0.03 + dmg / 500);
      this.flash = Math.min(0.55, 0.12 + dmg / 80);
      this.flashColor = "255,70,60";
    } else {
      this.audio.bump();
      if (kind === "quay" && !this.softTouchGiven && speed > 0.8) {
        this.softTouchGiven = true;
        this.addScore(75, point, "SOFT TOUCH +75", "#57b98a", 15);
      }
    }
  }

  private applyDamage(dmg: number, point: Vec | null) {
    if (dmg <= 0 || this.wrecked) return;
    this.hull -= dmg;
    this.levelDamage += dmg;
    if (point && dmg >= 1) {
      this.addText(point.x, point.y, `-${Math.round(dmg)} HULL`, "#d9564a", dmg > 15 ? 20 : 15);
    }
    if (this.hull <= 0) {
      this.hull = 0;
      this.wreck();
    }
  }

  private wreck() {
    this.wrecked = true;
    this.wreckTimer = 1.6;
    this.trauma = 1;
    this.hitStop = 0.15;
    this.flash = 0.7;
    this.flashColor = "255,255,255";
    this.audio.wreck();
    this.audio.silenceLoops();
    this.particles.burst(this.pos.x, this.pos.y, "debris", 50, 90);
    this.particles.burst(this.pos.x, this.pos.y, "spark", 40, 120);
    for (let i = 0; i < 25; i++) {
      const a = Math.random() * 6.28;
      const d = Math.random() * SHIP_L * 0.45;
      this.particles.smoke(this.pos.x + Math.cos(a) * d, this.pos.y + Math.sin(a) * d, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10, 4 + Math.random() * 5);
    }
    this.addText(this.pos.x, this.pos.y - 30, "HULL BREACH!", "#d9564a", 28);
    this.keys.clear();
    this.recomputeInput();
  }

  private updateBuoys(dt: number) {
    const poly = transformPoly(HULL, this.pos, this.heading);
    for (const b of this.buoys) {
      // spring back to anchor
      const ax = b.def.anchor.x - b.pos.x;
      const ay = b.def.anchor.y - b.pos.y;
      b.vel.x += ax * 2.5 * dt - b.vel.x * 1.5 * dt;
      b.vel.y += ay * 2.5 * dt - b.vel.y * 1.5 * dt;
      b.pos.x += b.vel.x * dt;
      b.pos.y += b.vel.y * dt;

      const dx = b.pos.x - this.pos.x;
      const dy = b.pos.y - this.pos.y;
      if (dx * dx + dy * dy > (SHIP_L / 2 + 10) ** 2) continue;
      const c = circleVsPolygon(b.pos, b.r, poly);
      if (!c) continue;
      b.pos.x += c.normal.x * c.depth;
      b.pos.y += c.normal.y * c.depth;
      const r = { x: c.point.x - this.pos.x, y: c.point.y - this.pos.y };
      const vpx = this.vel.x - this.angVel * r.y;
      const vpy = this.vel.y + this.angVel * r.x;
      const relN = (b.vel.x - vpx) * c.normal.x + (b.vel.y - vpy) * c.normal.y;
      if (relN < 0) {
        const speed = -relN;
        b.vel.x += c.normal.x * speed * 1.6;
        b.vel.y += c.normal.y * speed * 1.6;
        // tiny reaction on the ship
        const j = speed * 0.06;
        this.vel.x -= c.normal.x * j;
        this.vel.y -= c.normal.y * j;
        if (speed > 1.5 && this.phase === "playing" && !this.wrecked) {
          this.audio.splash();
          this.particles.burst(c.point.x, c.point.y, "foam", 8, 25);
          this.particles.ripple(b.pos.x, b.pos.y, 5, 1);
          const dmg = Math.max(0, speed - 4) * 1.5;
          if (dmg > 0.5) {
            this.applyDamage(dmg, c.point);
            this.trauma = Math.min(1, this.trauma + 0.15);
            this.audio.bump();
          } else {
            this.addText(b.pos.x, b.pos.y - 10, "BUOY!", "#f0a63c", 13);
          }
        }
      }
    }
  }

  // ───────────────────────── Mooring ─────────────────────────

  private checkMooring(dt: number) {
    const b = this.level.berth;
    const gap = QUAY_X - this.pos.x - SHIP_W / 2;
    const distOk = gap >= MOOR_DIST_MIN && gap <= MOOR_DIST_MAX;
    const alongOk = Math.abs(this.pos.y - b.y) <= b.tolAlong;
    const aErr = Math.min(Math.abs(angleDiff(this.heading, UP)), Math.abs(angleDiff(this.heading, -UP)));
    const angleOk = aErr <= b.tolAngle;
    const speedOk = Math.hypot(this.vel.x, this.vel.y) <= MOOR_MAX_SPEED && Math.abs(this.angVel) <= MOOR_MAX_ANGVEL;
    const posOk = distOk && alongOk;
    const all = posOk && angleOk && speedOk;
    this.align = { pos: posOk, angle: angleOk, speed: speedOk, all };

    if (all) {
      this.secure += dt / SECURE_TIME;
      const tick = Math.floor(this.secure * 4);
      if (tick !== this.secureTick && tick < 4) {
        this.secureTick = tick;
        this.audio.tick(tick);
      }
      if (this.secure >= 1) {
        if (this.level.missionType === "tutorial") {
          // Handled in updateTutorial
        } else {
          this.moor(aErr);
        }
      }
    } else {
      this.secure = Math.max(0, this.secure - dt * 1.5);
      if (this.secure === 0) this.secureTick = 0;
    }
  }

  private moor(aErr: number) {
    const b = this.level.berth;
    const offErr = clamp01(Math.abs(this.pos.y - b.y) / b.tolAlong);
    const angErr = clamp01(aErr / b.tolAngle);
    const base = 1000;
    const timeBonus = Math.round(this.timeLeft) * 12;
    const precision = Math.round(700 * (1 - 0.5 * offErr - 0.5 * angErr));
    const gentle = this.levelMaxImpact <= 2 ? 500 : Math.round(500 * clamp01(1 - (this.levelMaxImpact - 2) / 9));
    const isPerfect = this.levelDamage < 0.5 && precision >= 540;
    const perfect = isPerfect ? 500 : 0;
    if (isPerfect) {
      this.stats.streak++;
      this.stats.perfects++;
      this.stats.bestStreak = Math.max(this.stats.bestStreak, this.stats.streak);
    } else {
      this.stats.streak = 0;
    }
    const mult = this.multFor(this.stats.streak);
    const total = Math.round((base + timeBonus + precision + gentle + perfect) * mult);
    this.score += total;
    this.scoreBump++;
    this.stats.moorings++;
    this.hull = Math.min(100, this.hull + HULL_REPAIR_PER_LEVEL);
    this.secure = 1;
    this.mooringLinesAttached = true;
    this.levelClearTimer = LEVEL_CLEAR_HOLD;

    this.audio.success();
    this.audio.horn(true);
    if (isPerfect) this.audio.perfect();
    this.particles.confetti(this.pos.x, this.pos.y, 110, 110);
    this.particles.ripple(this.pos.x, this.pos.y, 10, 2);
    this.addText(this.pos.x - 10, this.pos.y - SHIP_W, "MOORED!", "#57b98a", 34);
    if (isPerfect) this.addText(this.pos.x - 10, this.pos.y + SHIP_W + 6, "PERFECT BERTHING", "#f0a63c", 20);
    this.trauma = Math.min(1, this.trauma + 0.2);

    const breakdown: Breakdown = {
      levelIndex: this.levelIndex,
      levelName: this.level.name,
      base,
      timeBonus,
      precision,
      gentle,
      perfect,
      streak: this.stats.streak,
      mult,
      total,
    };
    this.keys.clear();
    this.recomputeInput();
    this.audio.silenceLoops();
    this.setPhase("levelClear", breakdown);
  }

  private checkDeparture() {
    const exit = this.level.departureExit;
    const side = exit?.side ?? "west";
    const threshold = exit?.threshold ?? -680;
    let reached = false;
    if (side === "west") {
      reached = this.pos.x <= threshold;
    } else if (side === "north") {
      reached = this.pos.y <= threshold;
    } else if (side === "south") {
      reached = this.pos.y >= threshold;
    }

    if (reached) {
      if (this.tugState === "attached") {
        this.gameOver("tug_open_sea");
      } else {
        this.departureCleared = true;
        this.clearDeparture();
      }
    }
  }

  private clearDeparture() {
    const base = 1200;
    const timeBonus = Math.round(this.timeLeft) * 12;
    const precision = 600;
    const gentle = this.levelMaxImpact <= 2 ? 500 : Math.round(500 * clamp01(1 - (this.levelMaxImpact - 2) / 9));
    const isPerfect = this.levelDamage < 0.5 && this.levelMaxImpact <= 1.5;
    const perfect = isPerfect ? 500 : 0;
    if (isPerfect) {
      this.stats.streak++;
      this.stats.perfects++;
      this.stats.bestStreak = Math.max(this.stats.bestStreak, this.stats.streak);
    } else {
      this.stats.streak = 0;
    }
    const mult = this.multFor(this.stats.streak);
    const total = Math.round((base + timeBonus + precision + gentle + perfect) * mult);
    this.score += total;
    this.scoreBump++;
    this.stats.moorings++;
    this.hull = Math.min(100, this.hull + HULL_REPAIR_PER_LEVEL);
    this.levelClearTimer = LEVEL_CLEAR_HOLD;

    this.audio.success();
    this.audio.horn(true);
    if (isPerfect) this.audio.perfect();
    this.particles.confetti(this.pos.x, this.pos.y, 110, 110);
    this.particles.ripple(this.pos.x, this.pos.y, 12, 2.5);
    this.addText(this.pos.x - 20, this.pos.y - SHIP_W, "CLEARED FOR SEA!", "#57b98a", 34);
    if (isPerfect) this.addText(this.pos.x - 20, this.pos.y + SHIP_W + 6, "FLAWLESS DEPARTURE", "#f0a63c", 20);
    this.trauma = Math.min(1, this.trauma + 0.2);

    const breakdown: Breakdown = {
      levelIndex: this.levelIndex,
      levelName: this.level.name,
      base,
      timeBonus,
      precision,
      gentle,
      perfect,
      streak: this.stats.streak,
      mult,
      total,
      departure: true,
    };
    this.keys.clear();
    this.recomputeInput();
    this.audio.silenceLoops();
    this.setPhase("levelClear", breakdown);
  }

  getTutorialInfo(): TutorialInfo | undefined {
    if (this.levelIndex !== 0 || this.level.missionType !== "tutorial") return undefined;
    const touch = this.touchMode;
    const STEPS: { title: string; instruction: string; keyHint: string }[] = [
      {
        title: "ENGINE AHEAD",
        instruction: "Engage forward propulsion to build speed towards the harbour.",
        keyHint: touch ? "AHEAD" : "W or Up",
      },
      {
        title: "ENGINE ASTERN / BRAKING",
        instruction: "Reverse propulsion to decelerate. Big cargo ships have heavy momentum!",
        keyHint: touch ? "ASTERN" : "S or Down",
      },
      {
        title: "TUG RENDEZVOUS & ATTACH",
        instruction: touch
          ? "Approach the pilot station, then tap the anchor button to summon and attach the standby tugboats."
          : "Approach the pilot station and press [T] to summon and attach standby tugboats.",
        keyHint: touch ? "ANCHOR" : "T",
      },
      {
        title: "BOW TUG (FORWARD)",
        instruction: "Use the bow tug to swing the ship's head port or starboard.",
        keyHint: touch ? "BOW PAD" : "Q / E",
      },
      {
        title: "STERN TUG (AFT)",
        instruction: "Use the stern tug to pivot the stern alongside the quay.",
        keyHint: touch ? "STERN PAD" : "A / D",
      },
      {
        title: "LATERAL CRAB SLIDE",
        instruction: "Work both tugs simultaneously to push the ship sideways toward the dock.",
        keyHint: touch ? "BOTH PADS" : "LEFT / RIGHT",
      },
      {
        title: "BERTHING & SECURING LINES",
        instruction: "Align inside the berth target, parallel to quay, speed < 3 kn. Hold position to secure lines.",
        keyHint: "PARK IN OUTLINE",
      },
      {
        title: "OUTBOUND UNMOORING & DEPARTURE",
        instruction: "Now unmoor! Use tugs to peel away from the quay and throttle out toward open sea.",
        keyHint: "STEER WEST",
      },
      {
        title: "ACADEMY GRADUATE",
        instruction: "Mastery achieved! You are fully qualified for commercial harbour pilotage.",
        keyHint: "CERTIFIED",
      },
    ];

    const s = Math.min(this.tutorialStep, STEPS.length - 1);
    const cur = STEPS[s];
    return {
      step: s + 1,
      totalSteps: STEPS.length,
      title: cur.title,
      instruction: cur.instruction,
      keyHint: cur.keyHint,
      completed: this.tutorialStepCompleted,
    };
  }

  private updateTutorial(dt: number) {
    if (this.phase !== "playing" || this.wrecked) return;
    const s = this.tutorialStep;

    switch (s) {
      case 0: {
        // Engine ahead
        if (this.input.ahead || this.throttle > 0.1 || this.vel.y < -1.2) {
          this.tutorialStepCompleted = true;
          this.tutorialStepTimer += dt;
          if (this.tutorialStepTimer >= 0.9) {
            this.tutorialStep++;
            this.tutorialStepCompleted = false;
            this.tutorialStepTimer = 0;
            this.audio.tick(1);
          }
        }
        break;
      }
      case 1: {
        // Engine astern
        if (this.input.astern || this.throttle < -0.1) {
          this.tutorialStepCompleted = true;
          this.tutorialStepTimer += dt;
          if (this.tutorialStepTimer >= 0.9) {
            this.tutorialStep++;
            this.tutorialStepCompleted = false;
            this.tutorialStepTimer = 0;
            this.audio.tick(1);
          }
        }
        break;
      }
      case 2: {
        // Horn & Tug rendezvous
        if (this.tugState === "attached") {
          this.tutorialStepCompleted = true;
          this.tutorialStepTimer += dt;
          if (this.tutorialStepTimer >= 0.8) {
            this.tutorialStep++;
            this.tutorialStepCompleted = false;
            this.tutorialStepTimer = 0;
            this.audio.tick(2);
          }
        }
        break;
      }
      case 3: {
        // Bow tug
        if (Math.abs(this.tugs[0].effort) > 0.3) {
          this.tutorialStepCompleted = true;
          this.tutorialStepTimer += dt;
          if (this.tutorialStepTimer >= 0.9) {
            this.tutorialStep++;
            this.tutorialStepCompleted = false;
            this.tutorialStepTimer = 0;
            this.audio.tick(2);
          }
        }
        break;
      }
      case 4: {
        // Stern tug
        if (Math.abs(this.tugs[1].effort) > 0.3) {
          this.tutorialStepCompleted = true;
          this.tutorialStepTimer += dt;
          if (this.tutorialStepTimer >= 0.9) {
            this.tutorialStep++;
            this.tutorialStepCompleted = false;
            this.tutorialStepTimer = 0;
            this.audio.tick(2);
          }
        }
        break;
      }
      case 5: {
        // Lateral crab slide
        if (Math.abs(this.tugs[0].effort) > 0.2 && Math.abs(this.tugs[1].effort) > 0.2) {
          this.tutorialStepCompleted = true;
          this.tutorialStepTimer += dt;
          if (this.tutorialStepTimer >= 1.0) {
            this.tutorialStep++;
            this.tutorialStepCompleted = false;
            this.tutorialStepTimer = 0;
            this.audio.tick(3);
          }
        }
        break;
      }
      case 6: {
        // Mooring
        if (this.secure >= 1) {
          this.tutorialStepCompleted = true;
          this.secure = 0;
          this.audio.success();
          this.particles.confetti(this.pos.x, this.pos.y, 80, 80);
          this.addScore(1000, this.pos, "BERTH SECURED! +1000", "#57b98a", 26);
          this.tutorialStep++;
          this.tutorialStepCompleted = false;
          this.tutorialStepTimer = 0;
        }
        break;
      }
      case 7: {
        // Departure
        if (this.pos.x <= -480) {
          this.tutorialStepCompleted = true;
          this.audio.shipHorn();
          this.particles.confetti(this.pos.x, this.pos.y, 90, 90);
          this.addScore(1500, this.pos, "CLEARED HARBOUR! +1500", "#57b98a", 26);
          this.tutorialStep++;
          this.tutorialStepCompleted = false;
          this.tutorialStepTimer = 0;
        }
        break;
      }
      case 8: {
        // Graduation
        this.tutorialStepTimer += dt;
        if (this.tutorialStepTimer >= 2.5) {
          this.clearTutorial();
        }
        break;
      }
    }
  }

  private clearTutorial() {
    this.audio.success();
    this.audio.perfect();
    const breakdown: Breakdown = {
      levelIndex: 0,
      levelName: "Pilot Academy",
      base: 2500,
      timeBonus: 500,
      precision: 1000,
      gentle: 1000,
      perfect: 500,
      streak: 1,
      mult: 1,
      total: 5500,
    };
    this.score += 5500;
    this.levelClearTimer = LEVEL_CLEAR_HOLD;
    this.keys.clear();
    this.recomputeInput();
    this.audio.silenceLoops();
    this.setPhase("levelClear", breakdown);
  }

  private gameOver(reason: "wrecked" | "timeout" | "tug_open_sea") {
    clearSavedRun();
    this.audio.silenceLoops();
    this.audio.gameOver();
    this.keys.clear();
    this.recomputeInput();
    const info: GameOverInfo = {
      score: this.score,
      level: this.levelIndex,
      reason,
      moorings: this.stats.moorings,
      bumps: this.stats.bumps,
      perfects: this.stats.perfects,
      bestStreak: this.stats.bestStreak,
    };
    this.setPhase("gameover", info);
  }

  private addScore(points: number, at: Vec, label: string, color: string, size: number) {
    this.score += points;
    this.scoreBump++;
    this.addText(at.x, at.y - 10, label, color, size);
  }

  private addText(x: number, y: number, text: string, color: string, size = 14) {
    this.texts.push({ x, y, text, color, size, t: 0, life: 1.5 });
    if (this.texts.length > 12) this.texts.shift();
  }

  // ───────────────────────── Visual update ─────────────────────────

  private updateVisual(dt: number) {
    this.displayScore = damp(this.displayScore, this.score, 7, dt);
    if (this.reducedMotion) {
      this.trauma = 0;
      this.flash = 0;
      this.hitStop = 0;
    } else {
      this.trauma = Math.max(0, this.trauma - dt * 1.6);
      this.flash = Math.max(0, this.flash - dt * 2.5);
    }

    const cur = this.currentAt(this.time);
    this.particles.update(dt, cur.x, cur.y);
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.t += dt;
      if (t.t >= t.life) this.texts.splice(i, 1);
    }

    this.updateTugsVisual(dt);
    this.emitShipFx(dt);

    // camera
    const target = this.cameraTarget();
    const rate = this.phase === "menu" ? 0.8 : 2.6;
    this.cam.x = damp(this.cam.x, target.x, rate, dt);
    this.cam.y = damp(this.cam.y, target.y, rate, dt);
    this.cam.zoom = damp(this.cam.zoom, target.zoom, 1.9, dt);

    // audio loops
    const tugLevel = Math.max(Math.abs(this.tugs[0].effort), Math.abs(this.tugs[1].effort));
    const active = this.phase === "playing" && !this.wrecked;
    this.audio.setLoops(active ? Math.abs(this.throttle) : 0, active ? tugLevel : 0, active ? this.scrapeLevel : 0);

    if (this.wrecked && Math.random() < 0.5) {
      const a = Math.random() * 6.28;
      const d = Math.random() * SHIP_L * 0.4;
      this.particles.smoke(this.pos.x + Math.cos(a) * d, this.pos.y + Math.sin(a) * d, 0, -6, 3 + Math.random() * 3, "rgba(30,30,35,1)");
    } else if (this.hull < 30 && this.phase === "playing" && Math.random() < 0.12) {
      const c = Math.cos(this.heading);
      const s = Math.sin(this.heading);
      const x = -SHIP_L * 0.42;
      this.particles.smoke(this.pos.x + c * x, this.pos.y + s * x, (Math.random() - 0.5) * 4, -4, 2.5, "rgba(50,50,60,1)");
    }
  }

  private updateTugsVisual(dt: number) {
    const c = Math.cos(this.heading);
    const s = Math.sin(this.heading);

    if (this.tugState === "standby") {
      for (const t of this.tugs) {
        const bobX = Math.sin(this.time * 1.5 + t.phase) * 1.4;
        const bobY = Math.cos(this.time * 1.2 + t.phase) * 1.4;
        const targetX = t.standbyPos.x + bobX;
        const targetY = t.standbyPos.y + bobY;
        const dx = targetX - t.worldPos.x;
        const dy = targetY - t.worldPos.y;
        const dist = Math.hypot(dx, dy);

        if (dist > 8) {
          const moveAngle = Math.atan2(dy, dx);
          t.worldPos.x = damp(t.worldPos.x, targetX, 2.0, dt);
          t.worldPos.y = damp(t.worldPos.y, targetY, 2.0, dt);
          t.worldAngle = dampAngle(t.worldAngle, moveAngle, 3.5, dt);

          t.emitAcc += dt * 30;
          while (t.emitAcc >= 1) {
            t.emitAcc -= 1;
            const fx = Math.cos(t.worldAngle);
            const fy = Math.sin(t.worldAngle);
            const sx = t.worldPos.x - fx * (TUG_L / 2);
            const sy = t.worldPos.y - fy * (TUG_L / 2);
            this.particles.foam(sx, sy, -fx * 20, -fy * 20, 1.5, 0.6);
          }
        } else {
          t.worldPos.x = damp(t.worldPos.x, targetX, 3.0, dt);
          t.worldPos.y = damp(t.worldPos.y, targetY, 3.0, dt);
          t.worldAngle = dampAngle(t.worldAngle, Math.PI + Math.sin(this.time * 1.6 + t.phase) * 0.06, 2.5, dt);
        }
      }
      return;
    }

    if (this.tugState === "approaching") {
      const progress = clamp01(1 - this.tugAttachTimer / 1.8);
      const ease = 1 - Math.pow(1 - progress, 3);
      for (const t of this.tugs) {
        const targetPos = { x: t.anchorX, y: t.side * (SHIP_W / 2 + TUG_W / 2 + 3) };
        const attachedPos = {
          x: this.pos.x + targetPos.x * c - targetPos.y * s,
          y: this.pos.y + targetPos.x * s + targetPos.y * c,
        };
        t.worldPos = {
          x: t.standbyPos.x + (attachedPos.x - t.standbyPos.x) * ease,
          y: t.standbyPos.y + (attachedPos.y - t.standbyPos.y) * ease,
        };
        const dx = attachedPos.x - t.worldPos.x;
        const dy = attachedPos.y - t.worldPos.y;
        const steerAngle = Math.atan2(dy, dx);
        t.worldAngle = progress > 0.8 ? dampAngle(steerAngle, this.heading, (progress - 0.8) / 0.2, 1) : steerAngle;

        // Wake foam while steaming to ship
        t.emitAcc += dt * 45;
        while (t.emitAcc >= 1) {
          t.emitAcc -= 1;
          const fx = Math.cos(t.worldAngle);
          const fy = Math.sin(t.worldAngle);
          const sx = t.worldPos.x - fx * (TUG_L / 2);
          const sy = t.worldPos.y - fy * (TUG_L / 2);
          this.particles.foam(sx, sy, -fx * 25, -fy * 25, 2, 0.8);
        }
      }
      return;
    }

    const desired: 1 | -1 = s > 0.35 ? 1 : s < -0.35 ? -1 : this.tugs[0].side;
    for (const t of this.tugs) {
      if (desired !== t.side && !t.waypoint && this.phase !== "levelClear") {
        t.waypoint = { x: Math.sign(t.anchorX) * (SHIP_L / 2 + 24), y: 0 };
        t.pendingSide = desired;
      }
      let targetPos: Vec;
      let targetAngle: number;
      const e = t.effort;
      const absE = Math.abs(e);
      if (t.waypoint) {
        targetPos = t.waypoint;
        targetAngle = 0;
        if (Math.hypot(t.localPos.x - t.waypoint.x, t.localPos.y - t.waypoint.y) < 6) {
          t.side = t.pendingSide;
          t.waypoint = null;
        }
      } else if (absE < 0.08) {
        targetPos = { x: t.anchorX, y: t.side * (SHIP_W / 2 + TUG_W / 2 + 3) };
        targetAngle = 0;
      } else if (e * t.side < 0) {
        // pushing: nose against the hull
        targetPos = { x: t.anchorX, y: t.side * (SHIP_W / 2 + TUG_L / 2 - 0.5) };
        targetAngle = -t.side * Math.PI * 0.5;
      } else {
        // pulling on a line
        targetPos = { x: t.anchorX, y: t.side * (SHIP_W / 2 + 16 + TUG_L / 2) };
        targetAngle = t.side * Math.PI * 0.5;
      }
      t.localPos.x = damp(t.localPos.x, targetPos.x, 5.5, dt);
      t.localPos.y = damp(t.localPos.y, targetPos.y, 5.5, dt);
      t.localAngle = dampAngle(t.localAngle, targetAngle, 6, dt);

      const bobX = Math.sin(this.time * 1.7 + t.phase) * 0.5;
      const bobY = Math.cos(this.time * 1.3 + t.phase) * 0.5;
      const lx = t.localPos.x + bobX;
      const ly = t.localPos.y + bobY;
      t.worldPos = { x: this.pos.x + lx * c - ly * s, y: this.pos.y + lx * s + ly * c };
      t.worldAngle = this.heading + t.localAngle + Math.sin(this.time * 2.1 + t.phase) * 0.03;

      // prop wash
      if (absE > 0.1 && this.phase !== "paused") {
        t.emitAcc += dt * 70 * absE;
        const fa = t.worldAngle;
        const fx = Math.cos(fa);
        const fy = Math.sin(fa);
        while (t.emitAcc >= 1) {
          t.emitAcc -= 1;
          const sx = t.worldPos.x - fx * (TUG_L / 2) + (Math.random() - 0.5) * 4 * -fy;
          const sy = t.worldPos.y - fy * (TUG_L / 2) + (Math.random() - 0.5) * 4 * fx;
          const spd = 30 + Math.random() * 30;
          const jitter = (Math.random() - 0.5) * 14;
          this.particles.foam(sx, sy, -fx * spd + -fy * jitter + this.vel.x, -fy * spd + fx * jitter + this.vel.y, 1.8 + Math.random() * 2, 0.9 + Math.random() * 0.6);
          if (Math.random() < 0.3) this.particles.spray(sx, sy, -fx * spd * 1.3, -fy * spd * 1.3, 1.4, 0.4);
        }
      }
    }
  }

  private emitShipFx(dt: number) {
    if (this.phase === "paused") return;
    const c = Math.cos(this.heading);
    const s = Math.sin(this.heading);
    const u = this.vel.x * c + this.vel.y * s;
    const v = -this.vel.x * s + this.vel.y * c;
    const hl = SHIP_L / 2;
    const hw = SHIP_W / 2;
    const toWorld = (lx: number, ly: number) => ({ x: this.pos.x + lx * c - ly * s, y: this.pos.y + lx * s + ly * c });

    // Engine wash
    if (Math.abs(this.throttle) > 0.08) {
      this.engineAcc += dt * 55 * Math.abs(this.throttle);
      while (this.engineAcc >= 1) {
        this.engineAcc -= 1;
        if (this.throttle > 0) {
          const p = toWorld(-hl - 2, (Math.random() - 0.5) * hw * 1.2);
          const spd = 35 + Math.random() * 30;
          this.particles.foam(p.x, p.y, -c * spd + this.vel.x + (Math.random() - 0.5) * 8, -s * spd + this.vel.y + (Math.random() - 0.5) * 8, 2.5 + Math.random() * 2.5, 1.2 + Math.random() * 0.8);
        } else {
          const side = Math.random() < 0.5 ? -1 : 1;
          const p = toWorld(-hl + 6 + Math.random() * 10, side * (hw + 2));
          const spd = 20 + Math.random() * 20;
          this.particles.foam(p.x, p.y, c * spd * 0.5 - s * side * 10, s * spd * 0.5 + c * side * 10, 2 + Math.random() * 2, 0.9);
        }
      }
    }

    // Wake & bow wave
    const rate = Math.max(0, Math.abs(u) - 2) * 2.2 + Math.max(0, Math.abs(v) - 1.5) * 3.5;
    if (rate > 0) {
      this.wakeAcc += dt * rate;
      while (this.wakeAcc >= 1) {
        this.wakeAcc -= 1;
        if (Math.abs(u) > 2 && Math.random() < Math.abs(u) / (Math.abs(u) + Math.abs(v) * 2)) {
          if (u > 0) {
            const side = Math.random() < 0.5 ? -1 : 1;
            const p = toWorld(hl - 10 - Math.random() * 8, side * hw * 0.9);
            const sp = 6 + u * 0.35;
            this.particles.foam(p.x, p.y, -s * side * sp + this.vel.x * 0.3, c * side * sp + this.vel.y * 0.3, 1.8 + Math.random() * 2, 1 + Math.random() * 0.7);
          }
          const q = toWorld(-hl + Math.random() * 4, (Math.random() - 0.5) * hw * 1.6);
          this.particles.foam(q.x, q.y, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6, 2 + Math.random() * 3, 1.6 + Math.random() * 1.2);
        } else {
          const side = Math.sign(v) || 1;
          const p = toWorld(-hl + Math.random() * SHIP_L, side * hw);
          const sp = 5 + Math.abs(v) * 0.6;
          this.particles.foam(p.x, p.y, -s * side * sp, c * side * sp, 1.8 + Math.random() * 2.2, 0.9 + Math.random() * 0.7);
        }
      }
    }
  }

  // ───────────────────────── Camera ─────────────────────────

  private insets() {
    return { top: this.uiTop + 8, bottom: this.uiBottom + 8 };
  }

  private cameraTarget() {
    const ins = this.insets();
    const vw = this.w;
    const vh = Math.max(120, this.h - ins.top - ins.bottom);
    if (this.phase === "menu") {
      const zoom = clamp(Math.min(this.w, this.h) / 360, 0.8, 2);
      // keep the ship peeking out beside the menu panels
      const wide = vw > 900;
      return {
        x: this.pos.x + (wide ? 230 : 60) + Math.sin(this.time * 0.1) * 30,
        y: this.pos.y + (wide ? 90 : 150),
        zoom,
      };
    }
    const b = this.level.berth;
    const m = SHIP_L * 0.62;
    const quayTargetX = QUAY_X - SHIP_W / 2;
    const distToBerth = Math.hypot(this.pos.x - quayTargetX, this.pos.y - b.y);

    // Approach factor: 0 when far away (>300), 1 when close to berth (<=50)
    const isArrival = this.level.missionType !== "departure";
    const approach = isArrival ? clamp01(1 - (distToBerth - 50) / 250) : 0;

    const berthMinX = QUAY_X - SHIP_W - 25;
    const berthMaxX = QUAY_X + 30;
    const berthMinY = b.y - b.halfLen - 15;
    const berthMaxY = b.y + b.halfLen + 15;

    let minX = Math.min(this.pos.x - m, berthMinX);
    let maxX = Math.max(this.pos.x + m, berthMaxX);
    let minY = Math.min(this.pos.y - m, berthMinY);
    let maxY = Math.max(this.pos.y + m, berthMaxY);

    // Far buoys are excluded as ship approaches berth so camera zooms in close
    const buoyMaxDist = 340 * (1 - 0.85 * approach);
    for (const bu of this.buoys) {
      if (Math.hypot(bu.pos.x - this.pos.x, bu.pos.y - this.pos.y) < buoyMaxDist) {
        minX = Math.min(minX, bu.pos.x - 25);
        maxX = Math.max(maxX, bu.pos.x + 25);
        minY = Math.min(minY, bu.pos.y - 25);
        maxY = Math.max(maxY, bu.pos.y + 25);
      }
    }

    const pad = 38 - 18 * approach;
    const bw = maxX - minX + pad * 2;
    const bh = maxY - minY + pad * 2;
    const capMultiplier = 0.5 + 0.45 * approach;
    const zoomMax = Math.min(2.8, (capMultiplier * Math.min(vw, vh)) / (SHIP_L * 0.6));
    const zoom = clamp(Math.min(vw / bw, vh / bh), 0.42, Math.max(0.42, zoomMax));
    return { x: (minX + maxX) / 2, y: (minY + maxY) / 2, zoom };
  }

  // ───────────────────────── Render ─────────────────────────

  private vignetteCanvas: HTMLCanvasElement | null = null;
  private vignetteKey = "";

  /** Cached full-screen vignette (regenerated on resize) — avoids a radial gradient per frame. */
  private vignette(): HTMLCanvasElement {
    const vw = Math.max(1, Math.round(this.w / 2));
    const vh = Math.max(1, Math.round(this.h / 2));
    const key = `${vw}x${vh}`;
    if (!this.vignetteCanvas || this.vignetteKey !== key) {
      const c = document.createElement("canvas");
      c.width = vw;
      c.height = vh;
      const g = c.getContext("2d")!;
      const vg = g.createRadialGradient(vw / 2, vh / 2, Math.min(vw, vh) * 0.45, vw / 2, vh / 2, Math.max(vw, vh) * 0.75);
      vg.addColorStop(0, "rgba(0,0,0,0)");
      vg.addColorStop(1, "rgba(0,6,12,0.45)");
      g.fillStyle = vg;
      g.fillRect(0, 0, vw, vh);
      this.vignetteCanvas = c;
      this.vignetteKey = key;
    }
    return this.vignetteCanvas;
  }

  private render() {
    const ctx = this.ctx;
    const { w, h, dpr } = this;
    const ins = this.insets();
    const cx = w / 2;
    const cy = ins.top + (h - ins.top - ins.bottom) / 2;
    const zoom = this.cam.zoom;
    const pal = PALETTES[this.level.timeOfDay];

    const shakeAmp = this.trauma * this.trauma * 22;
    const t = this.time;
    const sx = shakeAmp * (Math.sin(t * 61.3) * 0.6 + Math.sin(t * 37.1) * 0.4);
    const sy = shakeAmp * (Math.cos(t * 53.7) * 0.6 + Math.sin(t * 43.9) * 0.4);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = pal.waterB;
    ctx.fillRect(0, 0, w, h);

    ctx.translate(cx + sx, cy + sy);
    ctx.scale(zoom, zoom);
    ctx.translate(-this.cam.x, -this.cam.y);

    const view: WorldView = {
      left: this.cam.x - (cx + 10) / zoom,
      right: this.cam.x + (w - cx + 10) / zoom,
      top: this.cam.y - (cy + 10) / zoom,
      bottom: this.cam.y + (h - cy + 10) / zoom,
      zoom,
    };

    const cur = this.currentAt(this.time);
    drawWater(ctx, view, this.time, cur, pal);
    drawCurrentLines(ctx, view, this.time, cur);
    drawRocks(ctx, this.level.rocks, this.time, pal, view);

    // Pilot area boundary limit line
    if (this.level.pilotBoundary) {
      drawPilotBoundary(ctx, this.level.pilotBoundary, this.time, view);
    }

    // Rendezvous zone for summoning standby tugs
    if (this.tugState === "standby" && this.level.rendezvous && (this.level.missionType === "arrival" || this.level.missionType === "tutorial")) {
      drawRendezvousZone(ctx, this.level.rendezvous, this.time, this.isInRendezvousRange());
    }

    // Departure fairway
    if (this.level.missionType === "departure" || (this.level.missionType === "tutorial" && this.tutorialStep >= 7)) {
      drawDepartureFairway(ctx, this.time, view, this.level.departureExit);
    }

    if (this.level.missionType === "arrival" || (this.level.missionType === "tutorial" && this.tutorialStep <= 6)) {
      drawBerthZone(ctx, this.level.berth, this.align.all ? "#57b98a" : "#6fb9c9", this.time);
    }
    drawQuayBase(ctx, this.level, view, this.time, pal);

    // Ghost target
    const ghostPos = { x: QUAY_X - SHIP_W / 2 - 1, y: this.level.berth.y };
    const ghostHeading = Math.abs(angleDiff(this.heading, -UP)) < Math.abs(angleDiff(this.heading, UP)) ? -UP : UP;
    const ghostPoly = transformPoly(HULL, ghostPos, ghostHeading);
    if (this.phase !== "menu" && !(this.phase === "levelClear") && (this.level.missionType === "arrival" || (this.level.missionType === "tutorial" && this.tutorialStep <= 6))) {
      const col = this.align.all ? "#57b98a" : this.align.pos ? "#f0a63c" : "#6fb9c9";
      drawGhost(ctx, ghostPoly, col, 0.55 + Math.sin(this.time * 4) * 0.15, this.time);
    }

    this.particles.drawUnder(ctx);

    // Moored neighbours
    for (const o of this.level.obstacles) {
      if (o.kind === "ship" && o.ship) drawShip(ctx, o.ship, { lights: pal.lights });
    }

    // Tow lines (only when attached)
    if (this.tugState === "attached") {
      const c = Math.cos(this.heading);
      const s = Math.sin(this.heading);
      for (const tg of this.tugs) {
        if (tg.effort * tg.side > 0.08 && !tg.waypoint) {
          const hx = tg.anchorX;
          const hy = tg.side * (SHIP_W / 2);
          const a = { x: this.pos.x + hx * c - hy * s, y: this.pos.y + hx * s + hy * c };
          const fx = Math.cos(tg.worldAngle);
          const fy = Math.sin(tg.worldAngle);
          const b = { x: tg.worldPos.x - fx * (TUG_L / 2 - 1), y: tg.worldPos.y - fy * (TUG_L / 2 - 1) };
          const slack = (1 - Math.abs(tg.effort)) * 5;
          ctx.strokeStyle = "#f3e4b8";
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.quadraticCurveTo((a.x + b.x) / 2 + c * slack, (a.y + b.y) / 2 + s * slack, b.x, b.y);
          ctx.stroke();
        }
      }
    }

    // Cargo ship
    this.shipVis.pos = this.pos;
    this.shipVis.heading = this.heading;
    const spd = Math.hypot(this.vel.x, this.vel.y);
    drawShip(ctx, this.shipVis, {
      speedFoam: Math.min(0.7, spd / 18),
      damage: 1 - this.hull / 100,
      lights: pal.lights,
      wrecked: this.wrecked,
      rudder: this.rudder,
    });

    // Tugs
    for (const tg of this.tugs) drawTug(ctx, tg.worldPos, tg.worldAngle, tg.effort, pal.lights);

    // Buoys
    for (const b of this.buoys) drawBuoy(ctx, b.pos, b.def.color, this.time, b.phase, pal.lights);

    // Mooring lines (drawn when secured/securing or when moored at berth)
    if (this.secure > 0.02 || this.mooringLinesAttached) {
      const hl = SHIP_L / 2;
      const c = Math.cos(this.heading);
      const s = Math.sin(this.heading);
      const from = [
        { lx: hl - 6, ly: SHIP_W / 2 - 1 },
        { lx: -hl + 6, ly: SHIP_W / 2 - 1 },
        { lx: hl - 30, ly: SHIP_W / 2 - 1 },
        { lx: -hl + 30, ly: SHIP_W / 2 - 1 },
      ].map((p) => {
        const ly = Math.sin(this.heading) < 0 ? p.ly : -p.ly; // starboard faces quay when heading up
        return { x: this.pos.x + p.lx * c - ly * s, y: this.pos.y + p.lx * s + ly * c };
      });
      const to = from.map((f, i) => ({ x: QUAY_X + 15, y: Math.round((f.y + (i % 2 === 0 ? -22 : 22)) / 36) * 36 }));
      const progress = this.mooringLinesAttached ? 1.0 : this.secure;
      drawMooringLines(ctx, from, to, progress);
    }

    drawCraneOverhead(ctx, this.level, view, this.time);
    this.particles.drawOver(ctx);

    // Securing ring
    if (this.secure > 0.02 && this.phase === "playing") {
      ctx.save();
      ctx.translate(this.pos.x, this.pos.y);
      ctx.strokeStyle = "rgba(255,255,255,0.25)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 30, 0, 6.2832);
      ctx.stroke();
      ctx.strokeStyle = "#57b98a";
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(0, 0, 30, -Math.PI / 2, -Math.PI / 2 + this.secure * 6.2832);
      ctx.stroke();
      ctx.restore();
    }

    // Floating texts (screen-space size)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const ft of this.texts) {
      const k = ft.t / ft.life;
      const px = cx + sx + (ft.x - this.cam.x) * zoom;
      const py = cy + sy + (ft.y - this.cam.y) * zoom - k * 46;
      const pop = k < 0.15 ? 0.6 + (k / 0.15) * 0.5 : 1.1 - (k - 0.15) * 0.12;
      ctx.globalAlpha = k > 0.6 ? 1 - (k - 0.6) / 0.4 : 1;
      ctx.font = `700 ${Math.round(ft.size * pop)}px Inter, Segoe UI, system-ui, sans-serif`;
      ctx.lineWidth = 4;
      ctx.strokeStyle = "rgba(0,12,20,0.75)";
      ctx.strokeText(ft.text, px, py);
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, px, py);
    }
    ctx.globalAlpha = 1;

    // Time-of-day tint + vignette + flash
    if (pal.overlay) {
      ctx.fillStyle = pal.overlay;
      ctx.fillRect(0, 0, w, h);
    }
    ctx.drawImage(this.vignette(), 0, 0, w, h);
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(${this.flashColor},${this.flash * 0.5})`;
      ctx.fillRect(0, 0, w, h);
    }
    if (this.phase === "playing" && this.timeLeft < 10 && this.introTimer <= 0) {
      const pulse = (Math.sin(this.time * 8) + 1) * 0.5;
      ctx.strokeStyle = `rgba(217,86,74,${0.25 + pulse * 0.35})`;
      ctx.lineWidth = 10;
      ctx.strokeRect(0, 0, w, h);
    }
  }
}
