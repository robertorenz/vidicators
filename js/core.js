'use strict';
// ---------------------------------------------------------------------------
// Core constants, math helpers and persistent settings.
// Game logic runs in logical pixels based on the Atari System 2 screen (512x384).
// ---------------------------------------------------------------------------
const TILE = 32;
const WALL_H = 12;           // height of the pseudo-3D wall face in pixels
// The view is always 384 logical pixels tall; its width stretches with the
// window (512 = the arcade's 4:3, up to 16:9 and a bit beyond) so the game can
// fill the screen. RS is the device-pixel scale the canvas is rendered at.
const BASE_W = 512;
let VIEW_W = BASE_W;
const VIEW_H = 384;
let RS = 1;
const HUD_H = 28;
const VIEW_GH = VIEW_H - HUD_H;
const TAU = Math.PI * 2;
const LEVELS_PER_STATION = 3;
const NUM_STATIONS = 14;

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const rand = (a, b) => a + Math.random() * (b - a);
const lerp = (a, b, t) => a + (b - a) * t;

function angDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= TAU;
  while (d < -Math.PI) d += TAU;
  return d;
}

const Settings = {
  controlMode: 'simple',   // 'simple' (rotate/drive) or 'classic' (twin tread sticks)
  sound: true,
  volume: 0.7,
  speech: true,
  radar: true,
  difficulty: 'normal',
  KEYS: ['controlMode', 'sound', 'volume', 'speech', 'radar', 'difficulty'],
  load() {
    try {
      const s = JSON.parse(localStorage.getItem('vindicators.settings') || '{}');
      for (const k of this.KEYS) if (k in s) this[k] = s[k];
    } catch (e) { /* storage unavailable */ }
  },
  save() {
    try {
      const o = {};
      for (const k of this.KEYS) o[k] = this[k];
      localStorage.setItem('vindicators.settings', JSON.stringify(o));
    } catch (e) { /* storage unavailable */ }
  },
};

const DEFAULT_SCORES = [
  ['ATR', 120000, 14], ['VND', 95000, 11], ['TNK', 80000, 9], ['EDL', 65000, 8],
  ['JMP', 50000, 6], ['GRN', 40000, 5], ['RED', 30000, 4], ['BLU', 20000, 3],
  ['SYS', 15000, 2], ['TWO', 10000, 1],
].map(([name, score, station]) => ({ name, score, station }));

function loadHiscores() {
  try {
    const s = JSON.parse(localStorage.getItem('vindicators.hiscores'));
    if (Array.isArray(s) && s.length) return s;
  } catch (e) { /* ignore */ }
  return DEFAULT_SCORES.map(o => ({ ...o }));
}

function saveHiscores(list) {
  try { localStorage.setItem('vindicators.hiscores', JSON.stringify(list)); } catch (e) { /* ignore */ }
}
