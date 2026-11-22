// Guards: one patrolling guard per route, with a sharp RED cone of vision and a
// suspicion meter that goes up in the light and down in the dark. Detections are
// always recoverable - the meter falls when you hide. One clear job: the guards,
// their cones and their suspicion.
"use strict";

import { WORLD } from "./config.js";
import { bearing, lineOfSight } from "./vision.js";
import { isLit } from "./lighting.js";
import { GUARD as G } from "./config.js";

export const KIND = { PATROLLING: 0, ALERT: 1 };

export function createGuard(def) {
  const path = def.path.map((p) => ({ x: p.x, y: p.y }));
  return {
    id: def.id,
    x: path[0].x,
    y: path[0].y,
    path,
    way: 0,
    speed: def.speed ?? 64,
    head: 0,                 // current cone head direction, radians
    suspicion: 0,            // 0..1ish, the red meter below the guard
    state: KIND.PATROLLING,
    alertTimer: 0,
    bob: 0,
    idleSwing: 0,
  };
}

export function updateGuard(guard, level, dt, player) {
  const dx = player.x - guard.x;
  const dy = player.y - guard.y;
  const dist = Math.hypot(dx, dy);
  const toPlayer = Math.abs(bearing(guard.x, guard.y, player.x, player.y));

  // --- suspicion: up in the light inside the cone, down when fully hidden ---
  let susp = guard.suspicion;
  const inCone = toPlayer <= (guard.coneWidth ?? G.coneWidth) * Math.PI / 180;
  const lit = isLit(level, player.x, player.y);
  if (lit && inCone) {
    susp += G.suspicionRate * dt;
    if (dist < 120 && dist > 1) susp += G.nearBonus * dt; // near-miss raises the alarm
  } else if (!isLit(level, guard.x, guard.y) && dist < 36) {
    susp += 2.2 * dt; // footsteps carry in the dark
  }
  // recovery: the moment the player drops into shadow the meter falls back to zero
  if (!lit && susp > 0) susp -= G.recoverRate * dt;
  guard.suspicion = Math.min(1.25, Math.max(0, susp));

  // --- alert state: the cone flares, the head always points at you ---
  const alerting = guard.suspicion >= 1 || guard.alertTimer > 0;
  if (alerting) {
    guard.alertTimer = Math.max(0, guard.alertTimer - dt);
    if (dist > 0.1) guard.head = bearing(guard.x, guard.y, player.x, player.y);
  } else {
    // idle scan: head follows the route with a slow idle swing
    const wp = guard.path[Math.min(guard.way, guard.path.length - 1)];
    if (dist > 2) guard.head = bearing(guard.x, guard.y, wp.x, wp.y);
    guard.idleSwing = guard.idleSwing + dt * 5.2;
    guard.head += Math.sin(guard.idleSwing) * G.idleAmp * Math.PI / 180;
  }

  // --- movement along the route ---
  if (!alerting) {
    const wp = guard.path[guard.way];
    const dxp = wp.x - guard.x, dyp = wp.y - guard.y;
    const d = Math.hypot(dxp, dyp);
    if (d > 2) {
      guard.x += (dxp / d) * guard.speed * dt;
      guard.y += (dyp / d) * guard.speed * dt;
    } else if (guard.way + 1 < guard.path.length) {
      guard.way += 1;
    }
  }

  // --- idle animation ---
  guard.bob = Math.sin(performance.now() / G.headBob * Math.PI * 2) * 2;
}

/** The cone head direction this frame (delegates to the updated guard). */
export function coneHead(guard) { return guard.head; }

export function drawGuard(ctx, guard, level) {
  const x = guard.x,
    y = guard.y;
  const head = guard.head;
  // the red cone: sharp black outline, bright red core, dashed edge + a centre "V"
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(head);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(G.coneRange * Math.cos(-G.coneWidth / 2 * Math.PI / 180), G.coneRange * Math.sin(-G.coneWidth / 2 * Math.PI / 180));
  ctx.lineTo(G.coneRange * Math.cos(G.coneWidth / 2 * Math.PI / 180), G.coneRange * Math.sin(G.coneWidth / 2 * Math.PI / 180));
  ctx.closePath();
  const alert = guard.suspicion >= 1 || guard.alertTimer > 0;
  ctx.fillStyle = alert ? "rgba(255,110,100,0.28)" : "rgba(255,60,60,0.10)";
  ctx.fill();
  ctx.strokeStyle = alert ? "#ff6e64" : "#e23d2e";
  ctx.lineWidth = 3;
  ctx.setLineDash([6, 5]);
  ctx.stroke();
  ctx.setLineDash([]);
  // centre marker
  ctx.beginPath();
  ctx.moveTo(-8, -2); ctx.lineTo(8, 2);
  ctx.moveTo(8, -2); ctx.lineTo(-8, 2);
  ctx.strokeStyle = "rgba(255,40,40," + (alert ? "0.95" : "0.55") + ")";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  // the guard figure
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(head);
  ctx.beginPath();
  ctx.ellipse(0, -6, 10, 13, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#1d2733";
  ctx.fill();
  ctx.strokeStyle = "#3d5266";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // head + lamp
  ctx.beginPath();
  ctx.arc(0, -15, 7, 0, Math.PI * 2);
  ctx.fillStyle = "#24303e";
  ctx.fill();
  ctx.strokeStyle = "#4a6075";
  ctx.lineWidth = 1.2;
  ctx.stroke();
  // lamp
  ctx.beginPath();
  ctx.arc(0, 2, 3, 0, Math.PI * 2);
  ctx.fillStyle = "#ffd25a";
  ctx.fill();
  ctx.strokeStyle = "#fff0d0";
  ctx.lineWidth = 1;
  ctx.stroke();
  // name tag
  ctx.fillStyle = "rgba(20,28,40,0.75)";
  ctx.font = "11px system-ui, sans-serif";
  ctx.fillText(guard.id, 4, -22);
  ctx.restore();

  // the suspicion meter on the staff (drawn below the figure)
  ctx.save();
  ctx.translate(x, y + 26);
  const h = 7;
  ctx.fillStyle = "rgba(20,24,32,0.85)";
  ctx.fillRect(-18, -h, 36, h);
  ctx.fillStyle = alert ? "#ff6e64" : "#e23d2e";
  ctx.fillRect(-18, -h, 36 * Math.min(1, guard.suspicion), h);
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = "9px system-ui, sans-serif";
  ctx.fillText("curiga " + guard.suspicion.toFixed(2), -14, -h - 4);
  ctx.restore();
}
