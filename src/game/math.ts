export interface Vec {
  x: number;
  y: number;
}

export const vec = (x = 0, y = 0): Vec => ({ x, y });
export const add = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y });
export const scale = (a: Vec, s: number): Vec => ({ x: a.x * s, y: a.y * s });
export const dot = (a: Vec, b: Vec): number => a.x * b.x + a.y * b.y;
export const cross = (a: Vec, b: Vec): number => a.x * b.y - a.y * b.x;
export const len = (a: Vec): number => Math.hypot(a.x, a.y);
export const norm = (a: Vec): Vec => {
  const l = Math.hypot(a.x, a.y) || 1;
  return { x: a.x / l, y: a.y / l };
};
export const perp = (a: Vec): Vec => ({ x: -a.y, y: a.x });
export const rot = (a: Vec, ang: number): Vec => {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  return { x: a.x * c - a.y * s, y: a.x * s + a.y * c };
};
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
export const clamp01 = (x: number) => clamp(x, 0, 1);
export const damp = (a: number, b: number, rate: number, dt: number) =>
  a + (b - a) * (1 - Math.exp(-rate * dt));
export const TAU = Math.PI * 2;
export const rad = (deg: number) => (deg * Math.PI) / 180;
export const deg = (r: number) => (r * 180) / Math.PI;

export const angleDiff = (from: number, to: number) => {
  let d = (to - from) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
};

export const dampAngle = (a: number, b: number, rate: number, dt: number) =>
  a + angleDiff(a, b) * (1 - Math.exp(-rate * dt));

export const randRange = (lo: number, hi: number) => lo + Math.random() * (hi - lo);
export const pick = <T>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

/** Deterministic PRNG (mulberry32) */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function transformPoly(local: Vec[], pos: Vec, ang: number): Vec[] {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  const out: Vec[] = new Array(local.length);
  for (let i = 0; i < local.length; i++) {
    const p = local[i];
    out[i] = { x: pos.x + p.x * c - p.y * s, y: pos.y + p.x * s + p.y * c };
  }
  return out;
}

export function polyCentroid(p: Vec[]): Vec {
  let x = 0;
  let y = 0;
  for (const v of p) {
    x += v.x;
    y += v.y;
  }
  return { x: x / p.length, y: y / p.length };
}

export function polyRadius(p: Vec[], c: Vec): number {
  let r = 0;
  for (const v of p) r = Math.max(r, Math.hypot(v.x - c.x, v.y - c.y));
  return r;
}

export function rectPoly(cx: number, cy: number, hw: number, hh: number): Vec[] {
  return [
    { x: cx - hw, y: cy - hh },
    { x: cx + hw, y: cy - hh },
    { x: cx + hw, y: cy + hh },
    { x: cx - hw, y: cy + hh },
  ];
}

/** Ship hull outline in local coords: +x forward, +y starboard. Convex. */
export function hullPoly(L: number, W: number): Vec[] {
  const hl = L / 2;
  const hw = W / 2;
  return [
    { x: -hl, y: -hw * 0.86 },
    { x: -hl + L * 0.05, y: -hw },
    { x: hl - L * 0.24, y: -hw },
    { x: hl - L * 0.09, y: -hw * 0.62 },
    { x: hl, y: 0 },
    { x: hl - L * 0.09, y: hw * 0.62 },
    { x: hl - L * 0.24, y: hw },
    { x: -hl + L * 0.05, y: hw },
    { x: -hl, y: hw * 0.86 },
  ];
}

export interface Contact {
  normal: Vec; // points from B into A (direction to push A out)
  depth: number;
  point: Vec;
}

function projectPoly(p: Vec[], axis: Vec): [number, number] {
  let mn = Infinity;
  let mx = -Infinity;
  for (const v of p) {
    const d = v.x * axis.x + v.y * axis.y;
    if (d < mn) mn = d;
    if (d > mx) mx = d;
  }
  return [mn, mx];
}

function supportPoints(p: Vec[], dir: Vec, tol: number): Vec {
  let best = -Infinity;
  for (const v of p) {
    const d = v.x * dir.x + v.y * dir.y;
    if (d > best) best = d;
  }
  let sx = 0;
  let sy = 0;
  let n = 0;
  for (const v of p) {
    const d = v.x * dir.x + v.y * dir.y;
    if (d >= best - tol) {
      sx += v.x;
      sy += v.y;
      n++;
    }
  }
  return { x: sx / n, y: sy / n };
}

/** Separating Axis Theorem for two convex polygons. Returns contact to push A out of B. */
export function satPolygons(A: Vec[], B: Vec[]): Contact | null {
  let minDepth = Infinity;
  let minAxis: Vec | null = null;
  let axisFromA = true;

  const test = (poly: Vec[], fromA: boolean): boolean => {
    for (let i = 0; i < poly.length; i++) {
      const p1 = poly[i];
      const p2 = poly[(i + 1) % poly.length];
      const ex = p2.x - p1.x;
      const ey = p2.y - p1.y;
      const l = Math.hypot(ex, ey) || 1;
      const axis = { x: -ey / l, y: ex / l };
      const [a0, a1] = projectPoly(A, axis);
      const [b0, b1] = projectPoly(B, axis);
      const overlap = Math.min(a1, b1) - Math.max(a0, b0);
      if (overlap <= 0) return false;
      if (overlap < minDepth) {
        minDepth = overlap;
        minAxis = axis;
        axisFromA = fromA;
      }
    }
    return true;
  };

  if (!test(A, true)) return null;
  if (!test(B, false)) return null;
  if (!minAxis) return null;

  const ca = polyCentroid(A);
  const cb = polyCentroid(B);
  let n: Vec = minAxis;
  if ((ca.x - cb.x) * n.x + (ca.y - cb.y) * n.y < 0) n = { x: -n.x, y: -n.y };

  const tol = Math.max(0.5, minDepth * 0.6);
  const point = axisFromA
    ? supportPoints(B, n, tol) // B's vertices deepest into A
    : supportPoints(A, { x: -n.x, y: -n.y }, tol); // A's vertices deepest into B

  return { normal: n, depth: minDepth, point };
}

/** Circle vs convex polygon. Returns contact pushing the circle out of the polygon. */
export function circleVsPolygon(c: Vec, r: number, poly: Vec[]): Contact | null {
  let inside = true;
  let bestDist = Infinity;
  let bestPoint: Vec = c;
  let bestNormal: Vec = { x: 0, y: -1 };
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const ex = b.x - a.x;
    const ey = b.y - a.y;
    const side = ex * (c.y - a.y) - ey * (c.x - a.x);
    if (side < 0) inside = false;
    const l2 = ex * ex + ey * ey || 1;
    let t = ((c.x - a.x) * ex + (c.y - a.y) * ey) / l2;
    t = clamp(t, 0, 1);
    const px = a.x + ex * t;
    const py = a.y + ey * t;
    const d = Math.hypot(c.x - px, c.y - py);
    if (d < bestDist) {
      bestDist = d;
      bestPoint = { x: px, y: py };
      const el = Math.sqrt(l2);
      bestNormal = { x: ey / el, y: -ex / el }; // outward for clockwise polys (screen coords)
    }
  }
  if (inside) {
    return { normal: bestNormal, depth: r + bestDist, point: bestPoint };
  }
  if (bestDist < r) {
    const n = norm(sub(c, bestPoint));
    return { normal: n, depth: r - bestDist, point: bestPoint };
  }
  return null;
}

export function fmtTime(t: number) {
  const s = Math.max(0, Math.ceil(t));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}
