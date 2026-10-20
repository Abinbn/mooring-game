import { CONTAINER_COLORS, QUAY_X, SHIP_L, SHIP_W } from "./constants";
import { hullPoly, polyCentroid, polyRadius, rad, rectPoly, rng, transformPoly, type Vec } from "./math";

export type TimeOfDay = "day" | "dusk" | "night";

export interface ShipVisual {
  pos: Vec;
  heading: number;
  L: number;
  W: number;
  hull: string;
  hullDark: string;
  deck: string;
  containers: number; // 0..1 how full
  seed: number;
}

export interface Obstacle {
  kind: "quay" | "rock" | "ship";
  poly: Vec[];
  center: Vec;
  radius: number;
  ship?: ShipVisual;
}

export interface BuoyDef {
  anchor: Vec;
  color: string;
}

export interface Berth {
  y: number;
  halfLen: number;
  tolAlong: number;
  tolAngle: number; // radians
}

export interface LevelDef {
  index: number;
  name: string;
  berthNumber: string;
  tipKeys: string;
  tipTouch: string;
  start: { pos: Vec; heading: number };
  current: Vec;
  gust: number;
  gustPeriod: number;
  timeLimit: number;
  berth: Berth;
  obstacles: Obstacle[];
  buoys: BuoyDef[];
  timeOfDay: TimeOfDay;
  containers: { x: number; y: number; w: number; h: number; color: string }[];
  rocks: Obstacle[];
}

export const BASIN = { left: -980, top: -1000, bottom: 1000 };

function makeObstacle(kind: Obstacle["kind"], poly: Vec[], ship?: ShipVisual): Obstacle {
  const center = polyCentroid(poly);
  return { kind, poly, center, radius: polyRadius(poly, center), ship };
}

function mooredShip(y: number, heading: number, L: number, W: number, seed: number): Obstacle {
  const r = rng(seed);
  const palettes = [
    ["#2c6e9b", "#1b4b6b", "#4f8fb8"],
    ["#4a7c59", "#2f5239", "#6f9f7b"],
    ["#7b5ea7", "#52397a", "#9a7fc4"],
    ["#8d6e63", "#5d4037", "#a98b80"],
    ["#546e7a", "#37474f", "#78909c"],
  ];
  const p = palettes[Math.floor(r() * palettes.length)];
  const pos = { x: QUAY_X - W / 2 - 1.5, y };
  const vis: ShipVisual = {
    pos,
    heading,
    L,
    W,
    hull: p[0],
    hullDark: p[1],
    deck: p[2],
    containers: 0.4 + r() * 0.6,
    seed: Math.floor(r() * 1e6),
  };
  return makeObstacle("ship", transformPoly(hullPoly(L, W), pos, heading), vis);
}

function baseObstacles(): { quay: Obstacle; rocks: Obstacle[] } {
  const quay = makeObstacle("quay", rectPoly(QUAY_X + 450, 0, 450, 2600));
  const rocks = [
    makeObstacle("rock", rectPoly(BASIN.left - 40, 0, 40, 1040)),
    makeObstacle("rock", rectPoly((BASIN.left + QUAY_X) / 2, BASIN.top - 40, (QUAY_X - BASIN.left) / 2 + 40, 40)),
    makeObstacle("rock", rectPoly((BASIN.left + QUAY_X) / 2, BASIN.bottom + 40, (QUAY_X - BASIN.left) / 2 + 40, 40)),
  ];
  return { quay, rocks };
}

function containersFor(seed: number) {
  const r = rng(seed);
  const out: LevelDef["containers"] = [];
  // Stacks in blocks behind the crane rails
  for (let block = -4; block <= 4; block++) {
    const by = block * 190;
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 6; col++) {
        if (r() < 0.22) continue;
        const w = 16;
        const h = 7;
        out.push({
          x: 120 + row * 20,
          y: by - 60 + col * 9,
          w,
          h,
          color: CONTAINER_COLORS[Math.floor(r() * CONTAINER_COLORS.length)],
        });
      }
    }
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 8; col++) {
        if (r() < 0.3) continue;
        out.push({
          x: 200 + row * 20,
          y: by - 70 + col * 9,
          w: 16,
          h: 7,
          color: CONTAINER_COLORS[Math.floor(r() * CONTAINER_COLORS.length)],
        });
      }
    }
  }
  return out;
}

const PROC_NAMES = [
  "Night Shift",
  "Gusty Reach",
  "Buoy Field",
  "Rush Hour",
  "Pilot's Nightmare",
  "Overtime",
  "Storm Front",
  "Narrow Margin",
  "Captain's Test",
  "Last Berth",
];

