// HUD: the four pieces of information the player needs every frame, drawn as
// translucent panels over the scene (never as HTML overlays, so nothing clips).
//   meter curiga per penjaga (bottom-left, red bars)
//   indikator terang / gelap (player's own light status, top-right)
//   indikator arah rotasi sinar (the beacon's clockwise rotation, top-right)
//   rating "Keheningan" (professionalism, stars, top-left)
// One clear job: layout and text. Painting the game itself is another module's job.
"use strict";

import { WORLD } from "./config.js";

const W = WORLD.width, H = WORLD.height;

/** Translucent dark panel used by every HUD piece. */
export function panel(ctx, x, y, w, h, alpha = 0.82) {
  ctx.fillStyle = `rgba(16,21,34,${alpha})`;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "rgba(60,80,120,0.35)";
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);
}

export function drawHUD(ctx, state) {
  const lvl = state.level;
  const guards = lvl.guardStates;
  const camera = lvl.camera;
  const beamAngle = lvl.beacon.angle;
  const player = state.player;
  const lit = state.playerLit;
  const alarm = state.alarmMeter;
  const still = state.still;
  // The rating is rendered as an integer (1 decimal max): never a long float.
  // Expose the formatted string on state so harnesses can assert it
  // (window.__GAME.hudKeheningan must match /^\d+(\.\d)? \/ 3$/).
  state.hudKeheningan = Math.round(still) + " / 3";

  // ------------------------------------------------------------------ top-left
  const idx = state.levelIndex;
  const total = state.levels.length;
  const fontSize = 15;

  // ------------------------------------------------------------------ top-left
  panel(ctx, 12, 10, 300, 40);
  ctx.fillStyle = "rgba(255,210,90,0.85)";
  ctx.font = "bold " + fontSize + "px system-ui, sans-serif";
  ctx.fillText("THE LAST LIGHT", 18, 28);
  ctx.fillStyle = "rgba(232,241,255,0.8)";
  ctx.font = "11px system-ui, sans-serif";
  ctx.fillText("Keheningan " + Math.round(still) + " / 3", 18, 44);

  // ---------------------------------------------------------------- top-right
  panel(ctx, W - 312, 10, 300, 40);
  // light / dark indicator: placed left of the beam ring so the circular indicator
  // and its label never overlap the rotation ring or its "sinar N°" text (fix-5 #3)
  const li = state.lightIndicator;
  ctx.fillStyle = lit ? "#ffd25a" : "#2a3346";
  ctx.beginPath();
  ctx.arc(W - 309, 26, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.8)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = lit ? "#ffd25a" : "#6a7488";
  ctx.font = "11px system-ui, sans-serif";
  ctx.fillText(li.state, W - 300, 30);
  // beam rotation direction indicator (the level jam)
  beamRing(ctx, W - 230, 30, beamAngle, state.beamSpeedDeg);

  // ---------------------------------------------------------------- suspicion
  panel(ctx, 12, 56, W - 24, 160);
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.font = "11px system-ui, sans-serif";
  ctx.fillText("PENJAGA", 18, 70);
  let yy = 84;
  for (const g of guards) {
    ctx.fillStyle = "rgba(120,130,160,0.8)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillText(g.id, 22, yy);
    meter(ctx, 64, yy - 9, 220, 8, g.suspicion, "#e23d2e");
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.fillText(g.suspicion.toFixed(2), 64 + 220 + 6, yy + 1);
    yy += 24;
  }
  if (camera) {
    ctx.fillStyle = "rgba(120,130,160,0.8)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillText("PANCAW", 22, yy);
    meter(ctx, 64, yy - 9, 220, 8, camera.suspicion, "#ff8a22");
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.fillText(camera.suspicion.toFixed(2), 64 + 220 + 6, yy + 1);
  }

  // ------------------------------------------------------------------ alarm
  panel(ctx, W / 2 - 240, 56, 160, 160);
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.font = "11px system-ui, sans-serif";
  ctx.fillText("ALARM", W / 2 - 224, 70);
  meter(ctx, W / 2 - 192, 78, 384, 12, alarm, "#e23d2e");
  ctx.fillStyle = alarm >= 1 ? "#ff6e64" : "rgba(255,255,255,0.85)";
  ctx.font = "bold 12px system-ui, sans-serif";
  ctx.fillText(alarm >= 1 ? "TERDETEKSI" : "DAMAI", W / 2 - 100, 96);

  // ------------------------------------------------------------------ progress
  panel(ctx, 12, 224, W - 24, 34);
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = "bold " + fontSize + "px system-ui, sans-serif";
  ctx.fillText((idx) + " / " + total, 20, 244);
  // the level's name comes from the LEVELS table, not the mutable state object
  const lvlName = state.levels[state.levelIndex] ? state.levels[state.levelIndex].name : "?";
  ctx.fillStyle = "rgba(232,241,255,0.85)";
  ctx.font = "12px system-ui, sans-serif";
  ctx.fillText(lvlName.toUpperCase(), 110, 246);

  // ---------------------------------------------------------------- controls
  panel(ctx, 212, 224, W - 424, 34);
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.font = "11px system-ui, sans-serif";
  ctx.fillText("←→ / WASD jalan   ·   klik pintu/psi Enter   ·   P pause", 220, 242);
}

// ---------------------------------------------------------------- beams

/** The clockwise beam-ring: shows the rotation direction and the current angle. */
export function beamRing(ctx, x, y, angle, speedDeg) {
  const r = 24;
  ctx.strokeStyle = "rgba(255,210,90,0.45)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  // the arrow that marks the beam direction (rotated with the beam)
  const a = angle;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  ctx.beginPath();
  ctx.moveTo(r + 4, 0);
  ctx.lineTo(r - 14, -5);
  ctx.lineTo(r - 14, 5);
  ctx.fillStyle = "#ffd25a";
  ctx.fill();
  ctx.strokeStyle = "#ffd25a";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // the clockwise rotation arrow (drawn outside the ring)
  ctx.beginPath();
  ctx.arc(x, y, r + 6, -Math.PI * 0.8, Math.PI * 0.8, true);
  ctx.strokeStyle = "rgba(255,210,90,0.5)";
  ctx.lineWidth = 2;
  ctx.stroke();
  const ax = Math.cos(Math.PI * 0.8) * (r + 12), ay = Math.sin(Math.PI * 0.8) * (r + 12);
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(ax - 10 * Math.cos(Math.PI * 0.8 - 0.4), ay - 10 * Math.sin(Math.PI * 0.8 - 0.4));
  ctx.lineTo(ax + 8 * Math.cos(Math.PI * 0.8 - 0.4), ay + 8 * Math.sin(Math.PI * 0.8 - 0.4));
  ctx.fillStyle = "#ffd25a";
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.font = "10px system-ui, sans-serif";
  ctx.fillText("sinar " + ((angle * 180 / Math.PI) % 360).toFixed(0) + "°", x - 40, y + 42);
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = "10px system-ui, sans-serif";
  ctx.fillText("berlawanan arah jam", x - 50, y + 56);
}

/** The per-guard suspicion meter (a red bar with its value). */
export function meter(ctx, x, y, w, h, value, color) {
  ctx.fillStyle = "rgba(20,24,32,0.9)";
  ctx.fillRect(x, y, w, h);
  if (value > 0) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w * Math.min(1, value), h);
  }
  ctx.strokeStyle = "rgba(60,80,120,0.5)";
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);
}
