// The Last Light - config: one source of truth for the world, the beam, the guards
// and the detection/alarm maths. Pure data, no DOM, no browser: this file is shared
// by every module so the numbers stay consistent.
"use strict";

/** World size in logical units (960x640 painted at 1280x720). */
export const WORLD = { width: 960, height: 640 };
export const STEP = 1 / 60;            // fixed timestep (seconds)
export const MAX_STEP = 0.05;          // a stalled frame (hidden tab) never jumps > this

// Player
export const PLAYER = {
  width: 16, height: 26,
  speed: 340,              // units/s when walking (keyboard or mouse)
  lamp: 7,                 // weak personal lamp radius (does NOT reveal the player)
};

// The lighthouse beacon: the giant rotating vision cone AND the level jam.
// Must stay a warm YELLOW wedge (it is the level jam); the guards' cones stay RED.
export const BEACON = {
  halfWidth: 9,           // beam spread, degrees
  minSpeed: 360 / 14,     // slowest sweep (seconds per turn), degrees/s
  maxSpeed: 360 / 5,      // densest sweep in the final level, degrees/s
};

// Guard vision cone: sharp RED. The two light sources must never be confused.
export const GUARD = {
  coneWidth: 64,          // degrees of the cone
  coneRange: 260,         // units
  scanSpeed: 360 / 11,    // head swivel idle oscillation, degrees/s
  idleAmp: 22,            // idle cone oscillation amplitude, degrees
  suspicionRate: 6.8,     // suspicion +/s when lit AND inside the cone
  recoverRate: 5.6,       // suspicion -/s when fully hidden
  nearBonus: 1.8,         // extra suspicion near-miss: player close + lit
  alertFlash: 6,          // seconds the cone stays flared on full alarm
  headBob: 4.2,           // seconds, guard idle head bob
};

// Detection -> alarm (recoverable). The alarm is a warning, never instant death.
export const ALARM = {
  fillRate: 30,           // alarm meter +/s per full detection
  decayRate: 8,           // alarm -/s when fully hidden
  ringAfter: 4.5,         // seconds after the alarm starts before it wails
  lockTime: 6,            // seconds the exit stays locked after the wail
  nearBonus: 2.0,         // near-miss multiplier on the alarm meter
};

// Keheningan (stillness / professionalism) rating 0..3 stars.
export const STILL = {
  gain: 1.1,              // stars +/s of calm movement, no alarm
  decay: 1.6,             // stars -/s of detection
  cap: 3,
};

// Audio
export const AUDIO = {
  footstep: 0.20,         // base step volume
  stepSnap: 0.55,         // extra snap when a guard is almost on you
  wind: 0.055,
  rain: 0.20,
  whoosh: 0.018,
};
