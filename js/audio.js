'use strict';
// ---------------------------------------------------------------------------
// Synthesized arcade sound effects (Web Audio) + robotic speech callouts.
// ---------------------------------------------------------------------------
const Sound = {
  ctx: null, master: null, noiseBuf: null, last: {},
  engOsc: null, engGain: null, engFilter: null,

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.connect(this.ctx.destination);
    this.applyVolume();
    const len = this.ctx.sampleRate;
    const b = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = b;

    // Low engine rumble, modulated by how hard the tanks are driving.
    this.engOsc = this.ctx.createOscillator();
    this.engOsc.type = 'sawtooth';
    this.engOsc.frequency.value = 40;
    this.engFilter = this.ctx.createBiquadFilter();
    this.engFilter.type = 'lowpass';
    this.engFilter.frequency.value = 260;
    this.engGain = this.ctx.createGain();
    this.engGain.gain.value = 0;
    this.engOsc.connect(this.engFilter); this.engFilter.connect(this.engGain); this.engGain.connect(this.master);
    this.engOsc.start();
  },

  applyVolume() {
    if (this.master) this.master.gain.value = Settings.sound ? 0.45 * Settings.volume : 0;
  },

  ok(name, gap) {
    if (!this.ctx || !Settings.sound) return false;
    const now = this.ctx.currentTime;
    if (gap && this.last[name] && now - this.last[name] < gap) return false;
    this.last[name] = now;
    return true;
  },

  tone(type, f0, f1, dur, vol = 0.3, delay = 0) {
    const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.05);
  },

  noise(dur, vol, f0, f1 = f0, delay = 0) {
    const c = this.ctx, t = c.currentTime + delay;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = 'lowpass';
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.master);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  },

  engine(v) {
    if (!this.engGain) return;
    const t = this.ctx.currentTime;
    this.engGain.gain.setTargetAtTime(v > 0 ? 0.03 + v * 0.05 : 0, t, 0.08);
    this.engOsc.frequency.setTargetAtTime(38 + v * 26, t, 0.1);
  },

  shot() { if (!this.ok('shot', 0.03)) return; this.tone('square', 1100, 160, 0.13, 0.16); this.noise(0.06, 0.12, 5000, 800); },
  eshot() { if (!this.ok('eshot', 0.07)) return; this.tone('sawtooth', 520, 110, 0.16, 0.09); },
  spark() { if (!this.ok('spark', 0.05)) return; this.noise(0.05, 0.08, 6000, 1500); },
  hitEnemy() { if (!this.ok('hitE', 0.04)) return; this.tone('square', 300, 120, 0.07, 0.12); },
  explode(big) {
    if (!this.ok('boom' + (big ? 1 : 0), 0.05)) return;
    this.noise(big ? 1.1 : 0.5, big ? 0.7 : 0.45, big ? 1200 : 2200, 60);
    this.tone('sine', big ? 110 : 160, 28, big ? 0.9 : 0.4, 0.45);
  },
  hurt() { if (!this.ok('hurt', 0.12)) return; this.tone('square', 240, 50, 0.25, 0.25); this.noise(0.2, 0.3, 1600, 200); },
  deflect() { if (!this.ok('defl', 0.06)) return; this.tone('triangle', 1600, 700, 0.12, 0.16); },
  shieldOn() { if (!this.ok('shOn', 0.2)) return; this.tone('sine', 260, 1100, 0.25, 0.14); },
  fuel() { if (!this.ok('fuel', 0.05)) return; [440, 660, 880, 1320].forEach((f, i) => this.tone('square', f, f, 0.07, 0.1, i * 0.055)); },
  star() { if (!this.ok('star', 0.05)) return; this.tone('triangle', 1300, 2000, 0.09, 0.2); this.tone('triangle', 2000, 2600, 0.12, 0.16, 0.08); },
  shieldPick() { if (!this.ok('shp', 0.05)) return; [520, 780, 1040].forEach((f, i) => this.tone('sine', f, f * 1.5, 0.1, 0.14, i * 0.07)); },
  exit() { if (!this.ok('exit', 0.5)) return; this.tone('sawtooth', 120, 1800, 1.3, 0.16); this.tone('square', 60, 900, 1.3, 0.08); },
  alarm() { if (!this.ok('alarm', 0.5)) return; this.tone('square', 920, 920, 0.2, 0.1); this.tone('square', 690, 690, 0.2, 0.1, 0.25); },
  lowFuel() { if (!this.ok('low', 0.5)) return; this.tone('square', 330, 330, 0.09, 0.14); this.tone('square', 330, 330, 0.09, 0.14, 0.14); },
  buy() { if (!this.ok('buy', 0.05)) return; this.tone('square', 660, 1320, 0.12, 0.14); this.tone('square', 990, 1980, 0.1, 0.1, 0.06); },
  deny() { if (!this.ok('deny', 0.1)) return; this.tone('square', 150, 100, 0.22, 0.18); },
  blip() { if (!this.ok('blip', 0.04)) return; this.tone('square', 880, 880, 0.04, 0.08); },
  coin() { if (!this.ok('coin', 0.1)) return; [523, 659, 784, 1046].forEach((f, i) => this.tone('square', f, f, 0.09, 0.12, i * 0.07)); },

  say(text) {
    if (!Settings.speech || !Settings.sound || !window.speechSynthesis) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.pitch = 0.1; u.rate = 0.85; u.volume = Settings.volume;
      speechSynthesis.speak(u);
    } catch (e) { /* speech unavailable */ }
  },
};
