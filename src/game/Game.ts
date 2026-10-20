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
  TUG_FORCE,
  TUG_L,
  TUG_RAMP,
  TUG_W,
} from "./constants";
import { makeLevel, type BuoyDef, type LevelDef, type ShipVisual } from "./levels";
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
  drawGhost,
  drawMooringLines,
  drawQuayBase,
  drawRocks,
  drawShip,
  drawTug,
  drawWater,
  type WorldView,
} from "./render";

export type Phase = "menu" | "playing" | "paused" | "levelClear" | "gameover";
export type Action = "ahead" | "astern" | "bowLeft" | "bowRight" | "sternLeft" | "sternRight";

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
}

export interface GameOverInfo {
  score: number;
  level: number;
  reason: "wrecked" | "timeout";
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
    this.loadLevel(1, true);
    this.resize();
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
    this.audio.silenceLoops();
  }

  // ───────────────────────── Public API ─────────────────────────

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.w = Math.max(1, rect.width);
    this.h = Math.max(1, rect.height);
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
  }

  setTouchMode(on: boolean) {
    this.touchMode = on;
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
  }

  restart() {
    this.startRun();
  }

  toMenu() {
    this.audio.silenceLoops();
    this.loadLevel(1, true);
    this.setPhase("menu");
  }

  pause() {
    if (this.phase !== "playing") return;
    this.audio.silenceLoops();
    this.setPhase("paused");
  }

  resume() {
    if (this.phase !== "paused") return;
    this.audio.ensure();
    this.last = performance.now();
    this.setPhase("playing");
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
      introTitle: `Berth ${this.level.berthNumber} · ${this.level.name}`,
      introTip: this.touchMode ? this.level.tipTouch : this.level.tipKeys,
      current: this.currentAt(this.time),
      telegraph,
      speed: spd,
      muted: this.audio.muted,
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
        worldPos: { x: 0, y: 0 },
        worldAngle: 0,
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
    this.loadLevel(this.levelIndex + 1, false);
    this.setPhase("playing");
    this.audio.horn(false);
  }

  // ───────────────────────── Input ─────────────────────────

  private onKeyDown = (e: KeyboardEvent) => {
    const el = document.activeElement;
    if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) return;
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

    // Commands
    if (playing) {
      this.throttleTarget = this.input.ahead ? 1 : this.input.astern ? -1 : 0;
      this.tugs[0].cmd = (this.input.bowRight ? 1 : 0) - (this.input.bowLeft ? 1 : 0);
      this.tugs[1].cmd = (this.input.sternRight ? 1 : 0) - (this.input.sternLeft ? 1 : 0);
    } else {
      this.throttleTarget = 0;
      this.tugs[0].cmd = 0;
      this.tugs[1].cmd = 0;
    }
    this.throttle = damp(this.throttle, this.throttleTarget, ENGINE_RAMP, dt);
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

    if (playing && this.introTimer <= 0) this.checkMooring(dt);
    else if (this.phase !== "levelClear") this.secure = 0;
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
    this.scrapeLevel = damp(this.scrapeLevel, clamp01((scraping - 2.5) / 10), 10, dt);
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
        this.addScore(75, point, "SOFT TOUCH +75", "#3ef2a0", 15);
      }
    }
  }

  private applyDamage(dmg: number, point: Vec | null) {
    if (dmg <= 0 || this.wrecked) return;
    this.hull -= dmg;
    this.levelDamage += dmg;
    if (point && dmg >= 1) {
      this.addText(point.x, point.y, `-${Math.round(dmg)} HULL`, "#ff5d5d", dmg > 15 ? 20 : 15);
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
    this.addText(this.pos.x, this.pos.y - 30, "HULL BREACH!", "#ff5d5d", 28);
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
            this.addText(b.pos.x, b.pos.y - 10, "BUOY!", "#ffb340", 13);
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
      if (this.secure >= 1) this.moor(aErr);
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
    this.levelClearTimer = 3.4;

    this.audio.success();
    this.audio.horn(true);
    if (isPerfect) this.audio.perfect();
    this.particles.confetti(this.pos.x, this.pos.y, 110, 110);
    this.particles.ripple(this.pos.x, this.pos.y, 10, 2);
    this.addText(this.pos.x - 10, this.pos.y - SHIP_W, "MOORED!", "#3ef2a0", 34);
    if (isPerfect) this.addText(this.pos.x - 10, this.pos.y + SHIP_W + 6, "PERFECT BERTHING", "#ffb340", 20);
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

  private gameOver(reason: "wrecked" | "timeout") {
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
    this.trauma = Math.max(0, this.trauma - dt * 1.6);
    this.flash = Math.max(0, this.flash - dt * 2.5);

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
    return { top: 64, bottom: this.touchMode ? 196 : 28 };
  }

  private cameraTarget() {
    const ins = this.insets();
    const vw = this.w;
    const vh = Math.max(120, this.h - ins.top - ins.bottom);
    if (this.phase === "menu") {
      const zoom = clamp(Math.min(vw, vh) / 360, 0.8, 2);
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
    let minX = Math.min(this.pos.x - m, QUAY_X - SHIP_W - 70);
    let maxX = Math.max(this.pos.x + m, QUAY_X + 30);
    let minY = Math.min(this.pos.y - m, b.y - m);
    let maxY = Math.max(this.pos.y + m, b.y + m);
    for (const bu of this.buoys) {
      if (Math.hypot(bu.pos.x - this.pos.x, bu.pos.y - this.pos.y) < 340) {
        minX = Math.min(minX, bu.pos.x - 30);
        maxX = Math.max(maxX, bu.pos.x + 30);
        minY = Math.min(minY, bu.pos.y - 30);
        maxY = Math.max(maxY, bu.pos.y + 30);
      }
    }
    const pad = 40;
    const bw = maxX - minX + pad * 2;
    const bh = maxY - minY + pad * 2;
    const zoomMax = Math.min(3.1, (0.5 * Math.min(vw, vh)) / SHIP_L);
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
    drawBerthZone(ctx, this.level.berth, this.align.all ? "#3ef2a0" : "#38e1ff", this.time);
    drawQuayBase(ctx, this.level, view, this.time, pal);

    // Ghost target
    const ghostPos = { x: QUAY_X - SHIP_W / 2 - 1, y: this.level.berth.y };
    const ghostHeading = Math.abs(angleDiff(this.heading, -UP)) < Math.abs(angleDiff(this.heading, UP)) ? -UP : UP;
    const ghostPoly = transformPoly(HULL, ghostPos, ghostHeading);
    if (this.phase !== "menu" && !(this.phase === "levelClear")) {
      const col = this.align.all ? "#3ef2a0" : this.align.pos ? "#ffb340" : "#38e1ff";
      drawGhost(ctx, ghostPoly, col, 0.55 + Math.sin(this.time * 4) * 0.15, this.time);
    }

    this.particles.drawUnder(ctx);

    // Moored neighbours
    for (const o of this.level.obstacles) {
      if (o.kind === "ship" && o.ship) drawShip(ctx, o.ship, { lights: pal.lights });
    }

    // Tow lines
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

    // Cargo ship
    this.shipVis.pos = this.pos;
    this.shipVis.heading = this.heading;
    const spd = Math.hypot(this.vel.x, this.vel.y);
    drawShip(ctx, this.shipVis, {
      speedFoam: Math.min(0.7, spd / 18),
      damage: 1 - this.hull / 100,
      lights: pal.lights,
      wrecked: this.wrecked,
    });

    // Tugs
    for (const tg of this.tugs) drawTug(ctx, tg.worldPos, tg.worldAngle, tg.effort, pal.lights);

    // Buoys
    for (const b of this.buoys) drawBuoy(ctx, b.pos, b.def.color, this.time, b.phase, pal.lights);

    // Mooring lines
    if (this.secure > 0.02) {
      const hl = SHIP_L / 2;
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
      drawMooringLines(ctx, from, to, this.secure);
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
      ctx.strokeStyle = "#3ef2a0";
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
      ctx.font = `900 ${Math.round(ft.size * pop)}px Rubik, system-ui, sans-serif`;
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
      ctx.strokeStyle = `rgba(255,93,93,${0.25 + pulse * 0.35})`;
      ctx.lineWidth = 10;
      ctx.strokeRect(0, 0, w, h);
    }
  }
}
