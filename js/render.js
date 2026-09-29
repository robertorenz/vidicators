'use strict';
// ---------------------------------------------------------------------------
// Rendering: pre-rendered floor + raised wall layers (the arcade's oblique
// 3/4 view), tank/enemy sprites, particles, HUD and full-screen pages.
// ---------------------------------------------------------------------------
const PALETTES = [
  { floor: ['#4a4f58', '#434852'], seam: '#262a31', hi: '#5f6570', detail: '#383d45', wallTop: ['#a3acb9', '#7c8594'], wallEdge: '#dfe5ec', wallFront: ['#4d5460', '#262b33'], trim: '#e6a93a', deep: '#5b6270' },
  { floor: ['#2e4a66', '#29435d'], seam: '#182a3b', hi: '#416587', detail: '#223a52', wallTop: ['#94b8d6', '#6a8fae'], wallEdge: '#d6ebfa', wallFront: ['#34506a', '#1a2c3e'], trim: '#f0c040', deep: '#4a6a88' },
  { floor: ['#5c4434', '#543e2f'], seam: '#30231a', hi: '#765a46', detail: '#46342a', wallTop: ['#c69a6c', '#9c7350'], wallEdge: '#f0d4b0', wallFront: ['#5e4331', '#34261b'], trim: '#6fc0e0', deep: '#7a5a40' },
  { floor: ['#3c4f3a', '#364833'], seam: '#1f2a1e', hi: '#51684e', detail: '#2e3d2c', wallTop: ['#a8b88e', '#7f9168'], wallEdge: '#e0ecd0', wallFront: ['#4a5a3c', '#283220'], trim: '#f08a30', deep: '#5c6e4a' },
  { floor: ['#6b6248', '#635a41'], seam: '#3c3625', hi: '#827858', detail: '#524b36', wallTop: ['#d8ca9c', '#b1a274'], wallEdge: '#f6eed6', wallFront: ['#6e6444', '#433d27'], trim: '#e04a3a', deep: '#8a7e58' },
  { floor: ['#2f5552', '#2a4d4a'], seam: '#18302e', hi: '#41706c', detail: '#234240', wallTop: ['#8ecac2', '#64a199'], wallEdge: '#d6f4f0', wallFront: ['#2f5e58', '#193733'], trim: '#f2d24a', deep: '#437c75' },
  { floor: ['#55363a', '#4d3034'], seam: '#2e1b1e', hi: '#6e464b', detail: '#40282c', wallTop: ['#cc9c96', '#a4746e'], wallEdge: '#f4d8d4', wallFront: ['#5e3538', '#381e21'], trim: '#9ad0ff', deep: '#7a4e4c' },
];

const PCOL = [
  { main: '#d8452c', light: '#ff9a6a', dark: '#6e1c10', tread: '#2a1a16', ui: '#ff6a4a', shot: '#fff2a0' },
  { main: '#2f86e8', light: '#8fd0ff', dark: '#103a72', tread: '#141d2a', ui: '#5ab4ff', shot: '#c8f0ff' },
];
const ECOL = {
  std: { main: '#6f9a2e', light: '#bfe070', dark: '#2f4814', tread: '#1d2412' },
  heavy: { main: '#c9a227', light: '#ffe488', dark: '#5c4608', tread: '#2a220c' },
  fast: { main: '#d0d6de', light: '#ffffff', dark: '#58606c', tread: '#22262c' },
};

function font(c, size) { c.font = size + 'px "Press Start 2P", monospace'; }
function txt(c, s, x, y, color = '#fff', size = 8, align = 'left', shadow = true) {
  font(c, size);
  c.textAlign = align; c.textBaseline = 'top';
  if (shadow) { c.fillStyle = 'rgba(0,0,0,0.85)'; c.fillText(s, x + 1, y + 1); }
  c.fillStyle = color; c.fillText(s, x, y);
}
function blink(rate = 2) { return Math.floor(performance.now() / 1000 * rate) % 2 === 0; }

function starPath(c, x, y, r, rot = 0) {
  c.beginPath();
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 ? r * 0.45 : r, a = rot - Math.PI / 2 + i * Math.PI / 5;
    c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  c.closePath();
}
function drawStarIcon(c, x, y, r, rot = 0) {
  starPath(c, x, y, r, rot);
  c.fillStyle = '#ffd23a'; c.fill();
  c.strokeStyle = '#8a5a00'; c.lineWidth = 1; c.stroke();
}

