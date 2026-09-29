'use strict';
// ---------------------------------------------------------------------------
// Game state, simulation and main loop.
// ---------------------------------------------------------------------------
const UPGRADES = [
  { key: 'speed', name: 'SPEED' },
  { key: 'shotSpeed', name: 'SHOT SPEED' },
  { key: 'range', name: 'SHOT RANGE' },
  { key: 'power', name: 'SHOT POWER' },
  { key: 'shields', name: 'SHIELDS' },
  { key: 'fuelTank', name: 'FUEL TANK' },
];
const EQUIP_ITEMS = [...UPGRADES, { key: 'refuel', name: 'REFUEL' }, { key: 'done', name: 'DONE' }];
const MAX_UP = 5;
const DIFF = { easy: { drain: 0.7, dmg: 0.7 }, normal: { drain: 1, dmg: 1 }, hard: { drain: 1.3, dmg: 1.35 } };
const SCORE = { std: 100, fast: 150, heavy: 250, turret: 200, gen: 500, mine: 25, cc: 5000 };

function itemCost(p, it) {
  if (it.key === 'refuel') return 2;
  if (it.key === 'done') return null;
  const lv = p.up[it.key];
  return lv >= MAX_UP ? null : 3 + lv * 3;
}

function newPlayer(id) {
  return {
    id, active: false, alive: false, x: 0, y: 0, a: -Math.PI / 2, r: 11,
    fuel: 100, stars: 0, score: 0, shieldE: 3, shieldOn: false,
    fireCd: 0, inv: 0, flash: 0, treadL: 0, treadR: 0, lowWarn: 0, saidLow: false, warp: 0,
    up: { speed: 0, shotSpeed: 0, range: 0, power: 0, shields: 0, fuelTank: 0 },
  };
}

function pStats(p) {
  const u = p.up;
  return {
    speed: 74 + 13 * u.speed, rot: 2.6 + 0.22 * u.speed,
    shotSpeed: 240 + 45 * u.shotSpeed, fireRate: 0.34 - 0.035 * u.shotSpeed,
    range: 150 + 40 * u.range, dmg: 1 + u.power,
    shieldMax: 3 + 1.6 * u.shields, maxFuel: 100 + 25 * u.fuelTank,
  };
}

const G = {
  state: 'title', t: 0, stateT: 0,
  station: 1, levelNum: 1, loop: 0,
  level: null, map: null, demo: null,
  players: [newPlayer(0), newPlayer(1)],
  enemies: [], bullets: [], pickups: [], particles: [], rings: [], texts: [],
  exit: null, cam: { x: 0, y: 0 }, shake: 0,
  flow: null, flowQ: null, flowT: 0,
  escaping: false, escapeT: 0, alarmT: 0, levelTime: 0,
  paused: false, modalOpen: false, continueT: 0, tally: null, equip: null, banner: null,
  hiscores: [], exiter: null,
};

const diffLevel = () => (G.station - 1) + (G.levelNum - 1) * 0.5 + G.loop * 6;
const D = () => DIFF[Settings.difficulty] || DIFF.normal;
const inGame = () => !['title', 'equip', 'victory'].includes(G.state);
function setState(s) { G.state = s; G.stateT = 0; }

// ---------------------------------------------------------------------------
// Tile helpers
// ---------------------------------------------------------------------------
function tileAt(x, y) {
  const L = G.level, tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
  if (tx < 0 || ty < 0 || tx >= L.W || ty >= L.H) return 1;
  return L.grid[ty * L.W + tx];
}

function blockedAt(x, y, r) {
  const L = G.level;
  const x0 = Math.floor((x - r) / TILE), x1 = Math.floor((x + r) / TILE);
  const y0 = Math.floor((y - r) / TILE), y1 = Math.floor((y + r) / TILE);
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const s = tx < 0 || ty < 0 || tx >= L.W || ty >= L.H || L.grid[ty * L.W + tx] !== 0;
      if (!s) continue;
      const cx = clamp(x, tx * TILE, tx * TILE + TILE), cy = clamp(y, ty * TILE, ty * TILE + TILE);
      if ((x - cx) ** 2 + (y - cy) ** 2 < r * r) return true;
    }
  }
  return false;
}

function moveCircle(e, dx, dy) {
  let hit = false;
  if (dx) { if (!blockedAt(e.x + dx, e.y, e.r)) e.x += dx; else hit = true; }
  if (dy) { if (!blockedAt(e.x, e.y + dy, e.r)) e.y += dy; else hit = true; }
  return hit;
}

function los(x0, y0, x1, y1) {
  const dx = x1 - x0, dy = y1 - y0, n = Math.ceil(Math.hypot(dx, dy) / 8);
  for (let i = 1; i < n; i++) if (tileAt(x0 + dx * i / n, y0 + dy * i / n) === 1) return false;
  return true;
}