export function makeLevel(index: number, runSeed: number): LevelDef {
  const { quay, rocks } = baseObstacles();
  const seed = (runSeed + index * 7919) >>> 0;
  const r = rng(seed);
  const obstacles: Obstacle[] = [quay, ...rocks];
  const buoys: BuoyDef[] = [];
  const up = -Math.PI / 2;

  const base: Omit<LevelDef, "name" | "tipKeys" | "tipTouch" | "start" | "timeLimit"> = {
    index,
    berthNumber: `B${((index - 1) % 9) + 1}`,
    current: { x: 0, y: 0 },
    gust: 0,
    gustPeriod: 9,
    berth: { y: 0, halfLen: SHIP_L / 2 + 40, tolAlong: 28, tolAngle: rad(7) },
    obstacles,
    buoys,
    timeOfDay: "day",
    containers: containersFor(seed),
    rocks,
  };

  switch (index) {
    case 1:
      return {
        ...base,
        name: "First Berth",
        tipKeys: "Hold → (or E + D) so both tugs push her onto the berth. Ease off early — she's heavy!",
        tipTouch: "Hold both ▶ tug buttons to push her onto the berth. Ease off early — she's heavy!",
        start: { pos: { x: -122, y: 0 }, heading: up },
        timeLimit: 60,
      };
    case 2:
      return {
        ...base,
        name: "Angle of Approach",
        tipKeys: "Q / E swing the bow, A / D swing the stern. Straighten up, then push in.",
        tipTouch: "Top buttons swing the bow, bottom buttons swing the stern. Straighten up, then push in.",
        start: { pos: { x: -230, y: 40 }, heading: up + rad(28) },
        timeLimit: 75,
      };
    case 3:
      return {
        ...base,
        name: "Dead Slow Ahead",
        tipKeys: "W / ↑ engine ahead, S / ↓ astern. She takes a long time to stop — brake early!",
        tipTouch: "▲ engine ahead, ▼ astern. She takes a long time to stop — brake early!",
        start: { pos: { x: -170, y: 520 }, heading: up },
        timeLimit: 90,
      };
    case 4:
      return {
        ...base,
        name: "Cross Current",
        tipKeys: "A current runs along the quay. Counter the drift with your engine while the tugs work.",
        tipTouch: "A current runs along the quay. Counter the drift with your engine while the tugs work.",
        start: { pos: { x: -240, y: -140 }, heading: up + rad(-14) },
        current: { x: 0, y: 3.2 },
        timeLimit: 90,
        timeOfDay: "dusk",
      };
    case 5: {
      obstacles.push(mooredShip(-(SHIP_L / 2 + 42 + 55), up, 110, 20, seed + 1));
      obstacles.push(mooredShip(SHIP_L / 2 + 42 + 60, -up, 120, 22, seed + 2));
      return {
        ...base,
        name: "Tight Squeeze",
        tipKeys: "Neighbours on both sides. Square up before you commit — scraping them costs hull.",
        tipTouch: "Neighbours on both sides. Square up before you commit — scraping them costs hull.",
        start: { pos: { x: -300, y: -60 }, heading: up + rad(35) },
        berth: { y: 0, halfLen: SHIP_L / 2 + 42, tolAlong: 22, tolAngle: rad(6) },
        timeLimit: 90,
        timeOfDay: "dusk",
      };
    }
    default: {
      const d = index - 5; // difficulty step ≥ 1
      const dist = 230 + r() * 220;
      const alongMag = 140 + r() * Math.min(520, 120 + d * 60);
      const along = (r() < 0.5 ? -1 : 1) * alongMag;
      const tilt = (r() - 0.5) * 2 * rad(Math.min(75, 18 + d * 7));
      const flipped = d >= 3 && r() < 0.3;
      const heading = up + tilt + (flipped ? Math.PI : 0);

      const curMag = Math.min(6, 1.2 + d * 0.55) * (0.5 + r() * 0.5);
      const curAng = (r() < 0.5 ? Math.PI / 2 : -Math.PI / 2) + (r() - 0.5) * rad(70);
      const current = { x: Math.cos(curAng) * curMag, y: Math.sin(curAng) * curMag };

      // Buoys scattered along the approach
      const nBuoys = Math.min(4, 1 + Math.floor(r() * (d + 1)));
      const start = { x: -dist, y: along };
      for (let i = 0; i < nBuoys; i++) {
        const t = 0.25 + r() * 0.5;
        const px = start.x + (-SHIP_W / 2 - 1 - start.x) * t + (r() - 0.5) * 220;
        const py = start.y + (0 - start.y) * t + (r() - 0.5) * 260;
        if (Math.hypot(px - start.x, py - start.y) < 110) continue;
        if (px > -70 && Math.abs(py) < SHIP_L / 2 + 70) continue;
        if (px > -40) continue;
        buoys.push({ anchor: { x: px, y: py }, color: r() < 0.5 ? "#ff5d5d" : "#3ef2a0" });
      }

      // Neighbouring moored ships, tighter with difficulty
      const halfLen = SHIP_L / 2 + Math.max(26, 60 - d * 6);
      if (d >= 2 || r() < 0.5) {
        const n1L = 100 + r() * 40;
        obstacles.push(mooredShip(-(halfLen + 4 + n1L / 2), r() < 0.5 ? up : -up, n1L, 20 + r() * 4, seed + 11));
      }
      if (d >= 3 || r() < 0.4) {
        const n2L = 100 + r() * 50;
        obstacles.push(mooredShip(halfLen + 4 + n2L / 2, r() < 0.5 ? up : -up, n2L, 20 + r() * 4, seed + 12));
      }

      const tod: TimeOfDay = (["dusk", "night", "day"] as TimeOfDay[])[(index + 1) % 3];
      return {
        ...base,
        name: PROC_NAMES[(index - 6) % PROC_NAMES.length],
        tipKeys: d >= 3 && flipped ? "She's pointing the other way — any heading alongside counts." : "Watch the current and the buoys. Precision pays.",
        tipTouch: d >= 3 && flipped ? "She's pointing the other way — any heading alongside counts." : "Watch the current and the buoys. Precision pays.",
        start: { pos: start, heading },
        current,
        gust: d >= 3 ? 0.5 : 0,
        gustPeriod: 7 + r() * 5,
        timeLimit: Math.max(50, 92 - d * 4),
        berth: {
          y: 0,
          halfLen,
          tolAlong: Math.max(14, 26 - d * 1.5),
          tolAngle: rad(Math.max(3.5, 6.5 - d * 0.35)),
        },
        timeOfDay: tod,
      };
    }
  }
}
