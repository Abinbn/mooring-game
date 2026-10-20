import { QUAY_X, TUG_L, TUG_W } from "./constants";
import type { Berth, LevelDef, Obstacle, ShipVisual, TimeOfDay } from "./levels";
import { CONTAINER_COLORS } from "./constants";
import { hullPoly, rng, type Vec } from "./math";

export interface WorldView {
  left: number;
  right: number;
  top: number;
  bottom: number;
  zoom: number;
}

export interface Palette {
  waterA: string;
  waterB: string;
  quay: string;
  quayEdge: string;
  quayDark: string;
  rock: string;
  rockLight: string;
  overlay: string | null;
  lights: boolean;
}

export const PALETTES: Record<TimeOfDay, Palette> = {
  day: {
    waterA: "#1f86a0",
    waterB: "#0e5a72",
    quay: "#a6abb0",
    quayEdge: "#80878d",
    quayDark: "#6d747a",
    rock: "#6f7266",
    rockLight: "#8a8e80",
    overlay: null,
    lights: false,
  },
  dusk: {
    waterA: "#2f6f9a",
    waterB: "#153f60",
    quay: "#9b969e",
    quayEdge: "#75707a",
    quayDark: "#5f5a66",
    rock: "#6a655f",
    rockLight: "#857f78",
    overlay: "rgba(255,130,70,0.10)",
    lights: true,
  },
  night: {
    waterA: "#0f3a5a",
    waterB: "#071f33",
    quay: "#646c76",
    quayEdge: "#4b535c",
    quayDark: "#3b434b",
    rock: "#454943",
    rockLight: "#5a5f58",
    overlay: "rgba(4,10,40,0.30)",
    lights: true,
  },
};

const tileCache = new Map<string, CanvasPattern | null>();

function wavePattern(ctx: CanvasRenderingContext2D, seed: number, alpha: number): CanvasPattern | null {
  const key = `${seed}-${alpha}`;
  if (tileCache.has(key)) return tileCache.get(key)!;
  const size = 160;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const g = c.getContext("2d")!;
  const r = rng(seed);
  g.strokeStyle = `rgba(255,255,255,${alpha})`;
  g.lineWidth = 1.6;
  g.lineCap = "round";
  for (let i = 0; i < 11; i++) {
    const x = r() * size;
    const y = r() * size;
    const w = 6 + r() * 12;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + w * 0.5, y - 3 - r() * 3, x + w, y);
    g.stroke();
    // wrap copies for seamless tiling
    if (x + w > size) {
      g.beginPath();
      g.moveTo(x - size, y);
      g.quadraticCurveTo(x - size + w * 0.5, y - 4, x - size + w, y);
      g.stroke();
    }
  }
  const p = ctx.createPattern(c, "repeat");
  tileCache.set(key, p);
  return p;
}

export function drawWater(
  ctx: CanvasRenderingContext2D,
  view: WorldView,
  time: number,
  current: Vec,
  pal: Palette,
) {
  const { left, right, top, bottom } = view;
  const w = right - left;
  const h = bottom - top;
  const grad = ctx.createLinearGradient(0, top, 0, bottom);
  grad.addColorStop(0, pal.waterA);
  grad.addColorStop(1, pal.waterB);
  ctx.fillStyle = grad;
  ctx.fillRect(left, top, w, h);

  const p1 = wavePattern(ctx, 11, 0.1);
  const p2 = wavePattern(ctx, 23, 0.06);
  const ox1 = (time * (6 + current.x * 1.2)) % 160;
  const oy1 = (time * (3 + current.y * 1.2)) % 160;
  const ox2 = (time * (-4 + current.x * 1.2)) % 160;
  const oy2 = (time * (5 + current.y * 1.2)) % 160;
  if (p1) {
    ctx.save();
    ctx.translate(ox1, oy1);
    ctx.fillStyle = p1;
    ctx.fillRect(left - ox1 - 160, top - oy1 - 160, w + 320, h + 320);
    ctx.restore();
  }
  if (p2) {
    ctx.save();
    ctx.translate(ox2, oy2);
    ctx.fillStyle = p2;
    ctx.fillRect(left - ox2 - 160, top - oy2 - 160, w + 320, h + 320);
    ctx.restore();
  }

  // Depth shading along the quay face
  if (right > QUAY_X - 90) {
    const g2 = ctx.createLinearGradient(QUAY_X - 90, 0, QUAY_X, 0);
    g2.addColorStop(0, "rgba(0,0,0,0)");
    g2.addColorStop(1, "rgba(0,10,20,0.28)");
    ctx.fillStyle = g2;
    ctx.fillRect(QUAY_X - 90, top, 90, h);
  }
}