function nearestPlayer(x, y) {
  let best = null, bd = Infinity;
  for (const p of G.players) {
    if (!p.active || !p.alive) continue;
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < bd) { bd = d; best = p; }
  }
  return best ? { p: best, d: bd } : null;
}

// Breadth-first "flow field" from the players so enemy tanks can navigate the maze.
function computeFlow() {
  const L = G.level, W = L.W, flow = G.flow, q = G.flowQ;
  flow.fill(-1);
  let head = 0, tail = 0;
  for (const p of G.players) {
    if (!p.active || !p.alive) continue;
    const i = Math.floor(p.y / TILE) * W + Math.floor(p.x / TILE);
    if (flow[i] < 0) { flow[i] = 0; q[tail++] = i; }
  }
  while (head < tail) {
    const i = q[head++];
    if (flow[i] > 40) continue;
    for (const n of [i + 1, i - 1, i + W, i - W]) {
      if (L.grid[n] === 0 && flow[n] < 0) { flow[n] = flow[i] + 1; q[tail++] = n; }
    }
  }
}

function flowStep(e) {
  const L = G.level, W = L.W;
  const tx = Math.floor(e.x / TILE), ty = Math.floor(e.y / TILE), i = ty * W + tx;
  const cur = G.flow[i];
  if (cur < 0) return null;
  let best = -1, bv = cur;
  for (const n of [i + 1, i - 1, i + W, i - W]) {
    const v = G.flow[n];
    if (v >= 0 && v < bv) { bv = v; best = n; }
  }
  if (best < 0) return null;
  return { x: (best % W) * TILE + TILE / 2, y: Math.floor(best / W) * TILE + TILE / 2 };
}

// ---------------------------------------------------------------------------
// Effects
// ---------------------------------------------------------------------------
function particles(x, y, n, colors, speed, life, size = 2) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU, s = Math.random() * speed;
    G.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: life * rand(0.5, 1), max: life, color: colors[(Math.random() * colors.length) | 0], size: size * rand(0.6, 1.4) });
  }
}

