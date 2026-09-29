'use strict';
// Generates every station/level (two loops) and verifies each one is playable:
// the start is on the deck, every floor tile is reachable, the exit can be
// reached and nothing spawns inside a wall. Run with `npm test`.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ctx = { console, Math, localStorage: { getItem() { return null; }, setItem() {} } };
vm.createContext(ctx);
for (const f of ['core.js', 'level.js']) {
  // top-level const/let become globals so the test can reach them
  const src = fs.readFileSync(path.resolve(__dirname, '..', 'js', f), 'utf8').replace(/^(const|let) /gm, 'var ');
  vm.runInContext(src, ctx, { filename: f });
}

const T = 32;
let problems = 0, levels = 0;
const fail = msg => { problems++; console.error('FAIL ' + msg); };

for (let loop = 0; loop < 2; loop++) {
  for (let s = 1; s <= ctx.NUM_STATIONS; s++) {
    for (let l = 1; l <= ctx.LEVELS_PER_STATION; l++) {
      const L = ctx.generateLevel(s, l, loop);
      const { W, H, grid } = L;
      const tag = `loop ${loop} station ${s} level ${l}`;
      const idx = (x, y) => Math.floor(y / T) * W + Math.floor(x / T);
      levels++;

      const start = idx(L.start.x, L.start.y);
      if (grid[start] !== 0) fail(`${tag}: start is not on the deck`);

      const dist = new Int32Array(W * H).fill(-1);
      const q = [start];
      dist[start] = 0;
      for (let h = 0; h < q.length; h++) {
        const i = q[h];
        for (const n of [i + 1, i - 1, i + W, i - W]) if (grid[n] === 0 && dist[n] < 0) { dist[n] = dist[i] + 1; q.push(n); }
      }
      const floor = grid.reduce((n, v) => n + (v === 0), 0);
      if (floor !== q.length) fail(`${tag}: ${floor - q.length} unreachable floor tiles`);

      const exits = L.spawns.filter(p => p.type === 'exit');
      if (exits.length !== 1) fail(`${tag}: expected 1 exit, found ${exits.length}`);
      else if (dist[idx(exits[0].x, exits[0].y)] < 0) fail(`${tag}: exit unreachable`);

      if (L.isFinal !== !!L.spawns.find(p => p.type === 'cc')) fail(`${tag}: control center mismatch`);
      for (const sp of L.spawns) if (sp.type !== 'cc' && grid[idx(sp.x, sp.y)] !== 0) fail(`${tag}: ${sp.type} inside a wall`);
    }
  }
}

console.log(`${levels} levels checked, ${problems} problem(s)`);
process.exit(problems ? 1 : 0);