// ---------------------------------------------------------------------------
// Map layers
// ---------------------------------------------------------------------------
function buildMapCanvases(L) {
  const P = PALETTES[(L.station - 1 + L.loop * 3) % PALETTES.length];
  const { W, H, grid } = L;
  const T = TILE;
  const rng = mulberry32(L.seed ^ 0x5bd1e995);
  const solid = (x, y) => x < 0 || y < 0 || x >= W || y >= H || grid[y * W + x] === 1;

  const floor = document.createElement('canvas');
  floor.width = W * T; floor.height = H * T;
  const f = floor.getContext('2d');
  f.fillStyle = '#040507'; f.fillRect(0, 0, floor.width, floor.height);

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (solid(x, y)) continue;
      const X = x * T, Y = y * T;
      f.fillStyle = P.floor[((x >> 1) + (y >> 1)) & 1];
      f.fillRect(X, Y, T, T);
      // deck plate bevels
      f.fillStyle = P.hi; f.fillRect(X, Y, T, 1); f.fillRect(X, Y, 1, T);
      f.fillStyle = P.seam; f.fillRect(X, Y + T - 1, T, 1); f.fillRect(X + T - 1, Y, 1, T);
      const r = rng();
      if (r < 0.1) { // vent grate
        f.fillStyle = P.seam; f.fillRect(X + 7, Y + 7, 18, 18);
        f.fillStyle = P.detail; for (let i = 0; i < 4; i++) f.fillRect(X + 9, Y + 9 + i * 4, 14, 2);
      } else if (r < 0.2) { // rivets
        f.fillStyle = P.hi;
        for (const [a, b] of [[4, 4], [T - 6, 4], [4, T - 6], [T - 6, T - 6]]) f.fillRect(X + a, Y + b, 2, 2);
        f.fillStyle = P.seam;
        for (const [a, b] of [[5, 5], [T - 5, 5], [5, T - 5], [T - 5, T - 5]]) f.fillRect(X + a, Y + b, 1, 1);
      } else if (r < 0.25) { // floor light
        f.fillStyle = P.seam; f.fillRect(X + 10, Y + 13, 12, 6);
        f.fillStyle = P.trim; f.globalAlpha = 0.55; f.fillRect(X + 11, Y + 14, 10, 4); f.globalAlpha = 1;
      } else if (r < 0.3) { // panel seam
        f.fillStyle = P.seam; f.fillRect(X + 15, Y + 2, 1, T - 4);
      }
      // wall shadows (light falls from the upper left)
      if (solid(x, y - 1)) for (let i = 0; i < 10; i++) { f.fillStyle = `rgba(0,0,0,${0.5 * (1 - i / 10)})`; f.fillRect(X, Y + i, T, 1); }
      if (solid(x - 1, y)) for (let i = 0; i < 8; i++) { f.fillStyle = `rgba(0,0,0,${0.42 * (1 - i / 8)})`; f.fillRect(X + i, Y, 1, T); }
      if (solid(x - 1, y - 1) && !solid(x - 1, y) && !solid(x, y - 1)) { f.fillStyle = 'rgba(0,0,0,0.3)'; f.fillRect(X, Y, 6, 8); }
    }
  }

  // Raised wall layer, drawn over the actors so walls occlude what is behind them.
  const walls = document.createElement('canvas');
  walls.width = W * T; walls.height = H * T + WALL_H;
  const w = walls.getContext('2d');
  const openNear = (x, y) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (!solid(x + dx, y + dy)) return true; return false; };
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!solid(x, y)) continue;
      const X = x * T, Y = y * T;              // canvas-space top face (world y - WALL_H)
      const edge = openNear(x, y);
      if (edge) {
        const g = w.createLinearGradient(0, Y, 0, Y + T);
        g.addColorStop(0, P.wallTop[0]); g.addColorStop(1, P.wallTop[1]);
        w.fillStyle = g; w.fillRect(X, Y, T, T);
        w.strokeStyle = 'rgba(0,0,0,0.25)'; w.lineWidth = 1; w.strokeRect(X + 3.5, Y + 3.5, T - 7, T - 7);
        w.fillStyle = 'rgba(255,255,255,0.18)'; w.fillRect(X + 4, Y + 4, T - 8, 1);
        w.fillStyle = 'rgba(0,0,0,0.3)';
        for (const [a, b] of [[6, 6], [T - 8, 6], [6, T - 8], [T - 8, T - 8]]) w.fillRect(X + a, Y + b, 2, 2);
      } else {
        // deep hull interior: darker machinery plating
        w.fillStyle = P.wallTop[1]; w.fillRect(X, Y, T, T);
        w.fillStyle = 'rgba(0,0,0,0.12)'; w.fillRect(X, Y + T - 1, T, 1); w.fillRect(X + T - 1, Y, 1, T);
        if (((x * 7 + y * 13) % 5) === 0) { // roof vents
          w.fillStyle = 'rgba(0,0,0,0.22)'; w.fillRect(X + 9, Y + 9, 14, 14);
          w.fillStyle = 'rgba(255,255,255,0.12)'; for (let i = 0; i < 3; i++) w.fillRect(X + 10, Y + 11 + i * 4, 12, 1);
        }
      }
      if (!solid(x, y - 1)) { w.fillStyle = P.wallEdge; w.fillRect(X, Y, T, 2); }
      if (!solid(x - 1, y)) { w.fillStyle = 'rgba(255,255,255,0.35)'; w.fillRect(X, Y, 1, T); }
      if (!solid(x + 1, y)) { w.fillStyle = 'rgba(0,0,0,0.45)'; w.fillRect(X + T - 1, Y, 1, T); }
      if (!solid(x, y + 1) && y + 1 < H) {
        const FY = Y + T;
        const g = w.createLinearGradient(0, FY, 0, FY + WALL_H);
        g.addColorStop(0, P.wallFront[0]); g.addColorStop(1, P.wallFront[1]);
        w.fillStyle = g; w.fillRect(X, FY, T, WALL_H);
        w.fillStyle = 'rgba(0,0,0,0.35)';
        for (let i = 4; i < T; i += 8) w.fillRect(X + i, FY + 2, 2, WALL_H - 3);
        w.fillStyle = 'rgba(255,255,255,0.25)'; w.fillRect(X, FY, T, 1);
        if (((x + y * 3) % 7) === 0) { // hazard trim
          for (let i = 0; i < T; i += 6) { w.fillStyle = (i / 6) % 2 ? '#111' : P.trim; w.fillRect(X + i, FY + WALL_H - 4, 6, 3); }
        }
        w.fillStyle = 'rgba(0,0,0,0.7)'; w.fillRect(X, FY + WALL_H - 1, T, 1);
      }
    }
  }
  return { floor, walls, fctx: f, palette: P };
}

// ---------------------------------------------------------------------------
// Sprites
// ---------------------------------------------------------------------------
function drawShadow(c, x, y, rx, ry) {
  c.fillStyle = 'rgba(0,0,0,0.38)';
  c.beginPath(); c.ellipse(x + 3, y + 4, rx, ry, 0, 0, TAU); c.fill();
}

