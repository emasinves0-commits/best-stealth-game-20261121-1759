// Lighting: the beacon beam is the level jam. Ground is lit only where the rotating
// yellow wedge reaches AND nothing blocks it. Cover (sea wall, lighthouse base,
// crates, stairs) casts shadow - a dark pocket that stays dark even inside the beam.
// One clear job: decide, per cell, whether the cell is lit. The renderer draws
// everything else.
"use strict";

import { WORLD } from "./config.js";

// Coarse grid for the per-frame shadow test (cheap enough to refresh each frame).
const COLS = 128;
const ROWS = 80;
const CELL_W = WORLD.width / COLS;
const CELL_H = WORLD.height / ROWS;

/** Cells occupied by solid cover in coarse-grid coordinates. */
export function coverCells(level) {
  const set = new Set();
  for (const c of level.cover) {
    const cx0 = Math.max(0, Math.floor(c.x / CELL_W));
    const cy0 = Math.max(0, Math.floor(c.y / CELL_H));
    const cx1 = Math.min(COLS - 1, Math.floor((c.x + c.w) / CELL_W));
    const cy1 = Math.min(ROWS - 1, Math.floor((c.y + c.h) / CELL_H));
    for (let cy = cy0; cy <= cy1; cy++) {
      for (let cx = cx0; cx <= cx1; cx++) set.add(`${cx},${cy}`);
    }
  }
  return [...set].map((s) => {
    const [cx, cy] = s.split(",").map(Number);
    return { cx, cy, x: cx * CELL_W + CELL_W / 2, y: cy * CELL_H + CELL_H / 2 };
  });
}

/**
 * Precompute the coarse light map for the current beam angle:
 *   0 = dark (outside the beam)
 *   1 = lit (inside the beam, not shadowed by cover)
 * The map is a Float32Array(col * row); read with map[y * col + x].
 */
export function computeLightMap(level) {
  const map = new Float32Array(COLS * ROWS);
  const { x: bx, y: by } = level.beacon;
  const ang = level.beacon.angle;          // radians, clockwise
  const half = level.beacon.halfWidth * Math.PI / 180;
  const cover = coverCells(level);
  const step = 6;

  for (let gy = 0; gy < ROWS; gy++) {
    const y = gy * CELL_H + CELL_H / 2;
    for (let gx = 0; gx < COLS; gx++) {
      const x = gx * CELL_W + CELL_W / 2;
      const dx = x - bx;
      const dy = y - by;
      const dist = Math.hypot(dx, dy);
      if (dist < 5 || dist > WORLD.width + WORLD.height) { map[gy * COLS + gx] = 0; continue; }
      let a = Math.atan2(dy, dx) - ang;
      while (a >  Math.PI) a -= 2 * Math.PI;
      while (a < -Math.PI) a += 2 * Math.PI;
      if (Math.abs(a) > half) { map[gy * COLS + gx] = 0; continue; }
      let lit = true;
      for (let s = 1; s <= step && lit; s++) {
        const t = s / step;
        const px = bx + dx * t;
        const py = by + dy * t;
        for (const cc of cover) {
          if (Math.hypot(px - cc.x, py - cc.y) < CELL_W * 0.65) { lit = false; break; }
        }
      }
      map[gy * COLS + gx] = lit ? 1 : 0;
    }
  }
  return map;
}

/** Exact lit test for a world point (used by detection and the player status). */
export function isLit(level, x, y) {
  const { x: bx, y: by } = level.beacon;
  const dx = x - bx, dy = y - by;
  const dist = Math.hypot(dx, dy);
  if (dist < 5 || dist > WORLD.width + WORLD.height) return false;
  let a = Math.atan2(dy, dx) - level.beacon.angle;
  while (a >  Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  if (Math.abs(a) > level.beacon.halfWidth * Math.PI / 180) return false;
  const step = 8;
  for (let s = 1; s <= step; s++) {
    const t = s / step;
    const px = bx + dx * t, py = by + dy * t;
    for (const cc of coverCells(level)) {
      if (Math.hypot(px - cc.x, py - cc.y) < CELL_W * 0.7) return false;
    }
  }
  return true;
}
