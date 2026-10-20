import { MAX_PARTICLES } from "./constants";

export enum PKind {
  Foam = 0,
  Spark = 1,
  Confetti = 2,
  Smoke = 3,
  Ripple = 4,
  Debris = 5,
  Spray = 6,
}

export interface Particle {
  kind: PKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  rot: number;
  rotV: number;
  drag: number;
  color: string;
  grow: number;
}

const CONFETTI = ["#ff5d5d", "#ffb340", "#3ef2a0", "#38e1ff", "#ffffff", "#c77dff", "#ffe66d"];

export class ParticleSystem {
  list: Particle[] = [];
  private cursor = 0;

  clear() {
    this.list.length = 0;
    this.cursor = 0;
  }

  spawn(p: Particle) {
    if (this.list.length < MAX_PARTICLES) {
      this.list.push(p);
    } else {
      this.list[this.cursor] = p;
      this.cursor = (this.cursor + 1) % MAX_PARTICLES;
    }
  }

  foam(x: number, y: number, vx: number, vy: number, size = 2.5, life = 1.2) {
    this.spawn({
      kind: PKind.Foam,
      x,
      y,
      vx,
      vy,
      life,
      maxLife: life,
      size,
      rot: 0,
      rotV: 0,
      drag: 1.6,
      color: "#ffffff",
      grow: 1.8,
    });
  }

  spray(x: number, y: number, vx: number, vy: number, size = 1.6, life = 0.6) {
    this.spawn({
      kind: PKind.Spray,
      x,
      y,
      vx,
      vy,
      life,
      maxLife: life,
      size,
      rot: 0,
      rotV: 0,
      drag: 2.5,
      color: "#eafdff",
      grow: 0.6,
    });
  }

  spark(x: number, y: number, vx: number, vy: number) {
    const life = 0.25 + Math.random() * 0.35;
    this.spawn({
      kind: PKind.Spark,
      x,
      y,
      vx,
      vy,
      life,
      maxLife: life,
      size: 1.2 + Math.random() * 1.2,
      rot: 0,
      rotV: 0,
      drag: 3,
      color: Math.random() < 0.5 ? "#ffd166" : "#ff8c42",
      grow: 0,
    });
  }

  debris(x: number, y: number, vx: number, vy: number, color = "#3a2a22") {
    const life = 0.8 + Math.random() * 0.8;
    this.spawn({
      kind: PKind.Debris,
      x,
      y,
      vx,
      vy,
      life,
      maxLife: life,
      size: 1.5 + Math.random() * 2,
      rot: Math.random() * 6.28,
      rotV: (Math.random() - 0.5) * 12,
      drag: 2.2,
      color,
      grow: 0,
    });
  }

  smoke(x: number, y: number, vx: number, vy: number, size = 3, color = "rgba(60,60,70,1)") {
    const life = 1.2 + Math.random() * 1;
    this.spawn({
      kind: PKind.Smoke,
      x,
      y,
      vx,
      vy,
      life,
      maxLife: life,
      size,
      rot: 0,
      rotV: 0,
      drag: 0.8,
      color,
      grow: 4,
    });
  }

