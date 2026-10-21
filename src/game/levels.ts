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

export type MissionType = "arrival" | "departure" | "tutorial";
export type DepartureSide = "west" | "north" | "south";

export interface DepartureExit {
  side: DepartureSide;
  label: string;
  threshold: number;
}

export interface PilotBoundary {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface RendezvousZone {
  x: number;
  y: number;
  radius: number;
}

export interface LevelDef {
  index: number;
  name: string;
  berthNumber: string;
  missionType: MissionType;
  departureExit?: DepartureExit;
  narrowPassage?: boolean;
  pilotBoundary: PilotBoundary;
  tipKeys: string;
  tipTouch: string;
  start: { pos: Vec; heading: number };
  current: Vec;
  gust: number;
  gustPeriod: number;
  timeLimit: number;
  berth: Berth;
  rendezvous: RendezvousZone;
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

function baseObstacles(exitSide?: DepartureSide): { quay: Obstacle; rocks: Obstacle[] } {
  const quay = makeObstacle("quay", rectPoly(QUAY_X + 450, 0, 450, 2600));
  const rocks: Obstacle[] = [];

  // West rock wall
  rocks.push(makeObstacle("rock", rectPoly(BASIN.left - 40, 0, 40, 1040)));

  // Top rock wall (North)
  if (exitSide === "north") {
    // Leave navigable channel open between x = -440 and x = -100
    const leftWidth = (-440 - BASIN.left) / 2;
    const leftCenterX = BASIN.left + leftWidth;
    rocks.push(makeObstacle("rock", rectPoly(leftCenterX, BASIN.top - 40, leftWidth + 40, 40)));

    const rightWidth = (QUAY_X - -100) / 2;
    const rightCenterX = -100 + rightWidth;
    rocks.push(makeObstacle("rock", rectPoly(rightCenterX, BASIN.top - 40, rightWidth + 40, 40)));
  } else {
    rocks.push(makeObstacle("rock", rectPoly((BASIN.left + QUAY_X) / 2, BASIN.top - 40, (QUAY_X - BASIN.left) / 2 + 40, 40)));
  }

  // Bottom rock wall (South)
  if (exitSide === "south") {
    // Leave navigable channel open between x = -440 and x = -100
    const leftWidth = (-440 - BASIN.left) / 2;
    const leftCenterX = BASIN.left + leftWidth;
    rocks.push(makeObstacle("rock", rectPoly(leftCenterX, BASIN.bottom + 40, leftWidth + 40, 40)));

    const rightWidth = (QUAY_X - -100) / 2;
    const rightCenterX = -100 + rightWidth;
    rocks.push(makeObstacle("rock", rectPoly(rightCenterX, BASIN.bottom + 40, rightWidth + 40, 40)));
  } else {
    rocks.push(makeObstacle("rock", rectPoly((BASIN.left + QUAY_X) / 2, BASIN.bottom + 40, (QUAY_X - BASIN.left) / 2 + 40, 40)));
  }

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
  const seed = (runSeed + index * 7919) >>> 0;
  const r = rng(seed);
  const up = -Math.PI / 2;

  const pilotBoundary: PilotBoundary = {
    minX: -460,
    maxX: QUAY_X + 20,
    minY: -620,
    maxY: 620,
  };

  if (index === 0) {
    const { quay, rocks } = baseObstacles();
    const obstacles: Obstacle[] = [quay, ...rocks];
    return {
      index: 0,
      berthNumber: "ACADEMY",
      missionType: "tutorial",
      name: "Pilot Academy",
      tipKeys: "Welcome to Pilot Academy. Follow the on-screen instructions to learn shiphandling.",
      tipTouch: "Welcome to Pilot Academy. Follow the on-screen instructions to learn shiphandling.",
      start: { pos: { x: -320, y: 160 }, heading: up },
      current: { x: 0, y: 0 },
      gust: 0,
      gustPeriod: 9,
      timeLimit: 9999,
      berth: { y: 0, halfLen: SHIP_L / 2 + 45, tolAlong: 32, tolAngle: rad(9) },
      rendezvous: { x: -200, y: 0, radius: 260 },
      pilotBoundary,
      obstacles,
      buoys: [],
      timeOfDay: "day",
      containers: containersFor(seed),
      rocks,
    };
  }

  if (index === 1) {
    const { quay, rocks } = baseObstacles();
    const obstacles: Obstacle[] = [quay, ...rocks];
    return {
      index: 1,
      berthNumber: "B1",
      missionType: "arrival",
      name: "First Berth",
      tipKeys: "Approach dock. Press [T] to summon tugs, or steer solo with [A]/[D] to dock unassisted!",
      tipTouch: "Approach dock. Tap [T] to summon tugs, or steer solo with rudder to dock unassisted!",
      start: { pos: { x: -260, y: 60 }, heading: up },
      current: { x: 0, y: 0 },
      gust: 0,
      gustPeriod: 9,
      timeLimit: 75,
      berth: { y: 0, halfLen: SHIP_L / 2 + 40, tolAlong: 28, tolAngle: rad(7) },
      rendezvous: { x: -180, y: 0, radius: 240 },
      pilotBoundary,
      obstacles,
      buoys: [],
      timeOfDay: "day",
      containers: containersFor(seed),
      rocks,
    };
  }

  // Levels 2+: Randomized Arrival vs Departure (~42% Departure chance)
  const isDeparture = r() < 0.42;
  const missionType: MissionType = isDeparture ? "departure" : "arrival";

  // Randomize departure exit: West (45%), North (28%), South (27%)
  const rSide = r();
  const exitSide: DepartureSide = rSide < 0.45 ? "west" : rSide < 0.73 ? "north" : "south";
  const narrowPassage = isDeparture && (index === 2 || r() < 0.52);

  const { quay, rocks } = baseObstacles(isDeparture ? exitSide : undefined);
  const obstacles: Obstacle[] = [quay, ...rocks];
  const buoys: BuoyDef[] = [];

  let departureExit: DepartureExit | undefined = undefined;
  if (isDeparture) {
    departureExit = {
      side: exitSide,
      label:
        exitSide === "west"
          ? "WEST OCEAN FAIRWAY"
          : exitSide === "north"
          ? "NORTH STRAIT CHANNEL"
          : "SOUTH SOUND PASSAGE",
      threshold: exitSide === "west" ? -680 : exitSide === "north" ? -750 : 750,
    };

    if (narrowPassage) {
      // Spawn narrow passage gate buoys (gap 50m — cargo ship fits solo, tugs attached will hit!)
      if (exitSide === "west") {
        buoys.push({ anchor: { x: -480, y: -26 }, color: "#d9564a" });
        buoys.push({ anchor: { x: -480, y: 26 }, color: "#57b98a" });
      } else if (exitSide === "north") {
        buoys.push({ anchor: { x: -290, y: -480 }, color: "#d9564a" });
        buoys.push({ anchor: { x: -238, y: -480 }, color: "#57b98a" });
      } else {
        buoys.push({ anchor: { x: -290, y: 480 }, color: "#d9564a" });
        buoys.push({ anchor: { x: -238, y: 480 }, color: "#57b98a" });
      }
    }
  }

  const d = Math.max(1, index - 2);
  const dist = 240 + r() * 220;
  const alongMag = 140 + r() * Math.min(520, 120 + d * 60);
  const along = (r() < 0.5 ? -1 : 1) * alongMag;
  const tilt = (r() - 0.5) * 2 * rad(Math.min(75, 18 + d * 7));
  const flipped = !isDeparture && d >= 3 && r() < 0.3;
  const heading = up + tilt + (flipped ? Math.PI : 0);

  const curMag = Math.min(6, 1.0 + d * 0.5) * (0.5 + r() * 0.5);
  const curAng = (r() < 0.5 ? Math.PI / 2 : -Math.PI / 2) + (r() - 0.5) * rad(70);
  const current = { x: Math.cos(curAng) * curMag, y: Math.sin(curAng) * curMag };

  const start = isDeparture
    ? { x: QUAY_X - SHIP_W / 2 - 2, y: 0 }
    : { x: -dist, y: along };

  // Approach buoys
  const nBuoys = Math.min(4, 1 + Math.floor(r() * (d + 1)));
  for (let i = 0; i < nBuoys; i++) {
    const t = 0.25 + r() * 0.5;
    const px = start.x + (-SHIP_W / 2 - 1 - start.x) * t + (r() - 0.5) * 220;
    const py = start.y + (0 - start.y) * t + (r() - 0.5) * 260;
    if (Math.hypot(px - start.x, py - start.y) < 110) continue;
    if (px > -70 && Math.abs(py) < SHIP_L / 2 + 70) continue;
    if (px > -40) continue;
    buoys.push({ anchor: { x: px, y: py }, color: r() < 0.5 ? "#d9564a" : "#57b98a" });
  }

  // Moored neighbour ships
  const halfLen = SHIP_L / 2 + Math.max(26, 60 - d * 6);
  if (d >= 2 || r() < 0.5) {
    const n1L = 100 + r() * 40;
    obstacles.push(mooredShip(-(halfLen + 4 + n1L / 2), r() < 0.5 ? up : -up, n1L, 20 + r() * 4, seed + 11));
  }
  if (d >= 3 || r() < 0.4) {
    const n2L = 100 + r() * 50;
    obstacles.push(mooredShip(halfLen + 4 + n2L / 2, r() < 0.5 ? up : -up, n2L, 20 + r() * 4, seed + 12));
  }

  const tod: TimeOfDay = (["day", "dusk", "night"] as TimeOfDay[])[index % 3];

  let tipKeys = "";
  let tipTouch = "";
  if (isDeparture) {
    const dirTxt = exitSide === "west" ? "West" : exitSide === "north" ? "North" : "South";
    if (narrowPassage) {
      tipKeys = `Outbound to ${dirTxt}. NARROW PASSAGE: Detach tugs with [T] before gate! Dragging tugs to sea fails contract.`;
      tipTouch = `Outbound to ${dirTxt}. NARROW PASSAGE: Detach tugs with [T] before gate! Dragging tugs to sea fails contract.`;
    } else {
      tipKeys = `Outbound to ${dirTxt}. Unmoor with tugs, then detach [T] before leaving pilot sector (-5 pts/tick).`;
      tipTouch = `Outbound to ${dirTxt}. Unmoor with tugs, then detach [T] before leaving pilot sector.`;
    }
  } else {
    tipKeys = "Approach dock. Press [T] to summon tugs in pilot zone, or steer with [A]/[D] to dock unassisted!";
    tipTouch = "Approach dock. Tap [T] to summon tugs in pilot zone, or steer with rudder to dock unassisted!";
  }

  return {
    index,
    berthNumber: `B${((index - 1) % 9) + 1}`,
    missionType,
    departureExit,
    narrowPassage,
    pilotBoundary,
    name: isDeparture ? `Outbound ${exitSide.toUpperCase()} ${index}` : PROC_NAMES[(index - 2) % PROC_NAMES.length],
    tipKeys,
    tipTouch,
    start: { pos: start, heading: isDeparture ? up : heading },
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
    rendezvous: { x: -200, y: 0, radius: 240 },
    obstacles,
    buoys,
    timeOfDay: tod,
    containers: containersFor(seed),
    rocks,
  };
}
