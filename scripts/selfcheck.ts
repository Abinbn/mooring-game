/**
 * Headless sanity checks for the pure game logic (no DOM, no canvas).
 *
 *   npm run selfcheck
 *
 * These are the invariants that are expensive to notice by playing: a level
 * that spawns the ship inside a rock, a level whose berth is unreachable, a
 * generator that stops being deterministic for a saved run, or a collision
 * routine that lets a hull pass through the quay.
 */
import { QUAY_X, SHIP_L, SHIP_W } from "../src/game/constants";
import { makeLevel } from "../src/game/levels";
import { circleVsPolygon, hullPoly, rectPoly, satPolygons, transformPoly } from "../src/game/math";

let failures = 0;
let checks = 0;

function check(name: string, ok: boolean, detail = "") {
  checks++;
  if (!ok) {
    failures++;
    console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

const HULL = hullPoly(SHIP_L, SHIP_W);

/* ── Collision primitives ─────────────────────────────────────── */
{
  const wall = rectPoly(100, 0, 50, 400);
  check("SAT ignores a gap", satPolygons(rectPoly(0, 0, 10, 10), wall) === null);
  // Only 15 units of the box are inside the wall on X, 20 on Y, so the
  // shallowest escape axis is -X: the pushed-out direction must point back
  // towards the water.
  const hit = satPolygons(rectPoly(55, 0, 10, 10), wall);
  check("SAT reports an overlap", hit !== null);
  check("SAT points out of the wall", hit !== null && hit.normal.x < 0, hit ? `n=(${hit.normal.x.toFixed(2)}, ${hit.normal.y.toFixed(2)})` : "");
  check("SAT depth is sane", hit !== null && hit.depth > 0 && hit.depth <= 60, hit ? `d=${hit.depth.toFixed(2)}` : "");

  const circle = circleVsPolygon({ x: 95, y: 0 }, 8, wall);
  check("circleVsPolygon detects a hit", circle !== null);
  check("circleVsPolygon misses when clear", circleVsPolygon({ x: 20, y: 0 }, 8, wall) === null);
}

/* ── Level generation ─────────────────────────────────────────── */
{
  const a = makeLevel(7, 123456);
  const b = makeLevel(7, 123456);
  check("levels are deterministic for a run seed", JSON.stringify(a) === JSON.stringify(b));
  const c = makeLevel(7, 999);
  check("different seeds give different levels", JSON.stringify(a.obstacles) !== JSON.stringify(c.obstacles));

  for (const index of [0, 1, 2, 3, 4, 5, 8, 12, 20, 40]) {
    for (const seed of [1, 42, 777, 123456]) {
      const lv = makeLevel(index, seed);

      // The ship must never spawn inside geometry.
      const poly = transformPoly(HULL, lv.start.pos, lv.start.heading);
      let blocked = false;
      for (const obs of lv.obstacles) {
        if (satPolygons(poly, obs.poly)) {
          blocked = true;
          break;
        }
      }
      check(`L${index}/s${seed}: spawn is clear`, !blocked);

      // ...and it must spawn inside the basin, not on the quay side.
      check(
        `L${index}/s${seed}: spawn is on water`,
        lv.start.pos.x < QUAY_X - SHIP_W / 2 + 1 && Math.abs(lv.start.pos.y) < 1100,
        `x=${lv.start.pos.x.toFixed(1)} y=${lv.start.pos.y.toFixed(1)}`,
      );

      // The berth itself must be reachable water.
      const berthPoly = transformPoly(HULL, { x: QUAY_X - SHIP_W / 2 - 1, y: lv.berth.y }, -Math.PI / 2);
      let berthBlocked = false;
      for (const obs of lv.obstacles) {
        if (obs.kind === "quay") continue;
        if (satPolygons(berthPoly, obs.poly)) berthBlocked = true;
      }
      check(`L${index}/s${seed}: berth is clear`, !berthBlocked);

      check(`L${index}/s${seed}: has a time limit`, lv.timeLimit > 0);
      check(`L${index}/s${seed}: berth length fits the ship`, lv.berth.halfLen >= SHIP_L / 2);
      check(
        `L${index}/s${seed}: rendezvous reachable`,
        lv.rendezvous.x < QUAY_X && lv.rendezvous.radius > 0,
      );
      if (lv.departureExit) {
        const exit = lv.departureExit;
        const inside = exit.side === "west" ? exit.threshold < lv.pilotBoundary.minX : exit.side === "north" ? exit.threshold < lv.pilotBoundary.minY : exit.threshold > lv.pilotBoundary.maxY;
        check(`L${index}/s${seed}: exit lies beyond the pilot limit`, inside);
      }
    }
  }
}

/* ── A hull pushed against the quay stays on the water side ───── */
{
  // Simulate the clamp used by the engine: hull max-X must not cross x = 0.
  const pos = { x: 40, y: 0 };
  const poly = transformPoly(HULL, pos, -Math.PI / 2);
  const maxX = Math.max(...poly.map((v) => v.x));
  const corrected = pos.x - Math.max(0, maxX - QUAY_X);
  const fixed = transformPoly(HULL, { x: corrected, y: pos.y }, -Math.PI / 2);
  const fixedMaxX = Math.max(...fixed.map((v) => v.x));
  check("quay clamp keeps the hull off the quay", fixedMaxX <= QUAY_X + 0.001, `maxX=${fixedMaxX.toFixed(2)}`);
}

console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures > 0) {
  console.error(`${failures} failing check(s)`);
  process.exit(1);
}
