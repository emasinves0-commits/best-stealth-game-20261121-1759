// Levels: the three levels of The Last Light, one clear job each.
//   LEVELS            : the level data (guards, cover, exit, code, hints)
//   createLevel(id)   : build the mutable level state for a run
//   drawScene(ctx, l) : paint the static scene of a level (sky, sea, dunes, the
//                       lighthouse, the dock, the room, the stairs)
//   levelComplete(l,p): check the exit
//   cameraUpdate(c,p) : the room's camera (level 2) - the only "static eye"
// The game logic (beacon, guards, alarm, sound, input, HUD) lives in the other
// modules; this one is the world's scenery and the rules of the three levels.
"use strict";

import { WORLD } from "./config.js";
import { beamPolygon, bearing, lineOfSight } from "./vision.js";
import { computeLightMap } from "./lighting.js";

export const LEVELS = [

  // ============================================================ LEVEL 1 - DERMAGA

  {
    id: 1,
    name: "dermaga",                          // Dock (coastal wooden jetty)
    sort: "1",                               // cover-file ordering
    header: "Dini hari. Sinarnya kuning = bahaya. Cone mereka merah = pandangan. Gelap = aman.",
    beacon: { x: 770, y: 120, speed: 360 / 12 },      // mercusar, kanan
    spawns: [{ name: "pasir", x: 140, y: 430 }],
    exit: { x: 40, y: 460, label: "KELUAR", open: true },
    cover: [
      { x: 150, y: 540, w: 670, h: 30, type: "wall" },   // dinding pantai
      { x: 120, y: 470, w: 780, h: 16, type: "dock" },   // palang kapal
      { x: 700, y: 170, w: 120, h: 300, type: "tower" }, // menara mercusar
      { x: 300, y: 440, w: 46, h: 34, type: "crate" },
      { x: 410, y: 440, w: 46, h: 34, type: "crate" },
      { x: 520, y: 440, w: 46, h: 34, type: "crate" },
      { x: 20, y: 430, w: 48, h: 100, type: "frame" },   // rangka gerbang
    ],
    guards: [
      { id: "G1", path: [
          { x: 160, y: 430 }, { x: 360, y: 430 }, { x: 560, y: 430 }, { x: 720, y: 430 }
        ], speed: 58 },
    ],
    hints: [
      { text: "1. SINAR KUNING = BAHAYA", x: 260, y: 120, color: "#ffd25a" },
      { text: "2. CONE MERAH = PANDANGAN", x: 560, y: 160, color: "#e23d2e" },
      { text: "3. GELAP = AMAN", x: 430, y: 90, color: "#24303e" },
    ],
  },

  // ====================================================== LEVEL 2 - RUANG PENJAGA

  {
    id: 2,
    name: "ruang-penjaga",                     // Guard room with the camera and the safe
    sort: "2",
    header: "Ruang penjaga. Camera di dinding barat. Kode brankas di meja. Cari kode, buka pintu.",
    beacon: { x: 780, y: 120, speed: 360 / 10 },
    spawns: [{ name: "meja", x: 360, y: 360 }],
    exit: { x: 520, y: 60, label: "KATAS KUCINTA", open: false },
    cover: [
      { x: 280, y: 40, w: 620, h: 20, type: "wall" },    // dinding utara
      { x: 280, y: 40, w: 20, h: 580, type: "wall" },    // dinding barat
      { x: 880, y: 40, w: 20, h: 580, type: "wall" },    // dinding timur
      { x: 280, y: 600, w: 620, h: 20, type: "wall" },   // lantai ruang (dinding selatan)
      { x: 420, y: 230, w: 160, h: 70, type: "table" },
      { x: 470, y: 320, w: 80, h: 90, type: "safe" },
      { x: 610, y: 230, w: 40, h: 160, type: "panel" },  // papan ketik
      { x: 280, y: 300, w: 14, h: 46, type: "camera" },  // kamera di dinding barat
      { x: 510, y: 440, w: 40, h: 140, type: "door" },   // pintu ke ruang lampu
    ],
    guards: [
      { id: "G2", path: [
          { x: 360, y: 250 }, { x: 620, y: 250 }, { x: 620, y: 420 }, { x: 360, y: 420 }
        ], speed: 54 },
      { id: "G3", path: [
          { x: 300, y: 300 }, { x: 300, y: 520 }, { x: 660, y: 520 }, { x: 660, y: 300 }
        ], speed: 48 },
    ],
    code: [3, 7, 2],                 // kode yang ada di jurnal meja
    keypad: { x: 610, y: 230, w: 40, h: 160, label: "KETIK KODE" },
    camera: { x: 280, y: 300, w: 14, h: 46, angle: 0, suspicion: 0, range: 320 },
    hints: [
      { text: "CAMERA (merah) melihat cahaya", x: 180, y: 250, color: "#ff8a22" },
      { text: "KODE di jurnal meja (4 digit)", x: 220, y: 120, color: "#ffd25a" },
      { text: "Buka papan ketik, ketik kode", x: 660, y: 420, color: "#24303e" },
    ],
  },

  // ========================================================== LEVEL 3 - RUANG LAMPU

  {
    id: 3,
    name: "ruang-lampu",                       // Light room: the beacon is down here
    sort: "3",
    header: "Ruang lampu. Sinar padat, 3 penjaga. Jalan ke atas, dijaga ruang.",
    beacon: { x: 470, y: 50, speed: 360 / 5 },             // ruang lampu, paling atas
    spawns: [{ name: "tangga", x: 300, y: 520 }],
    exit: { x: 470, y: 20, label: "HATCH", open: true },
    cover: [
      { x: 0, y: 40, w: 960, h: 560, type: "room" },       // ruang lampu utuh
      { x: 410, y: 30, w: 140, h: 260, type: "lantern" },  // room lampu
      { x: 120, y: 360, w: 740, h: 26, type: "stair" },    // spiral tangga
      { x: 450, y: 580, w: 60, h: 40, type: "hatch" },     // hatch keluar
    ],
    guards: [
      { id: "G4", path: [
          { x: 360, y: 380 }, { x: 470, y: 300 }, { x: 580, y: 380 }, { x: 500, y: 470 }
        ], speed: 62 },
      { id: "G5", path: [
          { x: 200, y: 420 }, { x: 320, y: 280 }, { x: 470, y: 200 }, { x: 640, y: 420 }
        ], speed: 58 },
      { id: "G6", path: [
          { x: 300, y: 520 }, { x: 470, y: 420 }, { x: 640, y: 500 }, { x: 560, y: 330 }
        ], speed: 54 },
    ],
    hints: [
      { text: "Sinar padat: jalani di celah gelap", x: 180, y: 220, color: "#ffd25a" },
      { text: "3 penjaga, cone merah tajam", x: 300, y: 560, color: "#e23d2e" },
      { text: "HATCH di puncak, jam 3", x: 470, y: 600, color: "#24303e" },
    ],
  },
];