function drawTank(c, x, y, a, col, tl, tr, scale = 1, flash = false) {
  drawShadow(c, x, y, 13 * scale, 11 * scale);
  c.save();
  c.translate(x, y); c.rotate(a); c.scale(scale, scale);
  for (const side of [-1, 1]) {
    const ty = side < 0 ? -11 : 5;
    c.fillStyle = col.tread; c.fillRect(-13, ty, 26, 6);
    const ph = (((side < 0 ? tl : tr) % 4) + 4) % 4;
    c.fillStyle = 'rgba(255,255,255,0.22)';
    for (let i = -13 + ph; i < 13; i += 4) c.fillRect(i, ty, 1.5, 6);
    c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillRect(-13, ty + (side < 0 ? 5 : 0), 26, 1);
  }
  c.fillStyle = flash ? '#fff' : col.dark; c.fillRect(-11, -6, 22, 12);
  c.fillStyle = flash ? '#fff' : col.main; c.fillRect(-10, -6, 19, 10);
  c.fillStyle = flash ? '#fff' : col.light; c.fillRect(-10, -6, 19, 2);
  c.fillStyle = col.dark; c.fillRect(8, -5, 3, 10); c.fillRect(-11, -4, 2, 8);
  c.fillStyle = col.dark; c.beginPath(); c.arc(-1, 0, 6.5, 0, TAU); c.fill();
  c.fillStyle = flash ? '#fff' : col.main; c.beginPath(); c.arc(-1.5, -0.5, 5.2, 0, TAU); c.fill();
  c.fillStyle = col.light; c.beginPath(); c.arc(-3, -2, 1.8, 0, TAU); c.fill();
  c.fillStyle = '#16181c'; c.fillRect(2, -2, 14, 4);
  c.fillStyle = '#9aa1ab'; c.fillRect(2, -2, 14, 1.5);
  c.fillStyle = '#1e2126'; c.fillRect(14, -2.8, 3, 5.6);
  c.restore();
}

function drawTurret(c, e) {
  drawShadow(c, e.x, e.y, 13, 11);
  c.save(); c.translate(e.x, e.y);
  c.fillStyle = '#23272e';
  c.beginPath();
  for (let i = 0; i < 8; i++) { const a = i * TAU / 8 + Math.PI / 8; c.lineTo(Math.cos(a) * 14, Math.sin(a) * 14); }
  c.closePath(); c.fill();
  c.fillStyle = '#5a616c';
  c.beginPath();
  for (let i = 0; i < 8; i++) { const a = i * TAU / 8 + Math.PI / 8; c.lineTo(Math.cos(a) * 12, Math.sin(a) * 12); }
  c.closePath(); c.fill();
  c.fillStyle = '#80878f'; c.fillRect(-9, -9, 18, 2);
  c.rotate(e.a);
  c.fillStyle = '#16181c'; c.fillRect(2, -5, 16, 3); c.fillRect(2, 2, 16, 3);
  c.fillStyle = '#9aa1ab'; c.fillRect(2, -5, 16, 1); c.fillRect(2, 2, 16, 1);
  c.fillStyle = e.flash > 0 ? '#fff' : '#d9772a';
  c.beginPath(); c.arc(0, 0, 7.5, 0, TAU); c.fill();
  c.fillStyle = e.flash > 0 ? '#fff' : '#ffb35c'; c.beginPath(); c.arc(-2, -2, 3, 0, TAU); c.fill();
  c.fillStyle = '#5a2a08'; c.fillRect(4, -1, 4, 2);
  c.restore();
}

function drawGenerator(c, e, t, trim) {
  c.save(); c.translate(e.x, e.y);
  c.fillStyle = 'rgba(0,0,0,0.4)'; c.fillRect(-12, -10, 28, 28);
  for (let i = 0; i < 4; i++) {
    c.save(); c.rotate(i * Math.PI / 2);
    for (let k = -14; k < 14; k += 6) { c.fillStyle = ((k + 14) / 6) % 2 ? '#111' : trim; c.fillRect(k, -14, 6, 3); }
    c.restore();
  }
  c.fillStyle = '#0a0c10'; c.fillRect(-11, -11, 22, 22);
  const pulse = 0.5 + 0.5 * Math.sin(t * 6 + e.x);
  const g = c.createRadialGradient(0, 0, 1, 0, 0, 11);
  g.addColorStop(0, e.flash > 0 ? '#fff' : `rgba(180,255,120,${0.6 + 0.4 * pulse})`);
  g.addColorStop(0.5, `rgba(60,200,60,${0.4 + 0.3 * pulse})`);
  g.addColorStop(1, 'rgba(0,40,0,0)');
  c.fillStyle = g; c.fillRect(-11, -11, 22, 22);
  c.rotate(t * 1.5);
  c.fillStyle = '#39404a';
  for (let i = 0; i < 4; i++) { c.rotate(Math.PI / 2); c.beginPath(); c.moveTo(0, 0); c.lineTo(11, -4); c.lineTo(11, 4 - 8 * e.open); c.closePath(); c.fill(); }
  c.restore();
}

function drawMine(c, e, t) {
  c.save(); c.translate(e.x, e.y);
  c.fillStyle = 'rgba(0,0,0,0.35)'; c.beginPath(); c.arc(2, 2, 7, 0, TAU); c.fill();
  c.fillStyle = '#2c3038'; c.beginPath(); c.arc(0, 0, 7, 0, TAU); c.fill();
  c.fillStyle = '#4e5560';
  for (let i = 0; i < 6; i++) { const a = i * TAU / 6; c.fillRect(Math.cos(a) * 6 - 1, Math.sin(a) * 6 - 1, 2, 2); }
  c.fillStyle = (Math.floor(t * 3 + e.x) % 2) ? '#ff3a2a' : '#5a1008';
  c.beginPath(); c.arc(0, 0, 2.5, 0, TAU); c.fill();
  c.restore();
}