  steamPuff(x: number, y: number, vx = 0, vy = 0, count = 16) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 6 + Math.random() * 18;
      const life = 0.9 + Math.random() * 0.9;
      this.spawn({
        kind: PKind.Smoke,
        x: x + (Math.random() - 0.5) * 4,
        y: y + (Math.random() - 0.5) * 4,
        vx: vx * 0.3 + Math.cos(a) * spd,
        vy: vy * 0.3 + Math.sin(a) * spd - 10,
        life,
        maxLife: life,
        size: 3 + Math.random() * 3.5,
        rot: 0,
        rotV: 0,
        drag: 1.2,
        color: "rgba(245, 250, 255, 0.85)",
        grow: 14,
      });
    }
  }

  hornShockwaves(x: number, y: number) {
    this.ripple(x, y, 8, 1.8);
    this.ripple(x, y, 20, 1.5);
    this.ripple(x, y, 32, 1.3);
  }

  ripple(x: number, y: number, size = 4, life = 1.4) {
    this.spawn({
      kind: PKind.Ripple,
      x,
      y,
      vx: 0,
      vy: 0,
      life,
      maxLife: life,
      size,
      rot: 0,
      rotV: 0,
      drag: 0,
      color: "#ffffff",
      grow: 22,
    });
  }

  confetti(x: number, y: number, count = 60, speed = 90) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.35 + Math.random() * 0.65);
      const life = 1.6 + Math.random() * 1.2;
      this.spawn({
        kind: PKind.Confetti,
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - speed * 0.3,
        life,
        maxLife: life,
        size: 2 + Math.random() * 2.2,
        rot: Math.random() * 6.28,
        rotV: (Math.random() - 0.5) * 16,
        drag: 1.4,
        color: CONFETTI[Math.floor(Math.random() * CONFETTI.length)],
        grow: 0,
      });
    }
  }

  burst(x: number, y: number, kind: "foam" | "spark" | "debris", count: number, speed: number, nx = 0, ny = 0) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.3 + Math.random() * 0.7);
      const vx = Math.cos(a) * s + nx * speed * 0.6;
      const vy = Math.sin(a) * s + ny * speed * 0.6;
      if (kind === "foam") this.foam(x, y, vx, vy, 2 + Math.random() * 2.5, 0.8 + Math.random() * 0.6);
      else if (kind === "spark") this.spark(x, y, vx, vy);
      else this.debris(x, y, vx, vy);
    }
  }

  update(dt: number, currentX: number, currentY: number) {
    const list = this.list;
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      p.life -= dt;
      if (p.life <= 0) {
        const last = list.pop()!;
        if (i < list.length) list[i] = last;
        if (this.cursor >= list.length) this.cursor = 0;
        continue;
      }
      const k = Math.exp(-p.drag * dt);
      p.vx *= k;
      p.vy *= k;
      if (p.kind === PKind.Confetti) {
        p.vy += 60 * dt;
      } else if (p.kind === PKind.Foam || p.kind === PKind.Ripple || p.kind === PKind.Debris) {
        p.x += currentX * dt;
        p.y += currentY * dt;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.rotV * dt;
      p.size += p.grow * dt;
    }
  }

  /** Draw particles that sit on the water (under ships). */
  drawUnder(ctx: CanvasRenderingContext2D) {
    const list = this.list;
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      const t = p.life / p.maxLife;
      if (p.kind === PKind.Foam) {
        ctx.globalAlpha = t * 0.55;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, 6.2832);
        ctx.fill();
      } else if (p.kind === PKind.Ripple) {
        ctx.globalAlpha = t * 0.5;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, 6.2832);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  /** Draw particles that fly above everything. */
  drawOver(ctx: CanvasRenderingContext2D) {
    const list = this.list;
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      const t = p.life / p.maxLife;
      switch (p.kind) {
        case PKind.Spray: {
          ctx.globalAlpha = t * 0.85;
          ctx.fillStyle = p.color;
          ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
          break;
        }
        case PKind.Spark: {
          ctx.globalAlpha = Math.min(1, t * 1.5);
          ctx.strokeStyle = p.color;
          ctx.lineWidth = p.size;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04);
          ctx.stroke();
          break;
        }
        case PKind.Confetti: {
          ctx.globalAlpha = Math.min(1, t * 2);
          ctx.fillStyle = p.color;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
          ctx.restore();
          break;
        }
        case PKind.Debris: {
          ctx.globalAlpha = Math.min(1, t * 2);
          ctx.fillStyle = p.color;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.7);
          ctx.restore();
          break;
        }
        case PKind.Smoke: {
          ctx.globalAlpha = t * 0.35;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, 6.2832);
          ctx.fill();
          break;
        }
        default:
          break;
      }
    }
    ctx.globalAlpha = 1;
  }
}