export function drawCurrentLines(ctx: CanvasRenderingContext2D, view: WorldView, time: number, current: Vec) {
  const mag = Math.hypot(current.x, current.y);
  if (mag < 0.3) return;
  const nx = current.x / mag;
  const ny = current.y / mag;
  const spacing = 110;
  const lenL = 10 + mag * 3;
  ctx.strokeStyle = "rgba(255,255,255,0.16)";
  ctx.lineWidth = 1.2;
  ctx.lineCap = "round";
  const x0 = Math.floor(view.left / spacing) * spacing;
  const y0 = Math.floor(view.top / spacing) * spacing;
  ctx.beginPath();
  for (let x = x0; x < view.right + spacing; x += spacing) {
    for (let y = y0; y < view.bottom + spacing; y += spacing) {
      const phase = ((x * 7 + y * 13) % 97) / 97;
      const t = (time * mag * 0.9 + phase * spacing) % spacing;
      const px = x + nx * t + ((y / spacing) % 2) * 40;
      const py = y + ny * t;
      if (px > QUAY_X - 12) continue;
      ctx.moveTo(px, py);
      ctx.lineTo(px + nx * lenL, py + ny * lenL);
    }
  }
  ctx.stroke();
}

export function drawRocks(ctx: CanvasRenderingContext2D, rocks: Obstacle[], time: number, pal: Palette, view: WorldView) {
  for (const r of rocks) {
    if (
      r.center.x + r.radius < view.left ||
      r.center.x - r.radius > view.right ||
      r.center.y + r.radius < view.top ||
      r.center.y - r.radius > view.bottom
    )
      continue;
    const p = r.poly;
    ctx.beginPath();
    ctx.moveTo(p[0].x, p[0].y);
    for (let i = 1; i < p.length; i++) ctx.lineTo(p[i].x, p[i].y);
    ctx.closePath();
    ctx.fillStyle = pal.rock;
    ctx.fill();
    // foam line
    ctx.save();
    ctx.setLineDash([14, 18]);
    ctx.lineDashOffset = -time * 18;
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
    // boulders
    const rr = rng(Math.floor(r.center.x * 3 + r.center.y));
    const minX = Math.min(...p.map((v) => v.x));
    const maxX = Math.max(...p.map((v) => v.x));
    const minY = Math.min(...p.map((v) => v.y));
    const maxY = Math.max(...p.map((v) => v.y));
    const count = Math.floor(((maxX - minX) * (maxY - minY)) / 2600);
    ctx.fillStyle = pal.rockLight;
    for (let i = 0; i < count; i++) {
      const x = minX + 6 + rr() * (maxX - minX - 12);
      const y = minY + 6 + rr() * (maxY - minY - 12);
      ctx.beginPath();
      ctx.arc(x, y, 3 + rr() * 6, 0, 6.2832);
      ctx.fill();
    }
  }
}