function drawControlCenter(c, e, t) {
  c.save(); c.translate(e.x, e.y);
  c.fillStyle = 'rgba(0,0,0,0.45)'; c.fillRect(-28, -26, 62, 62);
  c.fillStyle = '#1b1f26'; c.fillRect(-32, -32, 64, 64);
  c.fillStyle = '#3c434e'; c.fillRect(-30, -30, 60, 60);
  c.fillStyle = '#59616d'; c.fillRect(-30, -30, 60, 3);
  // corner pylons
  for (const [x, y] of [[-24, -24], [24, -24], [-24, 24], [24, 24]]) {
    c.fillStyle = '#262a31'; c.beginPath(); c.arc(x, y, 6, 0, TAU); c.fill();
    const on = Math.floor(t * 4 + x + y) % 2;
    c.fillStyle = on ? '#ff4630' : '#5a140c'; c.beginPath(); c.arc(x, y, 3, 0, TAU); c.fill();
  }
  // octagonal core
  c.fillStyle = e.flash > 0 ? '#fff' : '#8a939f';
  c.beginPath();
  for (let i = 0; i < 8; i++) { const a = i * TAU / 8 + Math.PI / 8; c.lineTo(Math.cos(a) * 20, Math.sin(a) * 20); }
  c.closePath(); c.fill();
  c.fillStyle = '#2a2f37'; c.beginPath(); c.arc(0, 0, 14, 0, TAU); c.fill();
  const hp = e.hp / e.maxHp;
  const g = c.createRadialGradient(0, 0, 2, 0, 0, 14);
  g.addColorStop(0, '#fff6c0'); g.addColorStop(0.4, hp > 0.3 ? '#ffb020' : '#ff4020'); g.addColorStop(1, 'rgba(120,20,0,0.2)');
  c.fillStyle = g; c.globalAlpha = 0.6 + 0.4 * Math.sin(t * 8); c.beginPath(); c.arc(0, 0, 12, 0, TAU); c.fill(); c.globalAlpha = 1;
  // rotating radar arm
  c.rotate(e.spin);
  c.fillStyle = '#c9d0da'; c.fillRect(-2, -2, 20, 4);
  c.fillStyle = '#e8edf2'; c.beginPath(); c.ellipse(18, 0, 4, 9, 0, 0, TAU); c.fill();
  c.fillStyle = '#6c7480'; c.beginPath(); c.ellipse(17, 0, 2, 7, 0, 0, TAU); c.fill();
  c.restore();
  // health bar
  if (e.hp < e.maxHp) {
    c.fillStyle = '#000'; c.fillRect(e.x - 26, e.y - 44, 52, 5);
    c.fillStyle = hp > 0.5 ? '#6adf4a' : hp > 0.25 ? '#ffc930' : '#ff4a30';
    c.fillRect(e.x - 25, e.y - 43, 50 * hp, 3);
  }
}

function drawExit(c, ex, t) {
  c.save(); c.translate(ex.x, ex.y);
  const col = ex.locked ? '#ff4a30' : '#46f08a';
  c.fillStyle = '#07090c'; c.fillRect(-15, -15, 30, 30);
  c.strokeStyle = col; c.lineWidth = 2;
  c.globalAlpha = 0.55 + 0.45 * Math.sin(t * 6); c.strokeRect(-14, -14, 28, 28); c.globalAlpha = 1;
  if (ex.locked) {
    c.strokeStyle = '#ff4a30'; c.lineWidth = 3;
    c.beginPath(); c.moveTo(-7, -7); c.lineTo(7, 7); c.moveTo(7, -7); c.lineTo(-7, 7); c.stroke();
  } else {
    const g = c.createRadialGradient(0, 0, 1, 0, 0, 14);
    g.addColorStop(0, 'rgba(160,255,200,0.9)'); g.addColorStop(1, 'rgba(0,120,60,0)');
    c.fillStyle = g; c.fillRect(-13, -13, 26, 26);
    c.strokeStyle = '#d8ffe6'; c.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const o = ((t * 14 + i * 8) % 24) - 12;
      c.globalAlpha = 1 - Math.abs(o) / 12;
      c.beginPath(); c.moveTo(-6, o + 3); c.lineTo(0, o - 3); c.lineTo(6, o + 3); c.stroke();
    }
    c.globalAlpha = 1;
  }
  c.restore();
}

function drawPickup(c, p, t) {
  const bob = Math.sin(t * 4 + p.ph) * 2;
  c.fillStyle = 'rgba(0,0,0,0.35)'; c.beginPath(); c.ellipse(p.x + 2, p.y + 7, 7, 3, 0, 0, TAU); c.fill();
  const y = p.y + bob - 2;
  if (p.type === 'fuel') {
    c.fillStyle = '#7a1208'; c.fillRect(p.x - 6, y - 8, 12, 16);
    c.fillStyle = '#e8321e'; c.fillRect(p.x - 5, y - 8, 9, 16);
    c.fillStyle = '#ff8a6a'; c.fillRect(p.x - 4, y - 7, 2, 14);
    c.fillStyle = '#f2f2f2'; c.fillRect(p.x - 6, y - 3, 12, 6);
    c.fillStyle = '#c8c8c8'; c.fillRect(p.x - 3, y - 11, 6, 3);
    txt(c, 'F', p.x - 3, y - 3, '#b01808', 8, 'left', false);
  } else if (p.type === 'star') {
    const g = c.createRadialGradient(p.x, y, 1, p.x, y, 12);
    g.addColorStop(0, 'rgba(255,230,120,0.6)'); g.addColorStop(1, 'rgba(255,200,0,0)');
    c.fillStyle = g; c.fillRect(p.x - 12, y - 12, 24, 24);
    drawStarIcon(c, p.x, y, 8, Math.sin(t * 2 + p.ph) * 0.4);
  } else if (p.type === 'shield') {
    c.fillStyle = '#0a3a52';
    c.beginPath();
    for (let i = 0; i < 6; i++) { const a = i * TAU / 6; c.lineTo(p.x + Math.cos(a) * 8, y + Math.sin(a) * 8); }
    c.closePath(); c.fill();
    c.strokeStyle = '#5ae0ff'; c.lineWidth = 1.5; c.stroke();
    txt(c, 'S', p.x - 3, y - 4, '#aef4ff', 8, 'left', false);
  }
}

