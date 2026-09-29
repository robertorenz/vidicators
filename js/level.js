'use strict';
// ---------------------------------------------------------------------------
// Space-station level generator. Each station floor is a grid of armoured
// rooms joined by 2-tile corridors. Levels are seeded so a given
// station/level is always laid out the same way, just like the arcade maps.
// grid values: 0 = floor, 1 = wall, 2 = solid machinery (control center)
// ---------------------------------------------------------------------------
const DIRS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

function generateLevel(station, levelNum, loop) {
  const seed = (Math.imul(station, 7919) + Math.imul(levelNum, 104729) + Math.imul(loop, 31337) + 12345) >>> 0;
  const rng = mulberry32(seed);
  const ri = (a, b) => a + Math.floor(rng() * (b - a + 1));
  const pick = arr => arr[Math.floor(rng() * arr.length)];
  const isFinal = levelNum === LEVELS_PER_STATION;
  const d = (station - 1) + (levelNum - 1) * 0.5 + loop * 6;

  const cols = 3 + Math.min(3, Math.floor(station / 3));
  const rows = 3 + Math.min(2, Math.floor((station + 1) / 5));
  const CELL = 11;
  const W = cols * CELL + 2, H = rows * CELL + 2;
  const grid = new Uint8Array(W * H).fill(1);
  const I = (x, y) => y * W + x;
  const inside = (x, y) => x > 0 && y > 0 && x < W - 1 && y < H - 1;
  const carve = (x, y) => { if (inside(x, y)) grid[I(x, y)] = 0; };

  // --- rooms --------------------------------------------------------------
  const rooms = [];
  for (let cy = 0; cy < rows; cy++) {
    for (let cx = 0; cx < cols; cx++) {
      const w = ri(6, 9), h = ri(5, 8);
      const x = 1 + cx * CELL + ri(1, CELL - w - 1);
      const y = 1 + cy * CELL + ri(1, CELL - h - 1);
      rooms.push({ x, y, w, h, cx, cy, id: rooms.length, ccx: x + (w >> 1), ccy: y + (h >> 1) });
    }
  }
  const carveRoom = r => { for (let yy = r.y; yy < r.y + r.h; yy++) for (let xx = r.x; xx < r.x + r.w; xx++) carve(xx, yy); };
  rooms.forEach(carveRoom);

  // --- corridors (random spanning tree + a few loops) ----------------------
  function hline(x0, x1, y) { for (let x = Math.min(x0, x1); x <= Math.max(x0, x1) + 1; x++) { carve(x, y); carve(x, y + 1); } }
  function vline(y0, y1, x) { for (let y = Math.min(y0, y1); y <= Math.max(y0, y1) + 1; y++) { carve(x, y); carve(x + 1, y); } }
  const linked = new Set();
  const key = (a, b) => (a < b ? a + ',' + b : b + ',' + a);
  function connect(a, b) {
    linked.add(key(a.id, b.id));
    if (rng() < 0.5) { hline(a.ccx, b.ccx, a.ccy); vline(a.ccy, b.ccy, b.ccx); }
    else { vline(a.ccy, b.ccy, a.ccx); hline(a.ccx, b.ccx, b.ccy); }
  }
  const roomAt = (cx, cy) => rooms[cy * cols + cx];
  const seen = new Array(rooms.length).fill(false);
  const stack = [ri(0, rooms.length - 1)];
  seen[stack[0]] = true;
  while (stack.length) {
    const cur = rooms[stack[stack.length - 1]];
    const nb = DIRS4.map(([dx, dy]) => [cur.cx + dx, cur.cy + dy])
      .filter(([x, y]) => x >= 0 && y >= 0 && x < cols && y < rows && !seen[y * cols + x]);
    if (!nb.length) { stack.pop(); continue; }
    const [nx, ny] = pick(nb);
    const n = roomAt(nx, ny);
    seen[n.id] = true;
    connect(cur, n);
    stack.push(n.id);
  }
  for (const r of rooms) {
    if (r.cx + 1 < cols && !linked.has(key(r.id, r.id + 1)) && rng() < 0.3) connect(r, roomAt(r.cx + 1, r.cy));
    if (r.cy + 1 < rows && !linked.has(key(r.id, r.id + cols)) && rng() < 0.3) connect(r, roomAt(r.cx, r.cy + 1));
  }

  function bfs(sx, sy) {
    const dist = new Int32Array(W * H).fill(-1);
    const q = [I(sx, sy)];
    dist[q[0]] = 0;
    for (let h = 0; h < q.length; h++) {
      const i = q[h], x = i % W, y = (i / W) | 0;
      for (const [dx, dy] of DIRS4) {
        const n = I(x + dx, y + dy);
        if (grid[n] === 0 && dist[n] < 0) { dist[n] = dist[i] + 1; q.push(n); }
      }
    }
    return { dist, count: q.length };
  }

  // --- start & exit ---------------------------------------------------------
  const startRoom = rooms[ri(0, rooms.length - 1)];
  let { dist } = bfs(startRoom.ccx, startRoom.ccy);
  let exitRoom = startRoom;
  for (const r of rooms) if (dist[I(r.ccx, r.ccy)] > dist[I(exitRoom.ccx, exitRoom.ccy)]) exitRoom = r;

  if (isFinal) {
    // The control-center chamber fills its whole cell.
    const r = exitRoom;
    r.x = 1 + r.cx * CELL + 1; r.y = 1 + r.cy * CELL + 1; r.w = 9; r.h = 9;
    r.ccx = r.x + 4; r.ccy = r.y + 4;
    carveRoom(r);
  }

  // --- pillars (only kept if every floor tile stays reachable) --------------
  let total = bfs(startRoom.ccx, startRoom.ccy).count;
  for (const r of rooms) {
    if (r === startRoom || r === exitRoom || r.w < 7 || r.h < 6 || rng() > 0.65) continue;
    const n = ri(1, 2);
    for (let k = 0; k < n; k++) {
      const px = ri(r.x + 2, r.x + r.w - 3), py = ri(r.y + 2, r.y + r.h - 3);
      const tiles = rng() < 0.5 ? [[px, py]] : rng() < 0.5 ? [[px, py], [px + 1, py]] : [[px, py], [px, py + 1]];
      if (!tiles.every(([x, y]) => x < r.x + r.w - 1 && y < r.y + r.h - 1 && grid[I(x, y)] === 0)) continue;
      tiles.forEach(([x, y]) => { grid[I(x, y)] = 1; });
      const c = bfs(startRoom.ccx, startRoom.ccy).count;
      if (c === total - tiles.length) total = c;
      else tiles.forEach(([x, y]) => { grid[I(x, y)] = 0; });
    }
  }
  dist = bfs(startRoom.ccx, startRoom.ccy).dist;

  // --- population -------------------------------------------------------------
  const occupied = new Set();
  const spawns = [];
  const px = t => t * TILE + TILE / 2;
  const put = (type, tx, ty, extra) => { occupied.add(I(tx, ty)); spawns.push({ type, x: px(tx), y: px(ty), ...extra }); };
  const wallNear = (x, y) => DIRS4.some(([dx, dy]) => grid[I(x + dx, y + dy)] === 1);
  function freeTile(r, margin = 1, preferWall = false) {
    let best = null;
    for (let t = 0; t < 30; t++) {
      const x = ri(r.x + margin, r.x + r.w - 1 - margin), y = ri(r.y + margin, r.y + r.h - 1 - margin);
      if (grid[I(x, y)] !== 0 || occupied.has(I(x, y)) || dist[I(x, y)] < 7) continue;
      if (!preferWall || wallNear(x, y)) return { x, y };
      best = best || { x, y };
    }
    return best;
  }
  for (let y = startRoom.y - 1; y <= startRoom.y + startRoom.h; y++)
    for (let x = startRoom.x - 1; x <= startRoom.x + startRoom.w; x++) occupied.add(I(x, y));

  const tankKind = () => (d >= 7 && rng() < 0.28 ? 'fast' : d >= 3 && rng() < 0.3 ? 'heavy' : 'std');

  if (isFinal) {
    const cx = exitRoom.x + 5, cy = exitRoom.y + 5;   // CC occupies tiles cx-1..cx, cy-1..cy
    for (let y = cy - 2; y <= cy + 1; y++) for (let x = cx - 2; x <= cx + 1; x++) occupied.add(I(x, y));
    for (let y = cy - 1; y <= cy; y++) for (let x = cx - 1; x <= cx; x++) grid[I(x, y)] = 2;
    spawns.push({ type: 'cc', x: cx * TILE, y: cy * TILE });
    // exit hatch in the chamber corner farthest from where the player enters
    const corners = [[exitRoom.x, exitRoom.y], [exitRoom.x + 8, exitRoom.y], [exitRoom.x, exitRoom.y + 8], [exitRoom.x + 8, exitRoom.y + 8]]
      .filter(([x, y]) => grid[I(x, y)] === 0);
    let ex = corners[0];
    for (const c of corners) if (dist[I(c[0], c[1])] > dist[I(ex[0], ex[1])]) ex = c;
    put('exit', ex[0], ex[1], { locked: true });
    for (let k = 0; k < 2 + Math.min(4, Math.floor(d / 3)); k++) {
      const t = freeTile(exitRoom, 0, true);
      if (t) put('turret', t.x, t.y);
    }
  } else {
    put('exit', exitRoom.ccx, exitRoom.ccy, { locked: false });
  }

  for (const r of rooms) {
    if (r === startRoom) continue;
    const place = (type, n, margin, wall, extra) => {
      for (let k = 0; k < n; k++) {
        const t = freeTile(r, margin, wall);
        if (t) put(type, t.x, t.y, typeof extra === 'function' ? extra() : extra);
      }
    };
    if (!(isFinal && r === exitRoom)) {
      place('turret', ri(0, Math.min(3, 1 + Math.floor(d / 3))), 0, true);
      place('tank', ri(r === exitRoom ? 1 : 0, Math.min(4, 1 + Math.floor(d / 2))), 1, false, () => ({ kind: tankKind() }));
      if (rng() < Math.min(0.42, 0.18 + 0.03 * d)) place('gen', 1, 1, false);
      if (d >= 2 && rng() < 0.3) place('mine', ri(2, 4), 1, false);
    }
    place('star', ri(0, 2), 1, false);
    if (rng() < 0.5) place('fuel', 1, 1, false);
    if (rng() < 0.1) place('shield', 1, 1, false);
  }
  // a guaranteed fuel canister near the start
  const sf = { x: startRoom.x + (startRoom.w > 6 ? 1 : 0), y: startRoom.y };
  if (grid[I(sf.x, sf.y)] === 0) spawns.push({ type: 'fuel', x: px(sf.x), y: px(sf.y) });

  return {
    seed, station, levelNum, loop, isFinal, W, H, grid, rooms, startRoom, exitRoom, spawns,
    start: { x: px(startRoom.ccx), y: px(startRoom.ccy) },
  };
}