export function drawQuayBase(
  ctx: CanvasRenderingContext2D,
  level: LevelDef,
  view: WorldView,
  time: number,
  pal: Palette,
) {
  const berth = level.berth;
  const top = Math.max(view.top, -2600);
  const bottom = Math.min(view.bottom, 2600);
  if (view.right < QUAY_X) return;
  const h = bottom - top;

  // Concrete
  ctx.fillStyle = pal.quay;
  ctx.fillRect(QUAY_X, top, view.right - QUAY_X + 10, h);
  // Edge band + coping
  ctx.fillStyle = pal.quayEdge;
  ctx.fillRect(QUAY_X, top, 9, h);
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.fillRect(QUAY_X + 1.5, top, 1.4, h);
  // Crane rails
  ctx.fillStyle = pal.quayDark;
  ctx.fillRect(QUAY_X + 40, top, 1.6, h);
  ctx.fillRect(QUAY_X + 92, top, 1.6, h);
  // Road markings
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  const dashY0 = Math.floor(top / 30) * 30;
  for (let y = dashY0; y < bottom; y += 30) ctx.fillRect(QUAY_X + 66, y, 1.2, 14);

  // Berth zone highlight on the quay
  const bTop = berth.y - berth.halfLen;
  const bBot = berth.y + berth.halfLen;
  ctx.fillStyle = "rgba(56,225,255,0.10)";
  ctx.fillRect(QUAY_X, bTop, 36, bBot - bTop);
  ctx.fillStyle = "rgba(56,225,255,0.35)";
  ctx.fillRect(QUAY_X + 9, bTop, 2, bBot - bTop);

  // Hazard stripes at berth ends
  for (const yEnd of [bTop, bBot]) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(QUAY_X, yEnd - 9, 30, 18);
    ctx.clip();
    ctx.fillStyle = "#f6c343";
    ctx.fillRect(QUAY_X, yEnd - 9, 30, 18);
    ctx.fillStyle = "#1d1d1d";
    for (let i = -2; i < 6; i++) {
      ctx.beginPath();
      ctx.moveTo(QUAY_X + i * 8, yEnd - 9);
      ctx.lineTo(QUAY_X + i * 8 + 4, yEnd - 9);
      ctx.lineTo(QUAY_X + i * 8 + 4 + 18, yEnd + 9);
      ctx.lineTo(QUAY_X + i * 8 + 18, yEnd + 9);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  // Berth number painted on the quay
  ctx.save();
  ctx.translate(QUAY_X + 26, berth.y);
  ctx.rotate(Math.PI / 2);
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.font = "900 26px Rubik, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(level.berthNumber, 0, 0);
  ctx.restore();

  // Fenders along the whole quay (dense on the berth)
  ctx.fillStyle = "#1e2226";
  const fy0 = Math.floor(top / 13) * 13;
  for (let y = fy0; y < bottom; y += 13) {
    const onBerth = y > bTop && y < bBot;
    if (!onBerth && Math.round(y / 13) % 3 !== 0) continue;
    ctx.fillRect(QUAY_X - 3.2, y - 3.5, 3.4, 7);
  }

  // Bollards
  const by0 = Math.floor(top / 36) * 36;
  for (let y = by0; y < bottom; y += 36) {
    ctx.fillStyle = "#2f3539";
    ctx.beginPath();
    ctx.arc(QUAY_X + 15, y, 3.2, 0, 6.2832);
    ctx.fill();
    ctx.fillStyle = "#5c656b";
    ctx.beginPath();
    ctx.arc(QUAY_X + 15, y, 1.6, 0, 6.2832);
    ctx.fill();
  }

  // Containers
  for (const c of level.containers) {
    if (c.y + c.h < top || c.y > bottom || c.x > view.right) continue;
    ctx.fillStyle = c.color;
    ctx.fillRect(c.x, c.y, c.w, c.h);
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fillRect(c.x, c.y + c.h - 1.4, c.w, 1.4);
    ctx.fillRect(c.x + c.w - 1.2, c.y, 1.2, c.h);
  }

  // Warehouses
  const wy0 = Math.floor(top / 220) * 220;
  for (let y = wy0; y < bottom; y += 220) {
    if (QUAY_X + 300 > view.right) break;
    ctx.fillStyle = pal.quayDark;
    ctx.fillRect(QUAY_X + 300, y + 20, 130, 150);
    ctx.fillStyle = pal.quayEdge;
    ctx.fillRect(QUAY_X + 306, y + 26, 118, 138);
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fillRect(QUAY_X + 364, y + 26, 2, 138);
  }

  // Lamps (poles + glow at night)
  const ly0 = Math.floor(top / 150) * 150;
  for (let y = ly0; y < bottom; y += 150) {
    const lx = QUAY_X + 22;
    const ly = y + 75;
    if (pal.lights) {
      const g = ctx.createRadialGradient(lx, ly, 2, lx, ly, 70);
      g.addColorStop(0, "rgba(255,214,130,0.42)");
      g.addColorStop(1, "rgba(255,214,130,0)");
      ctx.fillStyle = g;
      ctx.fillRect(lx - 70, ly - 70, 140, 140);
    }
    ctx.fillStyle = pal.lights ? "#ffe6a8" : "#e9ecef";
    ctx.beginPath();
    ctx.arc(lx, ly, 1.8, 0, 6.2832);
    ctx.fill();
  }
  void time;
}

/** Crane boom (drawn above ships). */
export function drawCraneOverhead(ctx: CanvasRenderingContext2D, level: LevelDef, view: WorldView, time: number) {
  if (view.right < QUAY_X - 60) return;
  const cy = level.berth.y + level.berth.halfLen + 40;
  if (cy < view.top - 30 || cy > view.bottom + 30) return;
  const trolley = -10 + Math.sin(time * 0.35) * 26;
  // boom shadow on the water
  ctx.fillStyle = "rgba(0,10,20,0.18)";
  ctx.fillRect(QUAY_X - 52, cy + 6, 90, 7);
  // legs
  ctx.fillStyle = "#4a3a12";
  for (const [lx, ly] of [
    [QUAY_X + 38, cy - 10],
    [QUAY_X + 38, cy + 6],
    [QUAY_X + 90, cy - 10],
    [QUAY_X + 90, cy + 6],
  ]) ctx.fillRect(lx, ly, 4, 4);
  // body
  ctx.fillStyle = "#eab64a";
  ctx.fillRect(QUAY_X + 36, cy - 9, 60, 18);
  ctx.strokeStyle = "#7a5a14";
  ctx.lineWidth = 1;
  ctx.strokeRect(QUAY_X + 36, cy - 9, 60, 18);
  // boom
  ctx.fillStyle = "#eab64a";
  ctx.fillRect(QUAY_X - 52, cy - 3.5, 90, 7);
  ctx.strokeStyle = "#7a5a14";
  ctx.beginPath();
  for (let x = QUAY_X - 50; x < QUAY_X + 36; x += 8) {
    ctx.moveTo(x, cy - 3.5);
    ctx.lineTo(x + 4, cy + 3.5);
  }
  ctx.stroke();
  // trolley + spreader
  ctx.fillStyle = "#2b2b2b";
  ctx.fillRect(QUAY_X + trolley - 4, cy - 5, 8, 10);
  ctx.fillStyle = "#ff5d5d";
  ctx.fillRect(QUAY_X + trolley - 2.5, cy - 2, 5, 4);
  // cab
  ctx.fillStyle = "#1f2a33";
  ctx.fillRect(QUAY_X + 70, cy - 6, 10, 12);
}

export interface ShipDrawOpts {
  speedFoam?: number;
  damage?: number; // 0..1 (0 = pristine)
  lights?: boolean;
  wrecked?: boolean;
}

export function drawShip(ctx: CanvasRenderingContext2D, s: ShipVisual, opts: ShipDrawOpts = {}) {
  const { L, W } = s;
  const hull = hullPoly(L, W);
  ctx.save();
  ctx.translate(s.pos.x, s.pos.y);
  ctx.rotate(s.heading);

  const path = () => {
    ctx.beginPath();
    ctx.moveTo(hull[0].x, hull[0].y);
    for (let i = 1; i < hull.length; i++) ctx.lineTo(hull[i].x, hull[i].y);
    ctx.closePath();
  };

  // Shadow
  ctx.save();
  ctx.translate(2.5, 3.5);
  path();
  ctx.fillStyle = "rgba(0,8,16,0.32)";
  ctx.fill();
  ctx.restore();

  // Foam rim when moving
  if (opts.speedFoam && opts.speedFoam > 0.02) {
    ctx.save();
    path();
    ctx.strokeStyle = `rgba(255,255,255,${Math.min(0.7, opts.speedFoam)})`;
    ctx.lineWidth = 3.5;
    ctx.stroke();
    ctx.restore();
  }

  // Hull
  path();
  ctx.fillStyle = opts.wrecked ? "#4a3a3a" : s.hull;
  ctx.fill();
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = s.hullDark;
  ctx.stroke();

  // Deck
  const dx0 = -L * 0.47;
  const dx1 = L * 0.42;
  const dw = W * 0.74;
  ctx.fillStyle = opts.wrecked ? "#5a4a46" : s.deck;
  ctx.beginPath();
  ctx.moveTo(dx0, -dw / 2);
  ctx.lineTo(dx1 - L * 0.08, -dw / 2);
  ctx.lineTo(dx1, 0);
  ctx.lineTo(dx1 - L * 0.08, dw / 2);
  ctx.lineTo(dx0, dw / 2);
  ctx.closePath();
  ctx.fill();

  // Container bays
  if (s.containers > 0) {
    const r = rng(s.seed);
    const cols = 3;
    const cw = dw / cols;
    const rowLen = L * 0.105;
    const x0 = -L * 0.3;
    const x1 = L * 0.33;
    for (let x = x0; x + rowLen <= x1; x += rowLen) {
      for (let c = 0; c < cols; c++) {
        if (r() > s.containers) continue;
        const y = -dw / 2 + c * cw;
        ctx.fillStyle = CONTAINER_COLORS[Math.floor(r() * CONTAINER_COLORS.length)];
        ctx.fillRect(x + 0.6, y + 0.5, rowLen - 1.2, cw - 1);
        ctx.fillStyle = "rgba(0,0,0,0.22)";
        ctx.fillRect(x + 0.6, y + cw - 1.6, rowLen - 1.2, 1.1);
      }
    }
  } else {
    // hatch covers
    ctx.strokeStyle = "rgba(0,0,0,0.18)";
    ctx.lineWidth = 0.8;
    for (let x = -L * 0.3; x < L * 0.33; x += L * 0.105) {
      ctx.strokeRect(x + 0.6, -dw / 2 + 0.6, L * 0.105 - 1.2, dw - 1.2);
    }
  }

  // Superstructure (stern)
  const sx0 = -L * 0.465;
  const sx1 = -L * 0.33;
  const sw = W * 0.78;
  ctx.fillStyle = opts.wrecked ? "#8a8a8a" : "#f4f6f8";
  ctx.fillRect(sx0, -sw / 2, sx1 - sx0, sw);
  ctx.fillStyle = "#dfe4e8";
  ctx.fillRect(sx0 + 1.2, -sw / 2 + 1.2, sx1 - sx0 - 2.4, sw - 2.4);
  // bridge windows facing forward
  ctx.fillStyle = "#1b3340";
  ctx.fillRect(sx1 - 2, -sw / 2 + 1.5, 1.4, sw - 3);
  // funnel
  ctx.fillStyle = "#e4473b";
  ctx.fillRect(sx0 + 2, -2.2, 4.5, 4.4);
  ctx.fillStyle = "#1b1b1b";
  ctx.fillRect(sx0 + 2, -2.2, 1.2, 4.4);
  // bow details
  ctx.fillStyle = "rgba(255,255,255,0.65)";
  ctx.beginPath();
  ctx.arc(L * 0.41, 0, 1.4, 0, 6.2832);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.25)";
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(L * 0.36, -W * 0.3);
  ctx.lineTo(L * 0.36, W * 0.3);
  ctx.stroke();

  // Damage scuffs
  if (opts.damage && opts.damage > 0.05) {
    const r = rng(s.seed + 77);
    const n = Math.floor(opts.damage * 9);
    ctx.fillStyle = "rgba(20,10,8,0.55)";
    for (let i = 0; i < n; i++) {
      const x = -L * 0.45 + r() * L * 0.9;
      const side = r() < 0.5 ? -1 : 1;
      const y = side * (W / 2 - 1 - r() * 3);
      ctx.beginPath();
      ctx.ellipse(x, y, 2 + r() * 3, 1 + r() * 1.5, 0, 0, 6.2832);
      ctx.fill();
    }
  }

  // Navigation lights at night
  if (opts.lights) {
    ctx.fillStyle = "#ffe9a8";
    ctx.beginPath();
    ctx.arc(sx0 + 8, 0, 1.3, 0, 6.2832);
    ctx.fill();
    ctx.fillStyle = "#ff5d5d";
    ctx.beginPath();
    ctx.arc(L * 0.1, -W / 2 + 1, 0.9, 0, 6.2832);
    ctx.fill();
    ctx.fillStyle = "#3ef2a0";
    ctx.beginPath();
    ctx.arc(L * 0.1, W / 2 - 1, 0.9, 0, 6.2832);
    ctx.fill();
  }

  ctx.restore();
}