function drawShield(c, p, t) {
  c.save();
  c.globalAlpha = 0.35 + 0.25 * Math.sin(t * 30);
  c.fillStyle = '#5ae0ff'; c.beginPath(); c.arc(p.x, p.y, 18, 0, TAU); c.fill();
  c.globalAlpha = 0.9; c.strokeStyle = '#d8faff'; c.lineWidth = 1.5;
  c.beginPath(); c.arc(p.x, p.y, 18, t * 8, t * 8 + 4); c.stroke();
  c.restore();
}

function drawBullet(c, b) {
  if (b.owner >= 0) {
    const col = PCOL[b.owner];
    c.save(); c.translate(b.x, b.y); c.rotate(b.a);
    c.fillStyle = col.main; c.globalAlpha = 0.5; c.fillRect(-7, -2.5, 12, 5); c.globalAlpha = 1;
    c.fillStyle = col.shot; c.fillRect(-5, -1.5, 9, 3);
    c.fillStyle = '#fff'; c.fillRect(0, -1, 4, 2);
    c.restore();
  } else {
    c.fillStyle = 'rgba(255,90,20,0.45)'; c.beginPath(); c.arc(b.x, b.y, 5, 0, TAU); c.fill();
    c.fillStyle = '#ffd08a'; c.beginPath(); c.arc(b.x, b.y, 2.5, 0, TAU); c.fill();
  }
}

// ---------------------------------------------------------------------------
// World view
// ---------------------------------------------------------------------------
function renderWorld(c) {
  const L = G.level, M = G.map;
  if (!L || !M) return;
  const t = G.t;
  let camX = G.cam.x, camY = G.cam.y;
  if (G.shake > 0.3) { camX += (Math.random() - 0.5) * G.shake; camY += (Math.random() - 0.5) * G.shake; }
  camX = Math.round(clamp(camX, 0, L.W * TILE - VIEW_W));
  camY = Math.round(clamp(camY, 0, L.H * TILE - VIEW_GH));

  c.save();
  c.beginPath(); c.rect(0, HUD_H, VIEW_W, VIEW_GH); c.clip();
  c.fillStyle = '#000'; c.fillRect(0, HUD_H, VIEW_W, VIEW_GH);
  c.drawImage(M.floor, camX, camY, VIEW_W, VIEW_GH, 0, HUD_H, VIEW_W, VIEW_GH);
  c.translate(-camX, -camY + HUD_H);

  if (G.exit) drawExit(c, G.exit, t);
  for (const p of G.pickups) drawPickup(c, p, t);
  for (const e of G.enemies) {
    if (e.type === 'mine') drawMine(c, e, t);
    else if (e.type === 'gen') drawGenerator(c, e, t, M.palette.trim);
  }
  for (const e of G.enemies) {
    if (e.type === 'turret') drawTurret(c, e);
    else if (e.type === 'cc') drawControlCenter(c, e, t);
    else if (e.type === 'tank') drawTank(c, e.x, e.y, e.a, ECOL[e.kind], e.tread, e.tread, e.kind === 'heavy' ? 1.12 : 1, e.flash > 0);
  }
  for (const p of G.players) {
    if (!p.active || !p.alive) continue;
    if (p.inv > 0 && !p.warp && Math.floor(t * 20) % 2) continue;
    const sc = p.warp ? Math.max(0, 1 - p.warp) : 1;
    drawTank(c, p.x, p.y, p.a + (p.warp || 0) * 14, PCOL[p.id], p.treadL, p.treadR, sc, p.flash > 0);
  }
  for (const b of G.bullets) drawBullet(c, b);
  for (const q of G.particles) {
    c.globalAlpha = clamp(q.life / q.max, 0, 1);
    c.fillStyle = q.color;
    c.fillRect(q.x - q.size / 2, q.y - q.size / 2, q.size, q.size);
  }
  c.globalAlpha = 1;
  c.restore();

  // raised walls
  c.save();
  c.beginPath(); c.rect(0, HUD_H, VIEW_W, VIEW_GH); c.clip();
  c.drawImage(M.walls, camX, camY + WALL_H, VIEW_W, VIEW_GH, 0, HUD_H, VIEW_W, VIEW_GH);
  c.translate(-camX, -camY + HUD_H);
  for (const p of G.players) if (p.active && p.alive && p.shieldOn) drawShield(c, p, t);
  for (const r of G.rings) {
    const k = r.t / r.max;
    c.globalAlpha = 1 - k;
    c.strokeStyle = r.color; c.lineWidth = 3 * (1 - k) + 1;
    c.beginPath(); c.arc(r.x, r.y, r.size * (0.2 + k), 0, TAU); c.stroke();
    if (k < 0.25) { c.fillStyle = '#fff6d0'; c.beginPath(); c.arc(r.x, r.y, r.size * 0.5 * (1 - k * 4), 0, TAU); c.fill(); }
  }
  c.globalAlpha = 1;
  for (const f of G.texts) {
    c.globalAlpha = clamp(f.t, 0, 1);
    txt(c, f.s, f.x, f.y, f.color, 8, 'center');
  }
  c.globalAlpha = 1;
  c.restore();

  if (G.escaping) { // red alert strobe
    c.fillStyle = `rgba(255,30,10,${0.08 + 0.08 * Math.sin(t * 10)})`;
    c.fillRect(0, HUD_H, VIEW_W, VIEW_GH);
  }
  drawRadar(c, camX, camY);
}

