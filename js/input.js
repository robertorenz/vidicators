'use strict';
// ---------------------------------------------------------------------------
// Keyboard + gamepad input. The arcade cabinet used two tread joysticks per
// player; "classic" mode maps each tread to its own pair of keys / stick,
// while "simple" mode lets you steer with four directions.
// ---------------------------------------------------------------------------
const KEYMAP = {
  simple: [
    { up: ['KeyW'], down: ['KeyS'], left: ['KeyA'], right: ['KeyD'], fire: ['Space', 'KeyF'], shield: ['KeyG', 'ShiftLeft'], start: ['Digit1'] },
    { up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'], fire: ['Enter', 'NumpadEnter', 'Period'], shield: ['ShiftRight', 'Slash'], start: ['Digit2'] },
  ],
  classic: [
    { lf: ['KeyQ'], lb: ['KeyA'], rf: ['KeyE'], rb: ['KeyD'], fire: ['Space', 'KeyF'], shield: ['KeyG', 'ShiftLeft'], start: ['Digit1'] },
    { lf: ['KeyU'], lb: ['KeyJ'], rf: ['KeyO'], rb: ['KeyL'], fire: ['Enter', 'NumpadEnter', 'Period'], shield: ['ShiftRight', 'Slash'], start: ['Digit2'] },
  ],
};

const GAME_KEYS = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Slash', 'Period', 'ShiftLeft', 'ShiftRight']);
const EDGE = ['fire', 'shield', 'start', 'up', 'down', 'left', 'right'];
const blank = () => ({ L: 0, R: 0, fire: false, shield: false, start: false, up: false, down: false, left: false, right: false });

const Input = {
  keys: Object.create(null),
  tapped: new Set(),   // keys pressed since the last poll, so quick taps are never missed
  blocked: false,
  soloP1: true,        // set by the game while player 2 is not in play
  c: [blank(), blank()],
  pauseP: false, pausePrev: false,

  init() {
    window.addEventListener('keydown', e => {
      if (this.blocked) return;
      this.keys[e.code] = true;
      if (!e.repeat) this.tapped.add(e.code);
      if (GAME_KEYS.has(e.code)) e.preventDefault();
      Sound.init();
    });
    window.addEventListener('keyup', e => { this.keys[e.code] = false; });
    window.addEventListener('blur', () => this.clear());
    window.addEventListener('pointerdown', () => Sound.init());
  },

  clear() { this.keys = Object.create(null); this.tapped.clear(); },
  any(list) { for (const k of list) if (this.keys[k] || this.tapped.has(k)) return true; return false; },

  poll() {
    const mode = Settings.controlMode === 'classic' ? 'classic' : 'simple';
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (let i = 0; i < 2; i++) {
      const km = KEYMAP[mode][i];
      const c = blank();
      if (mode === 'simple') {
        c.up = this.any(km.up); c.down = this.any(km.down);
        c.left = this.any(km.left); c.right = this.any(km.right);
        const fwd = (c.up ? 1 : 0) - (c.down ? 1 : 0), turn = (c.right ? 1 : 0) - (c.left ? 1 : 0);
        c.L = clamp(fwd + turn, -1, 1); c.R = clamp(fwd - turn, -1, 1);
      } else {
        const lf = this.any(km.lf), lb = this.any(km.lb), rf = this.any(km.rf), rb = this.any(km.rb);
        c.L = (lf ? 1 : 0) - (lb ? 1 : 0); c.R = (rf ? 1 : 0) - (rb ? 1 : 0);
        c.up = lf || rf; c.down = lb || rb;
        c.left = rf && !lf; c.right = lf && !rf;
      }
      c.fire = this.any(km.fire); c.shield = this.any(km.shield); c.start = this.any(km.start);
      if (i === 0 && this.soloP1) this.mergeArrows(c);

      const pad = pads && pads[i];
      if (pad && pad.connected) this.mergePad(c, pad, mode);

      const prev = this.c[i];
      for (const k of EDGE) c[k + 'P'] = c[k] && !prev[k];
      this.c[i] = c;
    }
    const pz = this.any(['Escape', 'KeyP']);
    this.tapped.clear();
    this.pauseP = pz && !this.pausePrev;
    this.pausePrev = pz;
  },

  // While player 2 hasn't joined, the arrow keys also steer player 1.
  mergeArrows(c) {
    const up = this.any(['ArrowUp']), dn = this.any(['ArrowDown']);
    const lt = this.any(['ArrowLeft']), rt = this.any(['ArrowRight']);
    c.up = c.up || up; c.down = c.down || dn; c.left = c.left || lt; c.right = c.right || rt;
    const fwd = (up ? 1 : 0) - (dn ? 1 : 0), turn = (rt ? 1 : 0) - (lt ? 1 : 0);
    if (fwd || turn) { c.L = clamp(fwd + turn, -1, 1); c.R = clamp(fwd - turn, -1, 1); }
  },

  mergePad(c, pad, mode) {
    const ax = i => { const v = pad.axes[i] || 0; return Math.abs(v) < 0.25 ? 0 : v; };
    const bt = i => !!(pad.buttons[i] && pad.buttons[i].pressed);
    const dU = bt(12), dD = bt(13), dL = bt(14), dR = bt(15);
    if (mode === 'classic' && pad.axes.length >= 4) {
      const l = -ax(1), r = -ax(3);
      if (l || r) { c.L = clamp(l, -1, 1); c.R = clamp(r, -1, 1); }
    } else {
      const fwd = clamp(-ax(1) + (dU ? 1 : 0) - (dD ? 1 : 0), -1, 1);
      const turn = clamp(ax(0) + (dR ? 1 : 0) - (dL ? 1 : 0), -1, 1);
      if (fwd || turn) { c.L = clamp(fwd + turn, -1, 1); c.R = clamp(fwd - turn, -1, 1); }
    }
    c.up = c.up || dU || ax(1) < -0.5; c.down = c.down || dD || ax(1) > 0.5;
    c.left = c.left || dL || ax(0) < -0.5; c.right = c.right || dR || ax(0) > 0.5;
    c.fire = c.fire || bt(0) || bt(7) || bt(5);
    c.shield = c.shield || bt(1) || bt(6) || bt(4);
    c.start = c.start || bt(9);
  },
};