export function drawTug(ctx: CanvasRenderingContext2D, pos: Vec, angle: number, effort: number, lights: boolean) {
  const hl = TUG_L / 2;
  const hw = TUG_W / 2;
  ctx.save();
  ctx.translate(pos.x, pos.y);
  ctx.rotate(angle);

  const path = () => {
    ctx.beginPath();
    ctx.moveTo(-hl, -hw * 0.8);
    ctx.lineTo(-hl + 2, -hw);
    ctx.lineTo(hl - 5, -hw);
    ctx.quadraticCurveTo(hl, -hw, hl, 0);
    ctx.quadraticCurveTo(hl, hw, hl - 5, hw);
    ctx.lineTo(-hl + 2, hw);
    ctx.lineTo(-hl, hw * 0.8);
    ctx.closePath();
  };

  // shadow
  ctx.save();
  ctx.translate(1.5, 2.2);
  path();
  ctx.fillStyle = "rgba(0,8,16,0.3)";
  ctx.fill();
  ctx.restore();

  // wash foam rim when working
  if (Math.abs(effort) > 0.1) {
    path();
    ctx.strokeStyle = `rgba(255,255,255,${Math.min(0.75, Math.abs(effort) * 0.8)})`;
    ctx.lineWidth = 2.6;
    ctx.stroke();
  }

  // hull
  path();
  ctx.fillStyle = "#f6a21b";
  ctx.fill();
  ctx.strokeStyle = "#7a4a05";
  ctx.lineWidth = 1;
  ctx.stroke();

  // tyre bumper around the bow
  ctx.strokeStyle = "#1f2224";
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(hl - 5, -hw);
  ctx.quadraticCurveTo(hl, -hw, hl, 0);
  ctx.quadraticCurveTo(hl, hw, hl - 5, hw);
  ctx.stroke();
  // side tyres
  ctx.fillStyle = "#1f2224";
  for (const x of [-6, -1, 4]) {
    ctx.fillRect(x, -hw - 0.6, 2.2, 1.4);
    ctx.fillRect(x, hw - 0.8, 2.2, 1.4);
  }

  // deck + cabin
  ctx.fillStyle = "#ffd37a";
  ctx.fillRect(-hl + 2, -hw + 1.6, TUG_L - 7, TUG_W - 3.2);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(-4.5, -2.9, 6.5, 5.8);
  ctx.fillStyle = "#19323f";
  ctx.fillRect(1.2, -2.4, 1.1, 4.8);
  // funnel
  ctx.fillStyle = "#19323f";
  ctx.beginPath();
  ctx.arc(-6.5, 0, 1.4, 0, 6.2832);
  ctx.fill();

  if (lights) {
    ctx.fillStyle = "#ffe9a8";
    ctx.beginPath();
    ctx.arc(-1.5, 0, 0.9, 0, 6.2832);
    ctx.fill();
  }

  ctx.restore();
}