/** Build the mutable state of a level for a run. */
export function createLevel(id) {
  const L = LEVELS.find((l) => l.id === id);
  if (!L) throw new Error(`no level ${id}`);
  return {
    id,
    beacon: { ...L.beacon, angle: 0 },
    guardStates: L.guards.map((g) => ({
      id: g.id, x: g.path[0].x, y: g.path[0].y, path: g.path.map((p) => ({ ...p })),
      way: 0, speed: g.speed ?? 64, head: 0, suspicion: 0, state: 0, alertTimer: 0, bob: 0, idleSwing: 0,
    })),
    camera: L.camera ? { ...L.camera, suspicion: 0 } : null,
    player: { x: L.spawns[0].x, y: L.spawns[0].y },
    exit: { ...L.exit },
    cover: L.cover.map((c) => ({ ...c })),
    hints: L.hints.map((h) => ({ ...h, shown: false })),
    code: L.code ? [...L.code] : null,
    codeEntered: false,
    shots: L.shots || {},
  };
}

/** One fixed step of level state: beam rotates, guards think, the camera blinks. */
export function stepLevel(level, dt) {
  level.beacon.angle = (level.beacon.angle + level.beacon.speed * dt) % (Math.PI * 2);
  for (const g of level.guardStates) {
    g.bob = Math.sin(performance.now() / 4200 * Math.PI * 2) * 2;
    g.idleSwing = (g.idleSwing || 0) + dt * 5.2;
  }
  if (level.camera) {
    level.camera.blink = (level.camera.blink || 0) + dt * 6;
  }
}