function drawRadar(c, camX, camY) {
  if (!Settings.radar || !G.exit || G.state !== 'play' || (G.levelTime < 40 && !G.escaping)) return;
  const ex = G.exit.x - camX, ey = G.exit.y - camY + HUD_H;
  if (ex > 8 && ex < VIEW_W - 8 && ey > HUD_H + 8 && ey < VIEW_H - 8) return;
  const cx = VIEW_W / 2, cy = HUD_H + VIEW_GH / 2;
  const a = Math.atan2(ey - cy, ex - cx);
  const k = Math.min((VIEW_W / 2 - 14) / Math.abs(Math.cos(a) || 1e-6), (VIEW_GH / 2 - 14) / Math.abs(Math.sin(a) || 1e-6));
  const x = cx + Math.cos(a) * k, y = cy + Math.sin(a) * k;
  c.save(); c.translate(x, y); c.rotate(a);
  c.globalAlpha = 0.5 + 0.5 * Math.sin(G.t * 6);
  c.fillStyle = G.exit.locked ? '#ff4a30' : '#46f08a';
  c.beginPath(); c.moveTo(9, 0); c.lineTo(-6, -7); c.lineTo(-3, 0); c.lineTo(-6, 7); c.closePath(); c.fill();
  c.restore();
}

// ---------------------------------------------------------------------------
// HUD
// ---------------------------------------------------------------------------
function renderHUD(c) {
  const g = c.createLinearGradient(0, 0, 0, HUD_H);
  g.addColorStop(0, '#1d232d'); g.addColorStop(1, '#090c11');
  c.fillStyle = g; c.fillRect(0, 0, VIEW_W, HUD_H);
  c.fillStyle = '#4a5566'; c.fillRect(0, HUD_H - 1, VIEW_W, 1);
  hudPanel(c, G.players[0], 4, 190);
  hudPanel(c, G.players[1], VIEW_W - 194, 190);
  const mid = VIEW_W / 2;
  if (G.escaping) {
    txt(c, 'ESCAPE', mid, 4, blink(4) ? '#ff4a30' : '#ffd0c0', 8, 'center');
    txt(c, String(Math.ceil(G.escapeT)).padStart(2, '0'), mid, 15, '#ffffff', 8, 'center');
  } else {
    txt(c, 'STATION ' + G.station, mid, 4, '#e6c15a', 8, 'center');
    txt(c, 'LEVEL ' + G.levelNum, mid, 15, '#9aa6b6', 8, 'center');
  }
}

function hudPanel(c, p, x, w) {
  const col = PCOL[p.id];
  if (!p.active) {
    if (blink(1.5)) {
      txt(c, 'PRESS ' + (p.id + 1), x + w / 2, 4, col.ui, 8, 'center');
      txt(c, 'TO JOIN', x + w / 2, 15, '#8894a4', 8, 'center');
    }
    return;
  }
  txt(c, (p.id + 1) + 'UP', x, 3, col.ui);
  txt(c, String(p.score), x + w, 3, '#ffffff', 8, 'right');
  if (!p.alive) {
    if (blink(2)) txt(c, 'PRESS ' + (p.id + 1) + ' CONTINUE', x, 15, '#ffd23a');
    return;
  }
  const st = pStats(p);
  txt(c, 'F', x, 13, '#c8d0dc');
  const bw = 112, fr = clamp(p.fuel / st.maxFuel, 0, 1);
  c.fillStyle = '#000'; c.fillRect(x + 10, 13, bw + 2, 7);
  const fc = fr > 0.5 ? '#4ade6a' : fr > 0.25 ? '#ffc930' : (blink(4) ? '#ff4a30' : '#801a10');
  c.fillStyle = fc; c.fillRect(x + 11, 14, bw * fr, 5);
  c.fillStyle = 'rgba(255,255,255,0.35)'; c.fillRect(x + 11, 14, bw * fr, 1);
  c.fillStyle = 'rgba(0,0,0,0.5)'; for (let i = 1; i < 8; i++) c.fillRect(x + 11 + i * bw / 8, 14, 1, 5);
  const sr = clamp(p.shieldE / st.shieldMax, 0, 1);
  c.fillStyle = '#000'; c.fillRect(x + 10, 21, bw + 2, 4);
  c.fillStyle = p.shieldOn ? '#d8faff' : '#38b8e0'; c.fillRect(x + 11, 22, bw * sr, 2);
  drawStarIcon(c, x + 135, 19, 6);
  txt(c, String(p.stars), x + 144, 15, '#ffd23a');
}

// ---------------------------------------------------------------------------
// Full-screen pages
// ---------------------------------------------------------------------------
function drawLogo(c, x, y, size) {
  font(c, size);
  c.textAlign = 'center'; c.textBaseline = 'middle';
  const s = 'VINDICATORS';
  for (let i = 6; i > 0; i--) { c.fillStyle = i > 3 ? '#2a0804' : '#8a2008'; c.fillText(s, x + i * 0.5, y + i); }
  const g = c.createLinearGradient(0, y - size / 2, 0, y + size / 2);
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.42, '#b9c5d5'); g.addColorStop(0.5, '#3e4858');
  g.addColorStop(0.72, '#9aa9bc'); g.addColorStop(1, '#eef3f8');
  c.fillStyle = g; c.fillText(s, x, y);
  c.lineWidth = 1; c.strokeStyle = '#ff8a3a'; c.strokeText(s, x, y);
  // specular sweep
  const sx = ((G.t * 120) % 700) - 100;
  c.save(); c.beginPath(); c.rect(sx, y - size, 24, size * 2); c.clip();
  c.fillStyle = 'rgba(255,255,255,0.55)'; c.fillText(s, x, y);
  c.restore();
}

function renderBackdrop(c) {
  const D = G.demo;
  if (D) {
    const L = D.level;
    const mw = L.W * TILE - VIEW_W, mh = L.H * TILE - VIEW_H;
    const cx = Math.round(mw * (0.5 + 0.45 * Math.sin(G.t * 0.05)));
    const cy = Math.round(mh * (0.5 + 0.45 * Math.sin(G.t * 0.037 + 1)));
    c.drawImage(D.map.floor, cx, cy, VIEW_W, VIEW_H, 0, 0, VIEW_W, VIEW_H);
    c.drawImage(D.map.walls, cx, cy + WALL_H, VIEW_W, VIEW_H, 0, 0, VIEW_W, VIEW_H);
  }
  c.fillStyle = 'rgba(4,6,10,0.72)'; c.fillRect(0, 0, VIEW_W, VIEW_H);
}