export function drawBuoy(ctx: CanvasRenderingContext2D, pos: Vec, color: string, time: number, phase: number, lights: boolean) {
  const bob = Math.sin(time * 2.2 + phase) * 0.6;
  const r = 4.2;
  ctx.save();
  ctx.translate(pos.x + bob * 0.5, pos.y + bob);
  // shadow
  ctx.fillStyle = "rgba(0,8,16,0.3)";
  ctx.beginPath();
  ctx.arc(1.5, 2, r, 0, 6.2832);
  ctx.fill();
  if (lights) {
    const g = ctx.createRadialGradient(0, 0, 1, 0, 0, 26);
    g.addColorStop(0, color === "#ff5d5d" ? "rgba(255,93,93,0.45)" : "rgba(62,242,160,0.45)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(-26, -26, 52, 52);
  }
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, 6.2832);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.62, 0, 6.2832);
  ctx.stroke();
  ctx.fillStyle = lights ? "#fff7cc" : "#1f2224";
  ctx.beginPath();
  ctx.arc(0, 0, 1.3, 0, 6.2832);
  ctx.fill();
  ctx.restore();
}

export function drawGhost(ctx: CanvasRenderingContext2D, poly: Vec[], color: string, alpha: number, time: number) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.moveTo(poly[0].x, poly[0].y);
  for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i].x, poly[i].y);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.globalAlpha = alpha * 0.18;
  ctx.fill();
  ctx.globalAlpha = alpha;
  ctx.setLineDash([7, 5]);
  ctx.lineDashOffset = -time * 14;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.8;
  ctx.stroke();
  ctx.restore();
}