/** True when the player is at the exit and the exit is open. */
export function atExit(level, player) {
  return Math.hypot(player.x - level.exit.x, player.y - level.exit.y) < 30 && level.exit.open;
}

// ------------------------------------------------------------------ scene

function fill(ctx, color, x, y, w, h) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

export function drawScene(ctx, L) {
  const w = WORLD.width, h = WORLD.height;
  const s = 1;

  // ---- sky (night storm) -------------------------------------------------
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, "#0a0d19");
  sky.addColorStop(0.55, "#151c33");
  sky.addColorStop(1, "#27304a");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  // ---- sea ---------------------------------------------------------------
  ctx.fillStyle = "#162038";
  ctx.fillRect(0, h - 46, w, 46);
  ctx.strokeStyle = "rgba(30,44,70,0.55)";
  ctx.lineWidth = 1;
  for (let k = 0; k < 5; k++) {
    const yy = h - 46 + k * 8 + Math.sin(performance.now() / 900 + k) * 3;
    ctx.beginPath();
    ctx.moveTo(0, yy);
    for (let x = 0; x <= w; x += 12) ctx.lineTo(x, yy + Math.sin(x / 120 + k * 1.7 + performance.now() / 600) * 3);
    ctx.stroke();
  }
  // rain
  ctx.fillStyle = "rgba(200,214,240,0.30)";
  for (let k = 0; k < 120; k++) {
    const x = (performance.now() / 40 + k * 137) % w;
    const y = (performance.now() / 30 + k * 91) % (h - 120);
    ctx.fillRect(x, y, 2, 8 + Math.sin(performance.now() / 200 + k) * 2);
  }

  // ---- dunes -------------------------------------------------------------
  ctx.fillStyle = "#2a3346";
  ctx.beginPath();
  ctx.moveTo(0, h - 46);
  for (let x = 0; x <= w; x += 8) {
    const y = h - 46 - 70 + Math.sin(x / 140) * 14 + Math.sin(x / 360 + 1) * 8;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();

  // ---- the level's structures -------------------------------------------
  structures(ctx, L);
}

/** The concrete silhouettes of every level: the wall, the lighthouse, the dock,
 *  the room, the table, the camera, the stairs. */
