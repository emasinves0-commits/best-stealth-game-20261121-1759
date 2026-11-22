// The Last Light - boot and the game loop.
//
// The game moves between five screens: menu, bermain (play), paused, tertangkap (caught)
// and menang (win). One fixed 1/60 s step advances every rule (guards, beam, alarm, stillness,
// player); the renderer paints each frame. The beacon beam is the level jam: a warm YELLOW
// wedge that rotates 360 deg and lit-tests the world, while every guard keeps a sharp RED
// cone. Detection is always recoverable: the suspicion meter falls back to zero in shadow,
// the alarm meter decays when fully hidden, and the Keheningan rating recovers too.
//
// Input: WASD / arrows to walk, mouse target to step, Enter / click to confirm, P to pause
// or resume. Level 2 needs a 3-digit code at the keypad (keys 0-9, Enter to confirm).

import { WORLD } from "./config.js";
import { STEP, MAX_STEP, PLAYER, BEACON, GUARD, ALARM, STILL, AUDIO } from "./config.js";
import { LEVELS, createLevel, stepLevel, atExit, drawScene, drawHints } from "./levels.js";
import { createInput } from "./input.js";
import { updateGuard, drawGuard } from "./guards.js";
import { bearing, lineOfSight } from "./vision.js";
import { isLit } from "./lighting.js";
import { drawHUD } from "./hud.js";
import {
  ready as audioReady,
  playFootstep,
  playAlarm,
  playConfirmed,
  playWrong,
  startAmbience,
  stopAmbience,
  setGameState,
} from "./audio.js";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const W = WORLD.width;
const H = WORLD.height;

// ---------------------------------------------------------------- state

const state = {
  screen: "menu",             // menu | play | paused | tertangkap | menang
  levelIndex: 0,
  levels: LEVELS,
  level: null,
  player: { x: 0, y: 0 },
  playerPrev: { x: 0, y: 0 },
  guards: [],
  camera: null,
  alarmMeter: 0,
  still: 0,
  beamSpeedDeg: 0,
  lightIndicator: { x: W - 302, y: 26, state: "gelap" },
  playerLit: false,
  levelsDone: 0,
  codeDigits: [],            // keypad entry for level 2
  detectedI: -1,             // index of the guard that currently sees the player
};

const input = createInput();

// ---------------------------------------------------------------- helpers

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const hypot = (x, y) => Math.hypot(x, y);

function startLevel(index) {
  const L = state.levels[index];
  const level = createLevel(L.id);
  state.levelIndex = index;
  state.level = level;
  state.player.x = level.player.x;
  state.player.y = level.player.y;
  state.playerPrev.x = level.player.x;
  state.playerPrev.y = level.player.y;
  state.alarmMeter = 0;
  state.still = 0;
  state.codeDigits = [];
  state.detectedI = -1;
  state.screen = "play";
  state.camera = level.camera;
  if (index === 0) startAmbience();
  else stopAmbience();
}

/** Is the player currently seen by any guard? Returns the guard index or -1. */
function playerSeen(level, player, guards) {
  for (let i = 0; i < guards.length; i++) {
    const g = guards[i];
    if (g.state === "dead") continue;
    const dx = player.x - g.x;
    const dy = player.y - g.y;
    const dist = hypot(dx, dy);
    if (dist > GUARD.coneRange * 1.05) continue;
    const toPlayer = bearing(g.x, g.y, player.x, player.y);
    const half = (g.coneWidth ?? GUARD.coneWidth) * Math.PI / 180 * 0.5;
    if (Math.abs(toPlayer - g.head) > half) continue;
    if (!isLit(level, player.x, player.y)) continue;
    if (!lineOfSight(level, g.x, g.y, player.x, player.y)) continue;
    return i;
  }
  return -1;
}

/** Move the player: mouse target wins, otherwise WASD / arrows. */
function movePlayer(dt) {
  const player = state.level.player;
  let mx = 0,
    my = 0;
  if (input.keys.has("left")) mx -= 1;
  if (input.keys.has("right")) mx += 1;
  if (input.keys.has("up")) my -= 1;
  if (input.keys.has("down")) my += 1;
  const kl = hypot(mx, my);
  if (kl > 0) {
    mx /= kl;
    my /= kl;
  }

  let tx = 0,
    ty = 0;
  if (input.target && input.mouseDown) {
    tx = input.target.x * WORLD.width - player.x;
    ty = input.target.y * WORLD.height - player.y;
  }
  let vx = 0,
    vy = 0;
  if (hypot(tx, ty) > 0) {
    const tl = hypot(tx, ty);
    if (tl > 0) {
      tx /= tl;
      ty /= tl;
    }
    vx = tx * PLAYER.speed * dt;
    vy = ty * PLAYER.speed * dt;
  } else if (kl > 0) {
    vx = mx * PLAYER.speed * dt;
    vy = my * PLAYER.speed * dt;
  }
  player.x = clamp(player.x + vx, 0, WORLD.width - PLAYER.width);
  player.y = clamp(player.y + vy, 0, WORLD.height - PLAYER.height);
  state.playerPrev.x = player.x;
  state.playerPrev.y = player.y;
}