function explosion(x, y, size) {
  particles(x, y, 12 + size * 14, ['#fff6d0', '#ffd23a', '#ff8a2a', '#ff4a20', '#a02a10'], 60 + size * 50, 0.7 + size * 0.2, 2 + size);
  particles(x, y, 6 + size * 6, ['#3a3a3a', '#555', '#222'], 30 + size * 20, 1.2, 3 + size);
  G.rings.push({ x, y, t: 0, max: 0.35 + size * 0.12, size: 14 + size * 12, color: '#ffb040' });
  G.shake = Math.min(14, G.shake + 2 + size * 2.5);
  Sound.explode(size >= 2);
  // permanent scorch mark on the deck
  if (G.map && tileAt(x, y) === 0) {
    const f = G.map.fctx, r = 8 + size * 5;
    const g = f.createRadialGradient(x, y, 1, x, y, r);
    g.addColorStop(0, 'rgba(0,0,0,0.45)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    f.fillStyle = g; f.fillRect(x - r, y - r, r * 2, r * 2);
  }
}

function floatText(x, y, s, color = '#ffffff') { G.texts.push({ x, y, s, color, t: 1.2 }); }
function banner(text, sub, color = '#ffd23a', t = 2.5) { G.banner = { text, sub, color, t }; }

// ---------------------------------------------------------------------------
// Game flow
// ---------------------------------------------------------------------------
function resetPlayer(p) {
  Object.assign(p, newPlayer(p.id));
}

function activatePlayer(p, near) {
  p.active = true; p.alive = true;
  const st = pStats(p);
  p.fuel = st.maxFuel; p.shieldE = st.shieldMax; p.inv = 2; p.saidLow = false; p.warp = 0;
  if (near) {
    p.a = near.a;
    for (const off of [[28, 0], [-28, 0], [0, 28], [0, -28], [0, 0]]) {
      p.x = near.x + off[0]; p.y = near.y + off[1];
      if (!blockedAt(p.x, p.y, p.r)) break;
    }
    nudgeFree(p);
  }
}

function nudgeFree(p) {
  if (!G.level) return;
  for (let r = 0; r < 80; r += 8) {
    for (let k = 0; k < 8; k++) {
      const a = k * TAU / 8, x = p.x + Math.cos(a) * r, y = p.y + Math.sin(a) * r;
      if (!blockedAt(x, y, p.r)) { p.x = x; p.y = y; return; }
    }
  }
}

function startGame(who) {
  G.players.forEach(resetPlayer);
  G.station = 1; G.levelNum = 1; G.loop = 0;
  activatePlayer(G.players[who]);
  Sound.coin();
  loadLevel();
}

function loadLevel() {
  const L = generateLevel(G.station, G.levelNum, G.loop);
  G.level = L;
  G.map = buildMapCanvases(L);
  G.enemies = []; G.bullets = []; G.pickups = []; G.particles = []; G.rings = []; G.texts = [];
  G.exit = null; G.escaping = false; G.escapeT = 0; G.levelTime = 0; G.flowT = 0; G.banner = null; G.exiter = null;
  G.flow = new Int16Array(L.W * L.H); G.flowQ = new Int32Array(L.W * L.H);
  const d = diffLevel();
  for (const s of L.spawns) {
    if (s.type === 'fuel' || s.type === 'star' || s.type === 'shield') G.pickups.push({ type: s.type, x: s.x, y: s.y, ph: Math.random() * 6 });
    else if (s.type === 'exit') G.exit = { x: s.x, y: s.y, locked: !!s.locked };
    else G.enemies.push(makeEnemy(s.type, s.x, s.y, s.kind, d));
  }
  let k = 0;
  for (const p of G.players) {
    if (!p.active) continue;
    p.x = L.start.x + (k ? 22 : -22) * (G.players.filter(q => q.active).length > 1 ? 1 : 0);
    p.y = L.start.y; p.a = -Math.PI / 2; p.warp = 0; p.shieldOn = false; p.fireCd = 0;
    nudgeFree(p);
    if (p.alive) p.inv = 1.5;
    k++;
  }
  updateCamera(0, true);
  setState('intro');
  Sound.say(G.levelNum === 1 ? 'Station ' + G.station : L.isFinal ? 'Control center level' : 'Level ' + G.levelNum);
}

function makeEnemy(type, x, y, kind, d) {
  const e = { type, x, y, a: rand(0, TAU), flash: 0, fireCd: rand(1, 2.5), dead: false };
  switch (type) {
    case 'tank': {
      e.kind = kind || 'std'; e.r = e.kind === 'heavy' ? 12 : 11; e.tread = 0; e.stuck = 0;
      e.hp = e.kind === 'heavy' ? 5 + Math.floor(d / 4) : 2 + Math.floor(d / 5);
      e.speed = e.kind === 'fast' ? 86 + 2 * d : e.kind === 'heavy' ? 36 + d : 48 + 2 * d;
      e.rot = e.kind === 'fast' ? 3.4 : 2.2;
      break;
    }
    case 'turret': e.r = 13; e.hp = 3 + Math.floor(d / 4); break;
    case 'gen': e.r = 14; e.hp = 8 + Math.floor(d / 2); e.spawnCd = rand(1, 3); e.kids = 0; e.open = 0; e.a = 0; break;
    case 'mine': e.r = 7; e.hp = 1; break;
    case 'cc': e.r = 30; e.hp = e.maxHp = 40 + 6 * G.station + G.loop * 30; e.spin = 0; e.ringCd = 2; e.aimCd = 1; break;
  }
  if (!e.maxHp) e.maxHp = e.hp;
  return e;
}

function beginExit(p) {
  G.exiter = p;
  p.x = G.exit.x; p.y = G.exit.y;
  Sound.exit();
  setState('exiting');
}

function startTally() {
  G.tally = [];
  for (const p of G.players) {
    if (!p.active || !p.alive) continue;
    const bonus = Math.floor(p.fuel) * 10;
    p.score += bonus;
    G.tally.push({ id: p.id, bonus });
  }
  setState('tally');
}

function nextLevel() {
  if (G.levelNum < LEVELS_PER_STATION) { G.levelNum++; loadLevel(); return; }
  G.equip = { cur: [0, 0], done: G.players.map(p => !p.active), t: 45 };
  Sound.say('Equipment room');
  setState('equip');
}

function finishEquip() {
  G.station++; G.levelNum = 1;
  if (G.station > NUM_STATIONS) { setState('victory'); Sound.say('Congratulations, Vindicators'); return; }
  loadLevel();
}

function continuePlayer(p) {
  const partner = G.players.find(q => q !== p && q.active && q.alive);
  activatePlayer(p, partner || null);
  if (G.escaping && G.escapeT < 15) G.escapeT = 15;
  Sound.coin();
  floatText(p.x, p.y - 20, 'FUEL UP!', PCOL[p.id].ui);
}

function gameOver() {
  setState('gameover');
  Sound.engine(0);
  Sound.say('Game over');
}

async function afterGameOver() {
  for (const p of G.players) {
    if (!p.active) continue;
    const list = G.hiscores;
    if (list.length < 10 || p.score > list[list.length - 1].score) {
      const name = await UI.askInitials(p.id + 1, p.score);
      list.push({ name: (name || 'AAA').toUpperCase().slice(0, 3), score: p.score, station: G.station });
      list.sort((a, b) => b.score - a.score);
      list.length = Math.min(list.length, 10);
      saveHiscores(list);
    }
  }
  G.players.forEach(resetPlayer);
  setState('title');
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------
function update(dt) {
  Input.soloP1 = !G.players[1].active;
  Input.poll();
  if (Input.pauseP && inGame() && G.state !== 'gameover') G.paused = !G.paused;
  if (G.paused || G.modalOpen) { Sound.engine(0); return; }
  G.t += dt; G.stateT += dt;
  const c = Input.c;

  switch (G.state) {
    case 'title':
      if (c[0].startP || c[0].fireP) startGame(0);
      else if (c[1].startP || c[1].fireP) startGame(1);
      break;
    case 'intro':
      handleJoin();
      updateEffects(dt); updateCamera(dt);
      if (G.stateT > 2.4 || (G.stateT > 0.6 && (c[0].fireP || c[1].fireP))) setState('play');
      break;
    case 'play':
      updatePlay(dt);
      break;
    case 'exiting': {
      const p = G.exiter;
      p.warp = Math.min(1, G.stateT / 1.3);
      if (Math.random() < 0.6) particles(p.x, p.y, 2, ['#46f08a', '#d8ffe6', '#ffffff'], 80, 0.5);
      updateBullets(dt); updateEffects(dt); updateCamera(dt);
      Sound.engine(0);
      if (G.stateT > 1.6) startTally();
      break;
    }
    case 'tally':
      updateEffects(dt);
      if (G.stateT > 3.2 || (G.stateT > 1.2 && (c[0].fireP || c[1].fireP))) nextLevel();
      break;
    case 'equip':
      updateEquip(dt);
      break;
    case 'continue':
      G.continueT -= dt;
      handleJoin();
      if (G.players.some(p => p.active && p.alive)) setState('play');
      else if (G.continueT <= 0) gameOver();
      updateEffects(dt);
      break;
    case 'gameover':
      updateEffects(dt);
      if (G.stateT > 3 && !G.goQueued) { G.goQueued = true; afterGameOver().finally(() => { G.goQueued = false; }); }
      break;
    case 'victory':
      if (G.stateT > 9 || (G.stateT > 2 && (c[0].fireP || c[1].fireP))) { G.loop++; G.station = 1; G.levelNum = 1; loadLevel(); }
      break;
  }
}

function handleJoin() {
  const c = Input.c;
  for (const p of G.players) {
    if (!c[p.id].startP) continue;
    if (!p.active) {
      const partner = G.players.find(q => q !== p && q.active && q.alive) || G.players.find(q => q !== p);
      activatePlayer(p, partner);
      Sound.coin();
      banner('PLAYER ' + (p.id + 1) + ' JOINS', null, PCOL[p.id].ui, 1.5);
    } else if (!p.alive) {
      continuePlayer(p);
    }
  }
}

function updatePlay(dt) {
  G.levelTime += dt;
  handleJoin();
  let eng = 0;
  for (const p of G.players) if (p.active && p.alive) eng = Math.max(eng, updatePlayer(p, dt));
  Sound.engine(eng);

  G.flowT -= dt;
  if (G.flowT <= 0) { computeFlow(); G.flowT = 0.35; }
  const d = diffLevel();
  for (const e of G.enemies) if (!e.dead) updateEnemy(e, dt, d);
  separateTanks();
  contacts();
  updateBullets(dt);
  G.enemies = G.enemies.filter(e => !e.dead);
  collectPickups();

  if (G.exit && !G.exit.locked) {
    for (const p of G.players) {
      if (p.active && p.alive && Math.hypot(p.x - G.exit.x, p.y - G.exit.y) < 16) { beginExit(p); return; }
    }
  }

  if (G.escaping) {
    G.escapeT -= dt;
    G.alarmT -= dt;
    if (G.alarmT <= 0) { Sound.alarm(); G.alarmT = 1; }
    if (G.escapeT <= 0) {
      for (const p of G.players) if (p.active && p.alive) { explosion(p.x, p.y, 3); killPlayer(p); }
      G.escapeT = 30;
    }
  }
  if (G.banner) G.banner.t -= dt;

  updateEffects(dt);
  updateCamera(dt);

  if (!G.players.some(p => p.active && p.alive)) {
    G.continueT = 10.99;
    Sound.engine(0);
    setState('continue');
  }
}

function updatePlayer(p, dt) {
  const c = Input.c[p.id], st = pStats(p);
  const fwd = (c.L + c.R) / 2, rot = (c.L - c.R) / 2;
  p.a += rot * st.rot * dt;
  const v = fwd * st.speed;
  const ox = p.x, oy = p.y;
  moveCircle(p, Math.cos(p.a) * v * dt, Math.sin(p.a) * v * dt);

  // two tanks share one screen: don't let them drift apart
  const o = G.players.find(q => q !== p && q.active && q.alive);
  if (o) {
    if (Math.abs(p.x - o.x) > VIEW_W - 60 && Math.abs(p.x - o.x) > Math.abs(ox - o.x)) p.x = ox;
    if (Math.abs(p.y - o.y) > VIEW_GH - 60 && Math.abs(p.y - o.y) > Math.abs(oy - o.y)) p.y = oy;
  }
  p.treadL += c.L * dt * 16; p.treadR += c.R * dt * 16;
  const moving = Math.abs(c.L) + Math.abs(c.R) > 0.1;

  p.fuel -= dt * (0.55 + (moving ? 0.25 : 0)) * D().drain;
  p.fireCd -= dt; p.inv -= dt; p.flash -= dt;

  if (c.fire && p.fireCd <= 0) {
    const bx = p.x + Math.cos(p.a) * 16, by = p.y + Math.sin(p.a) * 16;
    p.fireCd = st.fireRate;
    Sound.shot();
    if (tileAt(bx, by) === 1) particles(bx, by, 4, ['#ffe', '#fc6'], 60, 0.2);
    else G.bullets.push({ x: bx, y: by, a: p.a, vx: Math.cos(p.a) * st.shotSpeed, vy: Math.sin(p.a) * st.shotSpeed, left: st.range, dmg: st.dmg, owner: p.id });
  }

  const wasOn = p.shieldOn;
  p.shieldOn = c.shield && p.shieldE > 0;
  if (p.shieldOn) { p.shieldE -= dt; if (!wasOn) Sound.shieldOn(); }
  else p.shieldE = Math.min(st.shieldMax, p.shieldE + dt * 0.06);

  if (p.fuel < st.maxFuel * 0.22) {
    p.lowWarn -= dt;
    if (p.lowWarn <= 0) { Sound.lowFuel(); p.lowWarn = 1.4; }
    if (!p.saidLow) { p.saidLow = true; Sound.say('Fuel low'); }
  } else p.saidLow = false;

  if (p.fuel <= 0) { explosion(p.x, p.y, 2); killPlayer(p); }
  return moving ? Math.max(Math.abs(c.L), Math.abs(c.R)) : 0;
}

function killPlayer(p) {
  p.alive = false; p.fuel = 0; p.shieldOn = false;
  particles(p.x, p.y, 20, [PCOL[p.id].main, PCOL[p.id].light, '#333'], 140, 1.2, 3);
  if (G.players.some(q => q.active && q.alive)) Sound.say('Player ' + (p.id + 1) + ' needs fuel');
}

function damagePlayer(p, amt) {
  if (!p.alive) return;
  if (p.shieldOn) { Sound.deflect(); return; }
  if (p.inv > 0) return;
  p.fuel -= amt * D().dmg;
  p.inv = 0.3; p.flash = 0.12;
  G.shake = Math.min(14, G.shake + 4);
  Sound.hurt();
  floatText(p.x, p.y - 18, '-' + Math.round(amt * D().dmg), '#ff6a4a');
  if (p.fuel <= 0) { explosion(p.x, p.y, 2); killPlayer(p); }
}

function enemyFire(e, a, speed, dmg, off = 16) {
  G.bullets.push({ x: e.x + Math.cos(a) * off, y: e.y + Math.sin(a) * off, a, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, left: 420, dmg, owner: -1 });
  Sound.eshot();
}

function updateEnemy(e, dt, d) {
  e.flash -= dt;
  const tg = nearestPlayer(e.x, e.y);
  if (e.type === 'cc') e.spin += dt * 1.4;
  if (!tg || (tg.d > 620 && e.type !== 'cc')) return;
  const tp = tg.p, dist = tg.d;
  const bspeed = 165 + 6 * d, bdmg = 7 + d * 0.35;
  e.fireCd -= dt;

  switch (e.type) {
    case 'tank': {
      const see = dist < 300 && los(e.x, e.y, tp.x, tp.y);
      let desired = null, go = false;
      if (see) { desired = Math.atan2(tp.y - e.y, tp.x - e.x); go = dist > (e.kind === 'heavy' ? 150 : 96); }
      else { const s = flowStep(e); if (s) { desired = Math.atan2(s.y - e.y, s.x - e.x); go = true; } }
      if (desired !== null) {
        const df = angDiff(e.a, desired), turn = e.rot * dt;
        e.a += clamp(df, -turn, turn);
        if (go && Math.abs(df) < 0.6) {
          const hit = moveCircle(e, Math.cos(e.a) * e.speed * dt, Math.sin(e.a) * e.speed * dt);
          e.tread += e.speed * dt * 0.3;
          e.stuck = hit ? e.stuck + dt : 0;
        }
        if (see && Math.abs(df) < 0.16 && e.fireCd <= 0) {
          enemyFire(e, e.a, bspeed * (e.kind === 'fast' ? 1.2 : 1), bdmg * (e.kind === 'heavy' ? 1.4 : 1));
          e.fireCd = Math.max(0.9, 2.5 - d * 0.1) + rand(0, 1.2);
        }
      }
      if (e.stuck > 0.5) { e.a += rand(-1.5, 1.5); e.stuck = 0; }
      break;
    }
    case 'turret': {
      if (dist < 330 && los(e.x, e.y, tp.x, tp.y)) {
        const df = angDiff(e.a, Math.atan2(tp.y - e.y, tp.x - e.x));
        e.a += clamp(df, -1.7 * dt, 1.7 * dt);
        if (Math.abs(df) < 0.12 && e.fireCd <= 0) {
          enemyFire(e, e.a, bspeed, bdmg, 18);
          e.fireCd = Math.max(0.8, 1.9 - d * 0.07) + rand(0, 0.6);
        }
      } else e.a += dt * 0.4;
      break;
    }
    case 'gen': {
      e.spawnCd -= dt;
      e.open = Math.max(0, e.open - dt * 2);
      const cap = 3 + Math.floor(d / 4);
      if (dist < 380 && e.spawnCd <= 0 && e.kids < cap && G.enemies.length < 70) {
        const t = makeEnemy('tank', e.x, e.y, d >= 5 && Math.random() < 0.3 ? 'fast' : 'std', d);
        t.parent = e; t.a = Math.atan2(tp.y - e.y, tp.x - e.x);
        G.enemies.push(t);
        e.kids++; e.open = 1;
        e.spawnCd = Math.max(2.2, 5 - d * 0.18);
      }
      break;
    }
    case 'cc': {
      if (dist > 440) break;
      e.ringCd -= dt; e.aimCd -= dt;
      if (e.ringCd <= 0) {
        const n = 10 + Math.min(8, Math.floor(d / 2));
        for (let i = 0; i < n; i++) enemyFire(e, e.spin + i * TAU / n, bspeed * 0.8, bdmg, 30);
        e.ringCd = Math.max(1.3, 2.4 - d * 0.05);
      }
      if (e.aimCd <= 0 && los(e.x, e.y, tp.x, tp.y)) {
        const a = Math.atan2(tp.y - e.y, tp.x - e.x);
        for (const s of [-0.18, 0, 0.18]) enemyFire(e, a + s, bspeed * 1.1, bdmg, 30);
        e.aimCd = Math.max(0.8, 1.4 - d * 0.03);
      }
      break;
    }
  }
}

function separateTanks() {
  const tanks = G.enemies.filter(e => e.type === 'tank' && !e.dead);
  for (let i = 0; i < tanks.length; i++) {
    for (let j = i + 1; j < tanks.length; j++) {
      const a = tanks[i], b = tanks[j];
      const dx = b.x - a.x, dy = b.y - a.y, dd = Math.hypot(dx, dy), m = a.r + b.r;
      if (dd > 0.01 && dd < m) {
        const k = (m - dd) / 2 / dd;
        moveCircle(a, -dx * k, -dy * k); moveCircle(b, dx * k, dy * k);
      }
    }
  }
}

function contacts() {
  const [a, b] = G.players;
  if (a.active && a.alive && b.active && b.alive) {
    const dx = b.x - a.x, dy = b.y - a.y, dd = Math.hypot(dx, dy), m = a.r + b.r;
    if (dd > 0.01 && dd < m) {
      const k = (m - dd) / 2 / dd;
      moveCircle(a, -dx * k, -dy * k); moveCircle(b, dx * k, dy * k);
    }
  }
  for (const p of G.players) {
    if (!p.active || !p.alive) continue;
    for (const e of G.enemies) {
      if (e.dead) continue;
      const dx = p.x - e.x, dy = p.y - e.y, dd = Math.hypot(dx, dy), m = p.r + e.r;
      if (dd >= m) continue;
      if (e.type === 'mine') { killEnemy(e, -1); damagePlayer(p, 16); continue; }
      if (dd > 0.01) moveCircle(p, dx / dd * (m - dd), dy / dd * (m - dd));
      if (e.type === 'tank') damagePlayer(p, 4);
    }
  }
}

function hitEnemy(e, b) {
  e.hp -= b.dmg; e.flash = 0.08;
  particles(b.x, b.y, 4, ['#fff', '#ffd23a'], 70, 0.25);
  if (e.hp <= 0) killEnemy(e, b.owner);
  else Sound.hitEnemy();
}

function killEnemy(e, owner) {
  if (e.dead) return;
  e.dead = true;
  const size = e.type === 'cc' ? 4 : e.type === 'gen' ? 2 : e.type === 'mine' ? 1 : e.kind === 'heavy' ? 2 : 1;
  explosion(e.x, e.y, size);
  if (e.parent) e.parent.kids--;
  const pts = e.type === 'tank' ? SCORE[e.kind] : SCORE[e.type];
  if (owner >= 0) {
    G.players[owner].score += pts;
    floatText(e.x, e.y - 14, String(pts), '#ffffff');
  }
  const drop = (type, dx = 0, dy = 0) => {
    const x = e.x + dx, y = e.y + dy;
    if (tileAt(x, y) === 0) G.pickups.push({ type, x, y, ph: Math.random() * 6 });
  };
  if (e.type === 'tank') { const r = Math.random(); if (r < 0.2) drop('star'); else if (r < 0.32) drop('fuel'); }
  else if (e.type === 'turret') { if (Math.random() < 0.3) drop('star'); }
  else if (e.type === 'gen') { drop('star', -10, 0); drop('star', 10, 0); if (Math.random() < 0.5) drop('fuel', 0, 12); }
  else if (e.type === 'cc') {
    const L = G.level;
    for (let i = 0; i < L.grid.length; i++) if (L.grid[i] === 2) L.grid[i] = 0;
    for (let i = 0; i < 6; i++) {
      const a = i * TAU / 6;
      setTimeout(() => { if (G.level === L) explosion(e.x + Math.cos(a) * 26, e.y + Math.sin(a) * 26, 2); }, 120 * (i + 1));
    }
    for (let i = 0; i < 5; i++) drop('star', Math.cos(i * TAU / 5) * 22, Math.sin(i * TAU / 5) * 22);
    drop('fuel');
    if (G.exit) G.exit.locked = false;
    G.escaping = true; G.escapeT = 30; G.alarmT = 0;
    banner('CONTROL CENTER DESTROYED', 'ESCAPE BEFORE THE STATION BLOWS!', '#ff6a3a', 3);
    Sound.say('Control center destroyed. Escape now!');
  }
}

function updateBullets(dt) {
  const out = [];
  for (const b of G.bullets) {
    const sp = Math.hypot(b.vx, b.vy), steps = Math.max(1, Math.ceil(sp * dt / 6));
    let alive = true;
    for (let s = 0; s < steps && alive; s++) {
      b.x += b.vx * dt / steps; b.y += b.vy * dt / steps;
      b.left -= sp * dt / steps;
      if (b.left <= 0) { alive = false; if (b.owner >= 0) particles(b.x, b.y, 3, ['#aaa', '#777'], 30, 0.25); break; }
      const t = tileAt(b.x, b.y);
      if (t === 1) {
        alive = false;
        particles(b.x, b.y, 5, b.owner >= 0 ? ['#fff', '#ffe08a'] : ['#ffb070', '#ff6a2a'], 70, 0.25);
        if (b.owner >= 0) Sound.spark();
        break;
      }
      if (b.owner >= 0) {
        for (const e of G.enemies) {
          if (e.dead) continue;
          const r = e.r + 2;
          if ((b.x - e.x) ** 2 + (b.y - e.y) ** 2 < r * r) { hitEnemy(e, b); alive = false; break; }
        }
      } else {
        for (const p of G.players) {
          if (!p.active || !p.alive) continue;
          const r = p.shieldOn ? 18 : p.r;
          if ((b.x - p.x) ** 2 + (b.y - p.y) ** 2 < r * r) {
            alive = false;
            if (p.shieldOn) { Sound.deflect(); particles(b.x, b.y, 6, ['#d8faff', '#5ae0ff'], 80, 0.3); }
            else { damagePlayer(p, b.dmg); particles(b.x, b.y, 8, ['#fff', '#ff8a2a'], 90, 0.35); }
            break;
          }
        }
      }
    }
    if (alive) out.push(b);
  }
  // player shots can knock enemy shots out of the air
  for (const b of out) {
    if (b.owner < 0 || b.dead) continue;
    for (const e of out) {
      if (e.owner >= 0 || e.dead) continue;
      if ((b.x - e.x) ** 2 + (b.y - e.y) ** 2 < 64) { b.dead = e.dead = true; particles(e.x, e.y, 6, ['#fff', '#ffd23a'], 60, 0.3); break; }
    }
  }
  G.bullets = out.filter(b => !b.dead);
}

function collectPickups() {
  for (const k of G.pickups) {
    if (k.taken) continue;
    for (const p of G.players) {
      if (!p.active || !p.alive || Math.hypot(p.x - k.x, p.y - k.y) > 17) continue;
      k.taken = true;
      const st = pStats(p);
      if (k.type === 'fuel') { p.fuel = Math.min(st.maxFuel, p.fuel + 30); Sound.fuel(); floatText(k.x, k.y - 12, 'FUEL', '#ff8a6a'); }
      else if (k.type === 'star') { p.stars++; p.score += 50; Sound.star(); floatText(k.x, k.y - 12, '+STAR', '#ffd23a'); }
      else if (k.type === 'shield') { p.shieldE = st.shieldMax; Sound.shieldPick(); floatText(k.x, k.y - 12, 'SHIELD', '#5ae0ff'); }
      particles(k.x, k.y, 10, ['#fff', '#ffd23a', '#5ae0ff'], 60, 0.4);
      break;
    }
  }
  G.pickups = G.pickups.filter(k => !k.taken);
}

function updateEffects(dt) {
  for (const q of G.particles) { q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 0.94; q.vy *= 0.94; q.life -= dt; }
  G.particles = G.particles.filter(q => q.life > 0);
  if (G.particles.length > 900) G.particles.splice(0, G.particles.length - 900);
  for (const r of G.rings) r.t += dt;
  G.rings = G.rings.filter(r => r.t < r.max);
  for (const f of G.texts) { f.y -= 22 * dt; f.t -= dt; }
  G.texts = G.texts.filter(f => f.t > 0);
  G.shake = Math.max(0, G.shake - dt * 30);
}

function updateCamera(dt, snap) {
  const L = G.level;
  if (!L) return;
  const ps = G.players.filter(p => p.active && p.alive);
  if (!ps.length) return;
  const tx = ps.reduce((s, p) => s + p.x, 0) / ps.length - VIEW_W / 2;
  const ty = ps.reduce((s, p) => s + p.y, 0) / ps.length - VIEW_GH / 2;
  const k = snap ? 1 : 1 - Math.exp(-dt * 8);
  G.cam.x = clamp(lerp(G.cam.x, tx, k), 0, L.W * TILE - VIEW_W);
  G.cam.y = clamp(lerp(G.cam.y, ty, k), 0, L.H * TILE - VIEW_GH);
}

function updateEquip(dt) {
  const E = G.equip, c = Input.c;
  E.t -= dt;
  for (const p of G.players) {
    if (!p.active || E.done[p.id]) continue;
    const ci = c[p.id];
    if (ci.upP) { E.cur[p.id] = (E.cur[p.id] + EQUIP_ITEMS.length - 1) % EQUIP_ITEMS.length; Sound.blip(); }
    if (ci.downP) { E.cur[p.id] = (E.cur[p.id] + 1) % EQUIP_ITEMS.length; Sound.blip(); }
    if (ci.shieldP || ci.startP) { E.done[p.id] = true; Sound.blip(); continue; }
    if (ci.fireP) {
      const it = EQUIP_ITEMS[E.cur[p.id]];
      if (it.key === 'done') { E.done[p.id] = true; Sound.blip(); continue; }
      const cost = itemCost(p, it), st = pStats(p);
      if (cost === null || p.stars < cost || (it.key === 'refuel' && p.fuel >= st.maxFuel)) { Sound.deny(); continue; }
      p.stars -= cost;
      if (it.key === 'refuel') p.fuel = st.maxFuel;
      else {
        p.up[it.key]++;
        const ns = pStats(p);
        if (it.key === 'fuelTank') p.fuel += ns.maxFuel - st.maxFuel;
        if (it.key === 'shields') p.shieldE = ns.shieldMax;
      }
      Sound.buy();
    }
  }
  if (E.done.every(Boolean) || E.t <= 0) finishEquip();
}

// ---------------------------------------------------------------------------
// Boot / main loop
// ---------------------------------------------------------------------------
let canvas, ctx;
const Game = {
  boot() {
    canvas = document.getElementById('screen');
    ctx = canvas.getContext('2d');
    Settings.load();
    G.hiscores = loadHiscores();
    Input.init();
    const dl = generateLevel(3, 2, 0);
    G.demo = { level: dl, map: buildMapCanvases(dl) };
    window.addEventListener('blur', () => { if (inGame() && G.state !== 'gameover') G.paused = true; });

    const STEP = 1 / 60;
    let last = performance.now(), acc = 0;
    const frame = now => {
      acc += Math.min(0.25, (now - last) / 1000);
      last = now;
      let n = 0;
      while (acc >= STEP && n < 5) { update(STEP); acc -= STEP; n++; }
      if (n === 5) acc = 0;
      render(ctx);
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  },
};