function structures(ctx, L) {
  // ---- lighthouse (shared by levels 1 and 2) -----------------------------
  const bx = L.beacon.x, by = L.beacon.y;
  // tower
  ctx.fillStyle = "#242c3c";
  ctx.fillRect(bx - 56, by - 30, 112, 270);
  ctx.strokeStyle = "rgba(60,74,96,0.5)";
  ctx.lineWidth = 2;
  ctx.strokeRect(bx - 56, by - 30, 112, 270);
  // lantern room
  ctx.fillStyle = "#38445a";
  ctx.fillRect(bx - 40, by - 170, 80, 70);
  ctx.fillStyle = "#4a5974";
  ctx.fillRect(bx - 32, by - 190, 64, 40);
  // the lamp glow
  const lg = ctx.createRadialGradient(bx, by - 200, 6, bx, by - 200, 70);
  lg.addColorStop(0, "rgba(255,210,90,0.95)");
  lg.addColorStop(0.4, "rgba(255,210,90,0.35)");
  lg.addColorStop(1, "rgba(255,210,90,0)");
  ctx.fillStyle = lg;
  ctx.fillRect(bx - 70, by - 270, 140, 120);

  if (L.id === 1 || L.id === 2) {
    // ---- sea wall (level 1) ---------------------------------------------
    ctx.fillStyle = "#4a5266";
    ctx.fillRect(150, 540, 670, 30);
    ctx.fillStyle = "rgba(70,80,104,0.9)";
    ctx.fillRect(150, 532, 670, 6);
    // ---- dock planks ----------------------------------------------------
    ctx.fillStyle = "#5b4a32";
    ctx.fillRect(120, 470, 780, 16);
    ctx.strokeStyle = "rgba(40,30,20,0.6)";
    ctx.lineWidth = 1;
    for (let x = 126; x < 900; x += 14) {
      ctx.beginPath();
      ctx.moveTo(x, 470); ctx.lineTo(x, 486);
      ctx.stroke();
    }
    // ---- crates ---------------------------------------------------------
    ctx.fillStyle = "#7a5a3a";
    for (const c of [{ x: 300, y: 440, w: 46, h: 34 }, { x: 410, y: 440, w: 46, h: 34 }, { x: 520, y: 440, w: 46, h: 34 }]) {
      ctx.fillRect(c.x, c.y, c.w, c.h);
      ctx.fillStyle = "#9a7a52";
      ctx.fillRect(c.x + 4, c.y + 4, c.w - 8, c.h - 8);
      ctx.fillStyle = "#7a5a3a";
    }
  }

  if (L.id === 2 || L.id === 3) {
    // ---- guard room / light room walls -----------------------------------
    ctx.fillStyle = "#333c52";
    ctx.fillRect(280, 40, 620, 580);
    ctx.fillStyle = "#3b4560";
    ctx.fillRect(280, 40, 620, 20);
    ctx.fillRect(280, 40, 20, 580);
    ctx.fillRect(880, 40, 20, 580);
    // the east window (the distant lantern, where the beam enters)
    ctx.fillStyle = "#2c3650";
    ctx.fillRect(860, 40, 30, 580);
    // the floor: dark stone
    ctx.fillStyle = "#242c3c";
    ctx.fillRect(296, 52, 588, 548);
    // floor noise
    ctx.fillStyle = "rgba(60,74,96,0.35)";
    for (let k = 0; k < 40; k++) {
      const x = 310 + (performance.now() / 50 + k * 261) % 588;
      const y = 70 + (performance.now() / 60 + k * 173) % 548;
      ctx.fillRect(x, y, 6, 6);
    }

    // ---- table -----------------------------------------------------------
    ctx.fillStyle = "#4a3a2a";
    ctx.fillRect(420, 230, 160, 70);
    ctx.fillStyle = "#5b4a32";
    ctx.fillRect(424, 234, 152, 62);
    // ---- the safe (brankas) ----------------------------------------------
    ctx.fillStyle = "#3a3444";
    ctx.fillRect(470, 320, 80, 90);
    ctx.fillStyle = "rgba(80,74,96,0.7)";
    ctx.fillRect(476, 326, 68, 78);
    ctx.strokeStyle = "rgba(120,114,136,0.5)";
    ctx.lineWidth = 2;
    ctx.strokeRect(476, 326, 68, 78);
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.font = "14px system-ui, sans-serif";
    ctx.fillText("BRANKAS", 486, 366);

    // ---- the keypad panel (papan ketik) -----------------------------------
    ctx.fillStyle = "#2a2434";
    ctx.fillRect(610, 230, 40, 160);
    ctx.fillStyle = "rgba(70,64,84,0.8)";
    ctx.fillRect(614, 234, 32, 152);
    ctx.strokeStyle = "rgba(120,114,136,0.5)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(614, 234, 32, 152);
    for (let k = 0; k < 3; k++) {
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.fillRect(614 + 8, 237 + k * 50, 24, 8);
    }
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillText("KODE", 616, 372);

    // ---- the camera (pantau, dinding barat) -------------------------------
    const cx = 50, cy = 300;
    ctx.fillStyle = "#333c52";
    ctx.fillRect(cx - 12, cy - 23, 24, 46);
    ctx.fillStyle = "#4a5974";
    ctx.fillRect(cx - 8, cy - 19, 16, 38);
    // camera vision cone (static red-orange sector, facing east into the room)
    const cr = L.camera ? L.camera.range || 300 : 300;
    const ca = L.camera ? L.camera.angle : 0;
    ctx.strokeStyle = "rgba(255,138,34,0.55)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    const ch = 32 * Math.PI / 180;
    for (let k = 0; k <= 20; k++) {
      const a = ca - ch / 2 + (k / 20) * ch;
      ctx.lineTo(cx + Math.cos(a) * cr, cy + Math.sin(a) * cr);
    }
    ctx.closePath();
    ctx.stroke();
    // camera icon
    ctx.fillStyle = "rgba(255,138,34,0.95)";
    ctx.font = "18px system-ui, sans-serif";
    ctx.fillText("P", cx + 6, cy + 34);
  }

  if (L.id === 3) {
    // ---- light room: spiral stairs ---------------------------------------
    ctx.fillStyle = "#38445a";
    ctx.beginPath();
    for (let k = 0; k <= 40; k++) {
      const a = (k / 40) * Math.PI * 2;
      const r = 60 + k * 9;
      ctx.lineTo(bx + Math.cos(a) * r, by + Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fillStyle = "rgba(40,50,70,0.85)";
    ctx.fill();
    // ---- the lamp room box -------------------------------------------------
    ctx.fillStyle = "#33405a";
    ctx.fillRect(bx - 70, by - 30, 140, 260);
    ctx.fillStyle = "#4a5974";
    ctx.fillRect(bx - 60, by - 40, 120, 240);
    // ---- the hatch ---------------------------------------------------------
    ctx.fillStyle = "#1a2030";
    ctx.fillRect(bx - 20, by - 60, 40, 40);
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "16px system-ui, sans-serif";
    ctx.fillText("HATCH", bx - 8, by - 38);
  }

  // ---- the exit door -----------------------------------------------------
  const ex = L.exit;
  ctx.fillStyle = ex.open ? "rgba(20,40,20,0.85)" : "rgba(40,40,40,0.9)";
  ctx.fillRect(ex.x - 20, ex.y, 40, 110);
  ctx.strokeStyle = "rgba(60,80,60,0.7)";
  ctx.lineWidth = 2;
  ctx.strokeRect(ex.x - 20, ex.y, 40, 110);
  ctx.fillStyle = ex.open ? "#7fd48a" : "rgba(255,255,255,0.75)";
  ctx.font = "19px system-ui, sans-serif";
  ctx.fillText(ex.label, ex.x + 2, ex.y + 90);
}

/** The tutorial signs painted in level 1 (they label the two light sources). */
export function drawHints(ctx, L, shown) {
  for (let i = 0; i < L.hints.length; i++) {
    const h = L.hints[i];
    if (!shown || !h.shown) continue;
    ctx.fillStyle = "rgba(20,26,38,0.85)";
    ctx.fillRect(h.x - 130, h.y - 34, 260, 30);
    ctx.fillStyle = h.color;
    ctx.fillRect(h.x - 130, h.y - 34, 12, 30);
    ctx.fillStyle = "#e8f1ff";
    ctx.font = "14px system-ui, sans-serif";
    ctx.fillText(h.text, h.x - 124, h.y - 14);
  }
}
