/** Tiny procedural audio engine built on Web Audio — no external assets. */

const MUTE_KEY = "dsa_muted";

export class AudioSys {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private engineGain: GainNode | null = null;
  private engineOsc: OscillatorNode | null = null;
  private engineOsc2: OscillatorNode | null = null;
  private tugGain: GainNode | null = null;
  private scrapeGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private lastEngine = -1;
  private lastTug = -1;
  private lastScrape = -1;
  muted = false;

  constructor() {
    try {
      this.muted = localStorage.getItem(MUTE_KEY) === "1";
    } catch {
      this.muted = false;
    }
  }

  /** Must be called from a user gesture. Safe to call repeatedly. */
  /**
   * Every call site of `ensure()` is a user action (start, button, horn), so it
   * also lifts a pause-hold. Merely reading the graph never calls it.
   */
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
      return;
    }
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      this.ctx = ctx;
      const master = ctx.createGain();
      master.gain.value = this.muted ? 0 : 0.8;
      master.connect(ctx.destination);
      this.master = master;

      // Noise buffer
      const len = ctx.sampleRate * 2;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this.noiseBuffer = buf;

      // Engine rumble
      const eg = ctx.createGain();
      eg.gain.value = 0;
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 180;
      const o1 = ctx.createOscillator();
      o1.type = "sawtooth";
      o1.frequency.value = 42;
      const o2 = ctx.createOscillator();
      o2.type = "square";
      o2.frequency.value = 43.3;
      const o2g = ctx.createGain();
      o2g.gain.value = 0.35;
      o1.connect(lp);
      o2.connect(o2g).connect(lp);
      lp.connect(eg).connect(master);
      o1.start();
      o2.start();
      this.engineGain = eg;
      this.engineOsc = o1;
      this.engineOsc2 = o2;

      // Tug wash (filtered noise)
      const tg = ctx.createGain();
      tg.gain.value = 0;
      const tn = ctx.createBufferSource();
      tn.buffer = buf;
      tn.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 500;
      bp.Q.value = 0.6;
      tn.connect(bp).connect(tg).connect(master);
      tn.start();
      this.tugGain = tg;

      // Scrape
      const sg = ctx.createGain();
      sg.gain.value = 0;
      const sn = ctx.createBufferSource();
      sn.buffer = buf;
      sn.loop = true;
      const sbp = ctx.createBiquadFilter();
      sbp.type = "bandpass";
      sbp.frequency.value = 1800;
      sbp.Q.value = 2.5;
      sn.connect(sbp).connect(sg).connect(master);
      sn.start();
      this.scrapeGain = sg;
    } catch {
      this.ctx = null;
    }
  }

  setMuted(m: boolean) {
    this.muted = m;
    try {
      localStorage.setItem(MUTE_KEY, m ? "1" : "0");
    } catch {
      /* ignore */
    }
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(m ? 0 : 0.8, this.ctx.currentTime, 0.05);
    }
  }

  toggleMuted() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  /**
   * Stop everything, engine and one-shots alike. Suspending the context is the
   * only way to silence a horn or a collision tone that is already ringing, and
   * it also frees the audio device while the game is paused.
   */
  suspend() {
    this.silenceLoops();
    try {
      void this.ctx?.suspend();
    } catch {
      /* already suspended or closed */
    }
  }

  /** Wake the graph again after a pause. Safe when nothing is playing. */
  resume() {
    if (!this.ctx) {
      this.ensure();
      return;
    }
    try {
      if (this.ctx.state === "suspended") void this.ctx.resume();
    } catch {
      /* ignore */
    }
  }

  /** Release the audio graph (React unmount / hot reload). */
  dispose() {
    this.silenceLoops();
    try {
      this.engineOsc?.stop();
      this.engineOsc2?.stop();
    } catch {
      /* already stopped */
    }
    try {
      this.ctx?.close();
    } catch {
      /* already closed */
    }
    this.ctx = null;
    this.master = null;
    this.engineGain = null;
    this.engineOsc = null;
    this.engineOsc2 = null;
    this.tugGain = null;
    this.scrapeGain = null;
    this.noiseBuffer = null;
    this.lastEngine = -1;
    this.lastTug = -1;
    this.lastScrape = -1;
  }

  /** Continuous engine/tug levels (0..1). Cheap to call every frame. */
  setLoops(engine: number, tug: number, scrape: number) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (Math.abs(engine - this.lastEngine) > 0.01) {
      this.lastEngine = engine;
      this.engineGain?.gain.setTargetAtTime(engine * 0.22, t, 0.12);
      this.engineOsc?.frequency.setTargetAtTime(42 + engine * 22, t, 0.3);
      this.engineOsc2?.frequency.setTargetAtTime(43.3 + engine * 22, t, 0.3);
    }
    if (Math.abs(tug - this.lastTug) > 0.01) {
      this.lastTug = tug;
      this.tugGain?.gain.setTargetAtTime(tug * 0.16, t, 0.1);
    }
    if (Math.abs(scrape - this.lastScrape) > 0.01) {
      this.lastScrape = scrape;
      this.scrapeGain?.gain.setTargetAtTime(scrape * 0.12, t, 0.05);
    }
  }

  silenceLoops() {
    this.setLoops(0, 0, 0);
  }

  private tone(
    freq: number,
    type: OscillatorType,
    start: number,
    dur: number,
    vol: number,
    opts: { attack?: number; freqEnd?: number; filter?: number } = {},
  ) {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + start;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (opts.freqEnd) o.frequency.exponentialRampToValueAtTime(opts.freqEnd, t0 + dur);
    const g = ctx.createGain();
    const a = opts.attack ?? 0.005;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    let node: AudioNode = o;
    if (opts.filter) {
      const f = ctx.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = opts.filter;
      o.connect(f);
      node = f;
    }
    node.connect(g).connect(this.master);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  private noiseBurst(start: number, dur: number, vol: number, filterFreq: number, type: BiquadFilterType = "lowpass") {
    if (!this.ctx || !this.master || !this.noiseBuffer) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + start;
    const s = ctx.createBufferSource();
    s.buffer = this.noiseBuffer;
    s.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = filterFreq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f).connect(g).connect(this.master);
    s.start(t0);
    s.stop(t0 + dur + 0.05);
  }

  thud(intensity: number) {
    const v = Math.min(1, intensity);
    this.tone(95, "sine", 0, 0.3 + v * 0.2, 0.5 * v + 0.08, { freqEnd: 38 });
    this.noiseBurst(0, 0.12 + v * 0.15, 0.3 * v + 0.05, 350 + v * 500);
    if (v > 0.5) this.tone(60, "triangle", 0.02, 0.4, 0.3 * v, { freqEnd: 30 });
  }

  bump() {
    this.tone(120, "sine", 0, 0.18, 0.18, { freqEnd: 60 });
    this.noiseBurst(0, 0.08, 0.06, 600);
  }

  horn(long = false) {
    const d = long ? 1.5 : 0.75;
    this.tone(104, "sawtooth", 0, d, 0.16, { attack: 0.06, filter: 520 });
    this.tone(104.8, "sawtooth", 0, d, 0.16, { attack: 0.06, filter: 520 });
    this.tone(52, "square", 0, d, 0.1, { attack: 0.08, filter: 300 });
    this.tone(156, "sawtooth", 0, d, 0.05, { attack: 0.1, filter: 700 });
  }

  shipHorn() {
    this.ensure();
    const d = 1.25;
    this.tone(96, "sawtooth", 0, d, 0.22, { attack: 0.08, filter: 460 });
    this.tone(97.2, "sawtooth", 0, d, 0.22, { attack: 0.08, filter: 460 });
    this.tone(48, "sine", 0, d + 0.15, 0.18, { attack: 0.1, filter: 220 });
    this.tone(144, "sawtooth", 0.02, d * 0.9, 0.08, { attack: 0.12, filter: 650 });
    this.noiseBurst(0, 0.35, 0.06, 800, "bandpass");
  }

  tugToot(pitchOffset = 0) {
    this.ensure();
    const base = 380 + pitchOffset;
    this.tone(base, "square", 0, 0.16, 0.09, { attack: 0.015, filter: 1400 });
    this.tone(base * 1.5, "sawtooth", 0.01, 0.14, 0.04, { attack: 0.02, filter: 1800 });
  }

  tick(i: number) {
    this.tone(880 + i * 180, "sine", 0, 0.08, 0.14);
    this.tone(1760 + i * 180, "sine", 0, 0.05, 0.05);
  }

  success() {
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    notes.forEach((f, i) => {
      this.tone(f, "sine", i * 0.09, 0.6, 0.2);
      this.tone(f * 2, "triangle", i * 0.09, 0.3, 0.05);
    });
    // bell
    this.tone(1567.98, "sine", 0.5, 1.4, 0.12);
    this.tone(1567.98 * 2.76, "sine", 0.5, 0.6, 0.04);
  }

  perfect() {
    const notes = [783.99, 987.77, 1174.66, 1567.98];
    notes.forEach((f, i) => this.tone(f, "square", 0.55 + i * 0.07, 0.35, 0.06, { filter: 3000 }));
  }

  countdown(final = false) {
    this.tone(final ? 1320 : 880, "square", 0, final ? 0.35 : 0.09, 0.07, { filter: 2500 });
  }

  gameOver() {
    const notes = [220, 185, 147, 110];
    notes.forEach((f, i) => this.tone(f, "sawtooth", i * 0.28, 0.5, 0.14, { attack: 0.02, filter: 900 }));
    this.noiseBurst(0, 1.2, 0.12, 200);
  }

  wreck() {
    this.tone(70, "sine", 0, 1.1, 0.6, { freqEnd: 25 });
    this.noiseBurst(0, 0.9, 0.4, 500);
    this.noiseBurst(0.1, 1.5, 0.15, 150);
  }

  click() {
    this.tone(640, "sine", 0, 0.05, 0.08);
    this.tone(960, "sine", 0.02, 0.04, 0.05);
  }

  splash() {
    this.noiseBurst(0, 0.25, 0.08, 1200, "highpass");
  }
}