/** The beacon wedge polygon (warm yellow sweep), shared with the lit-test. */
function beamPolygon(level, spread) {
  const { x: bx, y: by } = level.beacon;
  const half = (spread ?? level.beacon.halfWidth) * Math.PI / 180;
  const a0 = level.beacon.angle - half;
  const a1 = level.beacon.angle + half;
  const len = Math.max(240, WORLD.width + WORLD.height - 40);
  return [
    { x: bx, y: by },
    { x: bx + Math.cos(a0) * len, y: by + Math.sin(a0) * len },
    { x: bx + Math.cos(a1) * len, y: by + Math.sin(a1) * len },
  ];
}

// ---------------------------------------------------------------- draw

function drawPlayer() {
  const p = state.level.player;
  const lit = state.playerLit;
  ctx.save();
  // ground shadow
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + 12, 11, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  // body
  const bright = lit ? 1 : 0.3;
  ctx.fillStyle = `rgba(26,32,44,${bright})`;
  ctx.fillRect(p.x - 8, p.y - 13, 16, 26);
  ctx.fillStyle = lit ? "#405068" : "#141b26";
  ctx.fillRect(p.x - 8, p.y - 13, 16, 26);
  // back pack
  ctx.fillStyle = lit ? "#2a3444" : "#0e141e";
  ctx.fillRect(p.x - 11, p.y - 11, 6, 10);
  // personal lamp (weak: never reveals, just a light on the shooter)
  ctx.fillStyle = "#ffd25a";
  ctx.beginPath();
  ctx.arc(p.x - 2, p.y + 4, 3.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawOverlay() {
  const s = state.screen;
  const level = state.level;
  const w = canvas.width,
    h = canvas.height;
  if (s === "menu") {
    ctx.fillStyle = "rgba(5,8,15,0.62)";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#ffd25a";
    ctx.font = "bold 54px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("THE LAST LIGHT", w / 2, h / 2 - 80);
    ctx.fillStyle = "#c7d3e6";
    ctx.font = "20px system-ui, sans-serif";
    ctx.fillText("Penjaga mercusar. Sinar kuning = bahaya. Bayi = aman.", w / 2, h / 2 - 24);
    ctx.fillStyle = "#ffd25a";
    ctx.font = "20px system-ui, sans-serif";
    ctx.fillText("Tekan SPACE / klik untuk mulai", w / 2, h / 2 + 40);
    return;
  }
  if (s === "tertangkap") {
    ctx.fillStyle = "rgba(10,6,6,0.62)";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#ff6e64";
    ctx.font = "bold 52px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("TERTANGKAP", w / 2, h / 2 - 60);
    ctx.fillStyle = "#ffd25a";
    ctx.font = "20px system-ui, sans-serif";
    ctx.fillText("Rintik alarm. Tekan SPACE untuk ulang level.", w / 2, h / 2 + 40);
    return;
  }
  if (s === "menang") {
    ctx.fillStyle = "rgba(4,9,7,0.62)";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#7fd48a";
    ctx.font = "bold 52px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("MENANG", w / 2, h / 2 - 60);
    ctx.fillStyle = "#c7d3e6";
    ctx.font = "20px system-ui, sans-serif";
    ctx.fillText("Fokus. Diam. Lolos. Tekan SPACE untuk level berikutnya.", w / 2, h / 2 + 40);
    return;
  }
  if (s === "play" && level && level.code) {
    // keypad readout for level 2
    ctx.fillStyle = "rgba(4,9,7,0.55)";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#ffd25a";
    ctx.font = "bold 20px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("KODE " + state.codeDigits.length + "/" + level.code.length, w / 2, 54);
    ctx.fillStyle = "#c7d3e6";
    ctx.font = "15px system-ui, sans-serif";
    for (let i = 0; i < level.code.length; i++) {
      const cx = w / 2 - 60 + i * 44;
      ctx.fillStyle = state.codeDigits[i] === undefined ? "#2a3346" : "#ffd25a";
      ctx.fillText(state.codeDigits[i] === undefined ? "·" : String(state.codeDigits[i]), cx, 86);
    }
    ctx.fillStyle = state.level.codeEntered ? "#7fd48a" : "#ffd25a";
    ctx.font = "16px system-ui, sans-serif";
    ctx.fillText(state.level.codeEntered ? "KODE BENAR" : "Ketik 3 digit di keypad", w / 2, 112);
  }
}

// ---------------------------------------------------------------- main draw

function draw() {
  const level = state.level;
  const guards = level.guardStates;
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  // Map the 960x640 world onto the 1280x720 canvas so the game fills the entire
  // frame. Every drawing below runs in the transformed, canvas-pixel space, clipped
  // to the 1280x720 frame so the beam, cone, level and HUD never escape it.
  const SX = canvas.width / WORLD.width;   // 1.333
  const SY = canvas.height / WORLD.height; // 1.125

  ctx.save();
  ctx.setTransform(SX, 0, 0, SY, 0, 0);
  ctx.beginPath();
  ctx.rect(0, 0, canvas.width, canvas.height);
  ctx.clip();

  // background scene + structures (sky, sea, rain, dunes, cover, exit)
  drawScene(ctx, level);

  // the beacon beam: warm yellow wedge (the level jam)
  const beam = beamPolygon(level, BEACON.halfWidth);
  {
    const b0 = beam[0],
      b1 = beam[1],
      b2 = beam[2];
    // outer glow
    const gl = ctx.createRadialGradient(b0.x, b0.y, 4, b0.x, b0.y, 220);
    gl.addColorStop(0, "rgba(255,210,90,0.20)");
    gl.addColorStop(1, "rgba(255,210,90,0)");
    ctx.fillStyle = gl;
    ctx.beginPath();
    ctx.moveTo(b0.x, b0.y);
    ctx.lineTo(b1.x, b1.y);
    ctx.lineTo(b2.x, b2.y);
    ctx.closePath();
    ctx.fill();
    // beam body (kuning emas hangat)
    const bw = ctx.createRadialGradient(b0.x, b0.y, 2, b0.x, b0.y, 150);
    bw.addColorStop(0, "rgba(255,210,90,0.95)");
    bw.addColorStop(0.5, "rgba(255,210,90,0.45)");
    bw.addColorStop(1, "rgba(255,210,90,0.05)");
    ctx.fillStyle = bw;
    ctx.beginPath();
    ctx.moveTo(b0.x, b0.y);
    ctx.lineTo(b1.x, b1.y);
    ctx.lineTo(b2.x, b2.y);
    ctx.closePath();
    ctx.fill();
    // bright centre line so the direction is legible at a glance
    const line = ctx.createLinearGradient(b0.x, b0.y, b1.x, b1.y);
    line.addColorStop(0, "rgba(255,210,90,0)");
    line.addColorStop(1, "rgba(255,210,90,0.35)");
    ctx.strokeStyle = line;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(b0.x + (b1.x - b0.x) * 0.06, b0.y + (b1.y - b0.y) * 0.06);
    ctx.lineTo(b0.x + (b1.x - b0.x) * 0.94, b0.y + (b1.y - b0.y) * 0.94);
    ctx.stroke();
  }

  // guards + their red vision cone (sharp tajam)
  for (const g of guards) {
    if (g.state === "dead") continue;
    drawGuard(ctx, g, level);
  }

  // player
  drawPlayer();

  // level 1 tutorial signs
  if (level.id === 1) drawHints(ctx, level, level.hints.every((h) => h.shown));

  // HUD
  drawHUD(ctx, state);

  // overlay for the current screen
  drawOverlay();

  ctx.restore();
}

// ---------------------------------------------------------------- loop

let lastTime = performance.now();
let accumulator = 0;

function stepGame(dt) {
  const level = state.level;
  const player = level.player;
  const guards = level.guardStates;

  state.beamSpeedDeg = level.beacon.speed;
  state.lightIndicator.state = isLit(level, player.x, player.y) ? "terang" : "gelap";

  // 1 guards: path, suspicion, head direction
  for (const g of guards) {
    if (g.state === "dead") continue;
    updateGuard(g, level, dt, player);
  }

  // 2 level jam
  stepLevel(level, dt);

  // 3 detection -> alarm
  const detectedI = playerSeen(level, player, guards);
  state.detectedI = detectedI;
  state.playerLit = isLit(level, player.x, player.y);
  const lit = state.playerLit;
  if (detectedI >= 0) {
    const g = guards[detectedI];
    const d = hypot(player.x - g.x, player.y - g.y);
    let add = ALARM.fillRate * dt;
    if (d < 60) add += ALARM.nearBonus * dt;
    state.alarmMeter = Math.min(1, state.alarmMeter + add);
  } else {
    state.alarmMeter = Math.max(0, state.alarmMeter - ALARM.decayRate * dt);
  }

  // 4 stillness rating (Keheningan)
  const calm = state.alarmMeter < 0.4 && lit;
  state.still = calm ? Math.min(3, state.still + STILL.gain * dt) : Math.max(0, state.still - STILL.decay * dt);

  // 5 player
  movePlayer(dt);

  // 6 screen transitions (win / caught)
  if (level.exit.open && atExit(level, player)) {
    if (state.levelIndex < state.levels.length - 1) {
      startLevel(state.levelIndex + 1);
    } else {
      state.screen = "menang";
    }
  }
  if (state.alarmMeter >= 1) state.screen = "tertangkap";

  // footsteps that announce guard positions before they are seen
  runFootsteps(dt);
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - lastTime) / 1000, MAX_STEP);
  lastTime = now;

  if (state.screen === "play") {
    accumulator += dt;
    while (accumulator >= STEP) {
      stepGame(STEP);
      accumulator -= STEP;
    }
    // smooth interpolation of the player for a stable catch-up
    const alpha = accumulator / STEP;
    state.playerPrev.x = state.player.x - (state.player.x - state.playerPrev.x) * alpha;
    state.playerPrev.y = state.player.y - (state.player.y - state.playerPrev.y) * alpha;
  } else {
    accumulator = 0;
  }

  draw();
}

