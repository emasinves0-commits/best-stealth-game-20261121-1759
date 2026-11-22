// Vision geometry: the beam polygon the level jam sweeps, the guard's red cone,
// and line-of-sight tests. Pure geometry, no drawing and no DOM.
"use strict";

import { WORLD, GUARD } from "./config.js";

/** Clockwise angle of (x,y) relative to (cx,cy), radians. */
export function bearing(cx, cy, x, y) {
  let a = Math.atan2(y - cy, x - cx);
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

/**
 * The beacon wedge: a polygon from the lighthouse light source sweeping clockwise.
 * `spread` in degrees (the beam has a soft penumbra). Returns vertices in
 * [beamAngle-spread/2, beamAngle+spread/2] clockwise.
 */
export function beamPolygon(level, spread) {
  const { x: bx, y: by } = level.beacon;
  const half = (spread || level.beacon.halfWidth) * Math.PI / 180;
  const a0 = level.beacon.angle - half;
  const a1 = level.beacon.angle + half;
  const len = Math.max(240, WORLD.width + WORLD.height - 40);
  return [
    { x: bx, y: by },
    { x: bx + Math.cos(a0) * len, y: by + Math.sin(a0) * len },
    { x: bx + Math.cos(a1) * len, y: by + Math.sin(a1) * len },
  ];
}

/** The guard's red cone sector at a given head angle. */
export function guardConePolygon(guard, headAngle, range = GUARD.coneRange) {
  const { x, y } = guard;
  const half = (guard.coneWidth / 2) * Math.PI / 180;
  const a0 = headAngle - half;
  const a1 = headAngle + half;
  const len = range;
  return [
    { x, y },
    { x: x + Math.cos(a0) * len, y: y + Math.sin(a0) * len },
    { x: x + Math.cos(a1) * len, y: y + Math.sin(a1) * len },
  ];
}

/**
 * Line of sight between two points, using the coarse cover mask. True when no
 * solid cover sits between them (a guard's sight over a crate is a gap in the
 * shadow, not through it).
 */
export function lineOfSight(level, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const dist = Math.hypot(dx, dy);
  if (dist < 0.1) return true;
  const step = 6;
  for (let s = 1; s <= step; s++) {
    const t = s / step;
    const px = ax + dx * t;
    const py = ay + dy * t;
    for (const c of level.cover) {
      if (Math.hypot(px - c.x, py - c.y) < Math.max(c.w, c.h) * 0.55) return false;
    }
  }
  return true;
}