function renderTitle(c) {
  renderBackdrop(c);
  const page = Math.floor(G.stateT / 8) % 3;
  if (page === 0) {
    drawLogo(c, VIEW_W / 2, 96, 32);
    txt(c, 'THE TANGENT EMPIRE HAS BUILT', VIEW_W / 2, 150, '#c8d0dc', 8, 'center');
    txt(c, '14 BATTLE STATIONS', VIEW_W / 2, 164, '#c8d0dc', 8, 'center');
    txt(c, 'YOUR SR-88 TANKS MUST DESTROY THEM', VIEW_W / 2, 178, '#c8d0dc', 8, 'center');
    drawTank(c, 200, 230, -Math.PI / 2 + Math.sin(G.t) * 0.3, PCOL[0], G.t * 20, G.t * 20, 1.6);
    drawTank(c, 312, 230, -Math.PI / 2 - Math.sin(G.t) * 0.3, PCOL[1], G.t * 20, G.t * 20, 1.6);
    if (blink(2)) txt(c, 'PRESS 1 OR 2 TO START', VIEW_W / 2, 284, '#ffd23a', 8, 'center');
    txt(c, 'FREE PLAY', VIEW_W / 2, 310, '#8894a4', 8, 'center');
  } else if (page === 1) {
    drawLogo(c, VIEW_W / 2, 44, 16);
    txt(c, 'HIGH SCORES', VIEW_W / 2, 72, '#ffd23a', 8, 'center');
    G.hiscores.slice(0, 10).forEach((h, i) => {
      const y = 96 + i * 20, col = i === 0 ? '#ff9a6a' : i < 3 ? '#e6c15a' : '#c8d0dc';
      txt(c, String(i + 1).padStart(2, ' ') + '.', 120, y, col);
      txt(c, h.name, 160, y, col);
      txt(c, String(h.score).padStart(7, ' '), 220, y, col);
      txt(c, 'ST ' + String(h.station).padStart(2, ' '), 330, y, '#8894a4');
    });
    if (blink(2)) txt(c, 'PRESS 1 OR 2 TO START', VIEW_W / 2, 320, '#ffd23a', 8, 'center');
  } else {
    drawLogo(c, VIEW_W / 2, 44, 16);
    txt(c, 'HOW TO PLAY', VIEW_W / 2, 72, '#ffd23a', 8, 'center');
    const rows = [
      ['fuel', 'FUEL - YOUR TANK\'S LIFE. GRAB IT!'],
      ['star', 'BATTLE STARS - BUY EQUIPMENT'],
      ['shield', 'SHIELD RECHARGE'],
      ['exit', 'EXIT - UP TO THE NEXT LEVEL'],
      ['cc', 'CONTROL CENTER - DESTROY IT'],
    ];
    rows.forEach(([k, s], i) => {
      const y = 104 + i * 36;
      if (k === 'exit') drawExit(c, { x: 116, y, locked: false }, G.t);
      else if (k === 'cc') { c.save(); c.translate(116, y); c.scale(0.45, 0.45); drawControlCenter(c, { x: 0, y: 0, hp: 1, maxHp: 1, spin: G.t, flash: 0 }, G.t); c.restore(); }
      else drawPickup(c, { type: k, x: 116, y, ph: i }, G.t);
      txt(c, s, 146, y - 4, '#c8d0dc');
    });
    txt(c, 'ENEMY FIRE DRAINS YOUR FUEL', VIEW_W / 2, 290, '#ff9a6a', 8, 'center');
    if (blink(2)) txt(c, 'PRESS 1 OR 2 TO START', VIEW_W / 2, 320, '#ffd23a', 8, 'center');
  }
  txt(c, 'ARCADE TRIBUTE', VIEW_W / 2, 364, '#566274', 8, 'center');
}

function renderBanner(c, title, sub, color = '#ffd23a') {
  c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillRect(0, 150, VIEW_W, sub ? 64 : 44);
  c.fillStyle = color; c.fillRect(0, 150, VIEW_W, 2); c.fillRect(0, (sub ? 212 : 192), VIEW_W, 2);
  txt(c, title, VIEW_W / 2, 164, color, 16, 'center');
  if (sub) txt(c, sub, VIEW_W / 2, 190, '#e8edf2', 8, 'center');
}