// ---------------------------------------------------------------- audio hooks

let footstepTimer = 0;

function runFootsteps(dt) {
  if (!audioReady()) return;
  const level = state.level;
  const player = level.player;
  const guards = level.guardStates;
  if (!level) return;
  for (const g of guards) {
    if (g.state === "dead") continue;
    footstepTimer += dt;
    if (footstepTimer > 1.0 / 3.0) {
      footstepTimer = 0;
      const d = hypot(g.x - player.x, g.y - player.y);
      const vol = AUDIO.footstep * (0.55 + 0.45 * Math.max(0, 1 - d / 260));
      if (vol > 0.005) playFootstep(g.x, g.y, vol);
    }
  }
}

// ---------------------------------------------------------------- boot

const LEVELS_COUNT = state.levels.length;
startLevel(0);

// keypad for level 2
window.addEventListener("keydown", (e) => {
  if (state.screen !== "play" || state.levelIndex !== 1) return;
  const level = state.level;
  if (level.code === undefined) return;
  const d = parseInt(e.key, 10);
  if (d >= 0 && d <= 9 && !level.codeEntered) {
    e.preventDefault();
    if (state.codeDigits.length < level.code.length) {
      state.codeDigits.push(d);
      if (state.codeDigits.length === level.code.length) {
        if (level.code.every((v, i) => v === state.codeDigits[i])) {
          level.exit.open = true;
          level.codeEntered = true;
          playConfirmed();
        } else {
          playWrong();
          state.codeDigits = [];
        }
      }
    }
  } else if (e.key === "Backspace" || e.key === "Delete") {
    e.preventDefault();
    state.codeDigits = state.codeDigits.slice(0, -1);
  } else if (e.key === "Enter") {
    e.preventDefault();
    if (level.codeEntered && level.exit.open === false) {
      level.exit.open = true;
      playConfirmed();
    }
  } else if (e.key === "p" || e.key === "P") {
    if (state.screen === "play") {
      e.preventDefault();
      state.screen = "paused";
    } else if (state.screen === "paused") {
      e.preventDefault();
      state.screen = "play";
    }
  }
});

// mouse click on the canvas starts the game from the menu (and restarts a lost level)
canvas.addEventListener("pointerdown", (e) => {
  if (state.screen === "menu") {
    e.preventDefault();
    startLevel(0);
  } else if (state.screen === "tertangkap" || state.screen === "menang") {
    e.preventDefault();
    startLevel(state.levelIndex);
  }
});

setGameState(state);

// debugging handle for the orchestrator's screenshot/play checks
window.__GAME = state;
// advance one step when the game is in play (used by screenshot/play harnesses)
window.__GAME.step = (dt) => { if (state.screen === "play") stepGame(dt); };

frame(performance.now());
