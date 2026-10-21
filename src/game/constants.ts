// World units: the cargo ship is 120 units long. Roughly 1 unit ≈ 1.7 m.

export const SHIP_L = 120;
export const SHIP_W = 22;

export const TUG_L = 20;
export const TUG_W = 10;
export const TUG_ANCHOR = 0.34; // fraction of SHIP_L from center where tugs attach

export const QUAY_X = 0; // quay face is the vertical line x = 0; water is x < 0

// Propulsion (accelerations, mass normalised to 1)
export const ENGINE_AHEAD = 15;
// Astern is a third of ahead: a loaded ship backs down slowly and noisily.
export const ENGINE_ASTERN = 5;
export const TUG_FORCE = 5.6;

// Backing down is limited to a third of the ship's ahead speed, whatever the
// engine does. A loaded ship has one third of the thrust astern.
export const ASTERN_SPEED_LIMIT = 22;
// A tug pushing broadside mostly translates the ship; only part of that force
// becomes yaw. The tugs are the reason a 200 m hull can be swung at all — the
// ship's own rudder is deliberately feeble — so this is generous.
export const TUG_TORQUE_SCALE = 1.8;

// Response rates (1/s)
export const ENGINE_RAMP = 2.6;
export const TUG_RAMP = 6;

// Hydrodynamic drag. A loaded ship keeps way for a long time: the linear
// longitudinal term is deliberately low so she drifts on for tens of seconds.
export const K_LONG = 0.095;
export const C_LONG = 0.0016;
export const K_LAT = 0.68;
export const C_LAT = 0.012;
export const K_ANG = 0.9;
export const C_ANG = 0.6;
export const INERTIA = 1500;

// Rate limits: yaw (rad/s) and how hard the rudder can bite at speed.
// The rudder alone will take a couple of minutes to come round; hawser work
// from two tugs is what actually swings her (≈22 °/s).
export const MAX_ANGVEL = 0.075; // ≈ 4.3 °/s on the rudder alone
export const MAX_ANGVEL_TUGS = 0.38; // ≈ 21.8 °/s with both tugs working
export const RUDDER_LIFT = 0.5;
export const RUDDER_DRAG = 0.1;

// Free-sailing tugboats (standby, repositioning, coming alongside)
export const TUG_ACCEL = 30; // units/s² — tugs build way from rest, not snap to speed
export const TUG_MAX_SPEED = 96; // units/s — enough to overhaul a ship still making way
export const TUG_COLLIDE_R = 7.5; // half-width used for hull contacts

// Collision
export const RESTITUTION_QUAY = 0.12;
export const RESTITUTION_ROCK = 0.3;
export const FRICTION = 0.45;

// Damage
export const DMG_THRESHOLD_QUAY = 4.2;
export const DMG_FACTOR_QUAY = 5;
export const DMG_THRESHOLD_HARD = 2;
export const DMG_FACTOR_HARD = 9;

// Tug pilotage contract: how long tugs may be dragged outside the pilot area
// before the contract is revoked.
export const TUG_BREACH_GRACE = 3;

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
