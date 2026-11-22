// Audio: raw WebAudio for The Last Light.
//   footsteps  - a short noise burst, panned toward the guard and quieter with distance,
//                so the shooter localises the guard before it is seen.
//   alarm      - a low wail once the suspicion bar fills.
//   ambience   - storm wind + rain, looping underneath.
// No library: every sound is a hand-built node graph. The master volume is shared so a
// toggle keeps the whole mix together.

import { WORLD } from "./config.js";

let ctx = null;
let master = null;
let ambienceNode = null;
let noiseBuffer = null;

const SAMPLE_RATE = 44100;

/** Create (or resume) the audio context and the master chain. */
export function ready() {
  if (ctx) {
    if (ctx.state === "suspended") ctx.resume();
    return true;
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  ctx = new AC();
  if (ctx.state === "suspended") ctx.resume();
  master = ctx.createGain();
  master.gain.value = 0.6;
  master.connect(ctx.destination);
  return true;
}

/** Global master volume (0..1) after the first user gesture. */
export function masterVolume(v) {
  if (!master) return;
  master.gain.value = Math.min(1, Math.max(0, v));
}

/** A looping noise buffer, built on demand. */
function noiseBufferOf(duration = 1) {
  if (noiseBuffer) return noiseBuffer;
  if (!ctx) return null;
  const len = Math.min(ctx.sampleRate * duration, 2048);
  const buf = ctx.createBuffer(1, len, SAMPLE_RATE);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  noiseBuffer = buf;
  return buf;
}

// ------------------------------------------------------------- footsteps
const FOOTSTEP_LEN = 0.14;

/** Play a footstep for a guard at (gx,gy), panned relative to the player and scaled by vol. */
export function playFootstep(gx, gy, vol) {
  if (!ready()) return;
  if (vol <= 0) return;
  const player = (_state => _state && _state.level && _state.level.player)(_state);
  if (!player) return;
  const src = ctx.createBufferSource();
  src.buffer = noiseBufferOf(FOOTSTEP_LEN);
  if (!src.buffer) return;
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 220;
  hp.Q.value = 0.7;
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 900;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.knee.value = 18;
  comp.ratio.value = 6;
  comp.attack.value = 0.006;
  comp.release.value = 0.14;
  // pan left/right by the guard's horizontal offset from the shooter
  const pan = ctx.createStereoPanner();
  const dx = gx - player.x;
  const panVal = Math.tanh(dx / 260);
  pan.pan.value = panVal;
  const amp = vol * (0.55 + 0.45 * Math.max(0, 1 - (Math.hypot(dx, gy - player.y)) / 260));
  const g = ctx.createGain();
  g.gain.value = amp;
  src.connect(hp);
  hp.connect(lp);
  lp.connect(comp);
  comp.connect(pan);
  pan.connect(g);
  g.connect(master);
  src.start(0);
  src.stop(ctx.currentTime + FOOTSTEP_LEN + 0.02);
}

// ----------------------------------------------------------------- alarm
export function playAlarm() {
  if (!ready()) return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const lfo = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sawtooth";
  osc.frequency.value = 118;
  osc2.type = "square";
  osc2.frequency.value = 118 * 1.004;
  lfo.type = "sine";
  lfo.frequency.value = 5.2;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 14;
  lfo.connect(lfoGain);
  lfoGain.connect(osc.frequency);
  lfoGain.connect(osc2.frequency);
  gain.gain.value = 0;
  osc.connect(gain);
  osc2.connect(gain);
  gain.connect(master);
  osc.start(t);
  osc2.start(t);
  lfo.start(t);
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(0.45, t + 0.18);
  gain.gain.linearRampToValueAtTime(0.12, t + 2.6);
  gain.gain.linearRampToValueAtTime(0, t + 3.1);
  osc.stop(t + 3.1);
  osc2.stop(t + 3.1);
  lfo.stop(t + 3.1);
}

const CONFIRMED_TONE = 784; // D6
const WRONG_TONE = 220;     // A3
const TONE_LEN = 0.16;

export function playConfirmed() {
  if (!ready()) return;
  beep(CONFIRMED_TONE, TONE_LEN, 0.5);
}

export function playWrong() {
  if (!ready()) return;
  beep(WRONG_TONE, TONE_LEN, 0.35);
}

function beep(freq, len, vol) {
  const src = ctx.createOscillator();
  const g = ctx.createGain();
  src.type = "square";
  src.frequency.value = freq;
  g.gain.value = vol;
  src.connect(g);
  g.connect(master);
  src.start(0);
  src.stop(0 + len);
  // a tiny click at the edge
  const c = ctx.createGain();
  c.gain.value = vol * 0.5;
  const cSrc = ctx.createBufferSource();
  cSrc.buffer = noiseBufferOf(0.012);
  const cHp = ctx.createBiquadFilter();
  cHp.type = "highpass";
  cHp.frequency.value = 1200;
  cSrc.connect(cHp);
  cHp.connect(c);
  c.connect(master);
  cSrc.start(0);
  cSrc.stop(0 + 0.012);
}

// -------------------------------------------------------------- ambience
export function startAmbience() {
  if (!ready()) return;
  if (ambienceNode) return;
  // wind: continuous filtered noise, slowly breathing
  const wb = ctx.createBufferSource();
  wb.buffer = noiseBufferOf(2);
  wb.loop = true;
  const wf = ctx.createBiquadFilter();
  wf.type = "lowpass";
  wf.frequency.value = 260;
  wf.Q.value = 0.5;
  const wg = ctx.createGain();
  wg.gain.value = 0.45;
  wb.connect(wf);
  wf.connect(wg);
  wg.connect(master);
  wb.start(0);
  // rain: many short, sparse clicks
  const rainCount = 36;
  for (let i = 0; i < rainCount; i++) {
    const s = ctx.createBufferSource();
    s.buffer = noiseBufferOf(0.4 + Math.random() * 0.4);
    s.loop = false;
    const g = ctx.createGain();
    g.gain.value = 0.05 + Math.random() * 0.03;
    const rp = ctx.createBiquadFilter();
    rp.type = "highpass";
    rp.frequency.value = 700;
    s.connect(rp);
    rp.connect(g);
    g.connect(master);
    s.start(0);
  }
  ambienceNode = { wb, wg, wf, rainCount };
}

export function stopAmbience() {
  if (!ambienceNode || !ctx) return;
  try {
    ambienceNode.wb.stop();
    ambienceNode.wb.disconnect();
  } catch (_) { /* already stopped */ }
  ambienceNode = null;
}

// A cheap hold on the module-level game state for the footstep mapper (set once at boot).
let _state = null;
export function setGameState(s) { _state = s; }
