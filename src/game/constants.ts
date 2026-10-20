// World units: the cargo ship is 120 units long. Roughly 1 unit ≈ 1.7 m.

export const SHIP_L = 120;
export const SHIP_W = 22;

export const TUG_L = 20;
export const TUG_W = 10;
export const TUG_ANCHOR = 0.34; // fraction of SHIP_L from center where tugs attach

export const QUAY_X = 0; // quay face is the vertical line x = 0; water is x < 0

// Propulsion (accelerations, mass normalised to 1)
export const ENGINE_AHEAD = 15;
export const ENGINE_ASTERN = 9.5;
export const TUG_FORCE = 5.6;

// Response rates (1/s)
export const ENGINE_RAMP = 2.6;
export const TUG_RAMP = 6;

// Hydrodynamic drag
export const K_LONG = 0.22;
export const C_LONG = 0.002;
export const K_LAT = 0.68;
export const C_LAT = 0.012;
export const K_ANG = 0.7;
export const C_ANG = 0.6;
export const INERTIA = 1250;

// Collision
export const RESTITUTION_QUAY = 0.12;
export const RESTITUTION_ROCK = 0.3;
export const FRICTION = 0.45;

// Damage
export const DMG_THRESHOLD_QUAY = 4.2;
export const DMG_FACTOR_QUAY = 5;
export const DMG_THRESHOLD_HARD = 2;
export const DMG_FACTOR_HARD = 9;

// Mooring
export const SECURE_TIME = 1.6;
export const MOOR_MAX_SPEED = 2.2;
export const MOOR_MAX_ANGVEL = 0.05;
export const MOOR_DIST_MIN = -1.5;
export const MOOR_DIST_MAX = 6.5;

// Physics step
export const FIXED_DT = 1 / 120;

export const MAX_PARTICLES = 650;

export const HULL_REPAIR_PER_LEVEL = 18;

export const CONTAINER_COLORS = [
  "#e74c3c",
  "#3498db",
  "#f1c40f",
  "#2ecc71",
  "#e67e22",
  "#9b59b6",
  "#1abc9c",
  "#ecf0f1",
];