export function drawBerthZone(ctx: CanvasRenderingContext2D, berth: Berth, color: string, time: number) {
  // Soft guide band on the water in front of the berth
  const x0 = QUAY_X - 70;
  const y0 = berth.y - berth.halfLen;
  const h = berth.halfLen * 2;
  const g = ctx.createLinearGradient(x0, 0, QUAY_X, 0);
  g.addColorStop(0, "rgba(56,225,255,0)");
  g.addColorStop(1, "rgba(56,225,255,0.14)");
  ctx.fillStyle = g;
  ctx.fillRect(x0, y0, QUAY_X - x0, h);
  // Chevrons pointing at the quay
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.35 + Math.sin(time * 3) * 0.1;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  for (let i = 0; i < 3; i++) {
    const x = QUAY_X - 46 + i * 11 + ((time * 10) % 11);
    const cy = berth.y;
    ctx.moveTo(x - 4, cy - 6);
    ctx.lineTo(x, cy);
    ctx.lineTo(x - 4, cy + 6);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
}

export function drawMooringLines(
  ctx: CanvasRenderingContext2D,
  from: Vec[],
  to: Vec[],
  progress: number,
) {
  ctx.strokeStyle = "#f3e4b8";
  ctx.lineWidth = 1.3;
  for (let i = 0; i < from.length; i++) {
    const a = from[i];
    const b = to[i];
    const t = Math.min(1, Math.max(0, progress * 1.3 - i * 0.12));
    if (t <= 0) continue;
    const ex = a.x + (b.x - a.x) * t;
    const ey = a.y + (b.y - a.y) * t;
    const sag = (1 - progress) * 6;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.quadraticCurveTo((a.x + ex) / 2, (a.y + ey) / 2 + sag, ex, ey);
    ctx.stroke();
  }
}