function renderOverlays(c) {
  if (G.state === 'intro') {
    renderBanner(c, 'STATION ' + G.station, 'LEVEL ' + G.levelNum + (G.level.isFinal ? '  -  CONTROL CENTER' : ''), '#e6c15a');
  } else if (G.state === 'tally' && G.tally) {
    c.fillStyle = 'rgba(0,0,0,0.7)'; c.fillRect(56, 100, 400, 170);
    c.strokeStyle = '#46f08a'; c.lineWidth = 2; c.strokeRect(57, 101, 398, 168);
    txt(c, 'LEVEL COMPLETE', VIEW_W / 2, 116, '#46f08a', 16, 'center');
    G.tally.forEach((r, i) => {
      const y = 156 + i * 50, col = PCOL[r.id].ui;
      txt(c, 'PLAYER ' + (r.id + 1), 88, y, col);
      txt(c, 'FUEL BONUS', 88, y + 16, '#c8d0dc');
      const shown = Math.min(r.bonus, Math.floor(r.bonus * clamp((G.stateT - 0.4) / 1.2, 0, 1)));
      txt(c, String(shown), 424, y + 16, '#ffffff', 8, 'right');
    });
  } else if (G.state === 'continue') {
    c.fillStyle = 'rgba(0,0,0,0.55)'; c.fillRect(0, HUD_H, VIEW_W, VIEW_GH);
    txt(c, 'CONTINUE?', VIEW_W / 2, 150, '#ffd23a', 16, 'center');
    txt(c, String(Math.max(0, Math.ceil(G.continueT - 1))), VIEW_W / 2, 184, '#ffffff', 32, 'center');
    const who = G.players.filter(p => p.active).map(p => p.id + 1).join(' OR ');
    if (blink(2)) txt(c, 'PRESS ' + who + ' FOR MORE FUEL', VIEW_W / 2, 238, '#c8d0dc', 8, 'center');
  } else if (G.state === 'gameover') {
    renderBanner(c, 'GAME OVER', null, '#ff4a30');
  }
  if (G.banner && G.banner.t > 0 && G.state === 'play') {
    c.globalAlpha = clamp(G.banner.t, 0, 1);
    renderBanner(c, G.banner.text, G.banner.sub, G.banner.color);
    c.globalAlpha = 1;
  }
  if (G.paused) {
    c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillRect(0, 0, VIEW_W, VIEW_H);
    txt(c, 'PAUSED', VIEW_W / 2, 164, '#ffffff', 16, 'center');
    txt(c, 'PRESS P OR ESC TO RESUME', VIEW_W / 2, 196, '#8894a4', 8, 'center');
  }
}

function renderEquip(c) {
  renderBackdrop(c);
  const E = G.equip;
  txt(c, 'EQUIPMENT ROOM', VIEW_W / 2, 14, '#e6c15a', 16, 'center');
  txt(c, 'STATION ' + G.station + ' DESTROYED', VIEW_W / 2, 38, '#46f08a', 8, 'center');
  const act = G.players.filter(p => p.active);
  act.forEach((p, k) => {
    const x0 = act.length === 2 ? 8 + k * 252 : 132, w = 244, col = PCOL[p.id];
    c.fillStyle = 'rgba(10,14,20,0.88)'; c.fillRect(x0, 56, w, 290);
    c.strokeStyle = col.ui; c.lineWidth = 1; c.strokeRect(x0 + 0.5, 56.5, w - 1, 289);
    txt(c, 'PLAYER ' + (p.id + 1), x0 + 10, 66, col.ui);
    drawStarIcon(c, x0 + w - 50, 70, 6);
    txt(c, String(p.stars), x0 + w - 40, 66, '#ffd23a');
    EQUIP_ITEMS.forEach((it, i) => {
      const y = 92 + i * 30;
      const sel = E.cur[p.id] === i && !E.done[p.id];
      if (sel) {
        c.fillStyle = col.main; c.globalAlpha = 0.28; c.fillRect(x0 + 4, y - 6, w - 8, 22); c.globalAlpha = 1;
        if (blink(4)) txt(c, '>', x0 + 6, y, '#ffffff');
      }
      txt(c, it.name, x0 + 18, y, sel ? '#ffffff' : '#c8d0dc');
      if (it.key === 'done') return;
      if (it.key === 'refuel') {
        const st = pStats(p), fr = clamp(p.fuel / st.maxFuel, 0, 1);
        c.fillStyle = '#000'; c.fillRect(x0 + 112, y, 52, 7);
        c.fillStyle = '#4ade6a'; c.fillRect(x0 + 113, y + 1, 50 * fr, 5);
      } else {
        const lv = p.up[it.key];
        for (let j = 0; j < MAX_UP; j++) {
          c.fillStyle = j < lv ? col.ui : '#262c36';
          c.fillRect(x0 + 112 + j * 11, y, 8, 8);
        }
      }
      const cost = itemCost(p, it);
      if (cost === null) txt(c, 'MAX', x0 + w - 12, y, '#8894a4', 8, 'right');
      else {
        drawStarIcon(c, x0 + w - 42, y + 4, 5);
        txt(c, String(cost), x0 + w - 12, y, p.stars >= cost ? '#ffd23a' : '#7a5a30', 8, 'right');
      }
    });
    if (E.done[p.id]) {
      c.fillStyle = 'rgba(0,0,0,0.55)'; c.fillRect(x0 + 1, 57, w - 2, 288);
      txt(c, 'READY', x0 + w / 2, 190, '#46f08a', 16, 'center');
    }
  });
  txt(c, 'FIRE: BUY    SHIELD: DONE', VIEW_W / 2, 354, '#8894a4', 8, 'center');
  txt(c, 'TIME ' + Math.max(0, Math.ceil(E.t)), VIEW_W / 2, 368, '#ffffff', 8, 'center');
}

function renderVictory(c) {
  renderBackdrop(c);
  drawLogo(c, VIEW_W / 2, 90, 32);
  txt(c, 'ALL 14 TANGENT STATIONS', VIEW_W / 2, 150, '#46f08a', 8, 'center');
  txt(c, 'HAVE BEEN DESTROYED!', VIEW_W / 2, 166, '#46f08a', 8, 'center');
  txt(c, 'THE GALAXY IS FREE... FOR NOW.', VIEW_W / 2, 196, '#c8d0dc', 8, 'center');
  G.players.filter(p => p.active).forEach((p, i) => {
    txt(c, 'PLAYER ' + (p.id + 1) + '  ' + p.score, VIEW_W / 2, 236 + i * 18, PCOL[p.id].ui, 8, 'center');
  });
  txt(c, 'THE EMPIRE STRIKES BACK HARDER...', VIEW_W / 2, 300, '#ffd23a', 8, 'center');
}

function render(c) {
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.fillStyle = '#000'; c.fillRect(0, 0, VIEW_W, VIEW_H);
  if (G.state === 'title') { renderTitle(c); return; }
  if (G.state === 'equip') { renderEquip(c); return; }
  if (G.state === 'victory') { renderVictory(c); return; }
  renderWorld(c);
  renderHUD(c);
  renderOverlays(c);
}
